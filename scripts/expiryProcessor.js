const path = require('path');
const moment = require('moment');
const mongoose = require('mongoose');
const asynk = require('async');

// Echoing.io Libs
const schema = require('../models');
const ReservoirHelper = require('../libs/reservoir/reservoirHelper');
const ItemHelper = require('../libs/reservoir/itemHelper');

// Globally load the config file
global.gConfig = require('../app.config.json');

// Lets open the db connection
mongoose.set('debug', global.gConfig.debug);
mongoose.set('useCreateIndex', true);
mongoose.connect(global.gConfig.echoing.database.connection, global.gConfig.echoing.database.options);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open',() => {
  console.log("Connected to database :)");
  let working = false;

  setInterval(() => {
    if(working === false)
    {
        working = true;
        console.log("Processing Started: " + moment().format("YYYY/DD/MM HH:mm"));
        doProcessing((err) => {
            if(err) console.log(error);
            working = false;
            console.log("Processing Completed");    
        });
    }
  }, 10000);

  // Lets kick the processing off.
  working = true;
  console.log("Processing Started: " + moment().format("YYYY/DD/MM HH:mm"));
  doProcessing((err) => {
      if(err) console.log(error);
      working = false;
      console.log("Processing Completed");    
  });
});

function doProcessing(cb) {
    schema.ReservoirItem.find({  
        'completed': { '$exists': false }, 
        'expires': { '$lt': new Date() } 
    }).populate('_reservoir')
      .sort({ "created": 1 })
      .exec((err, items) => {
        if(err) return cb(err);
        
        asynk.eachSeries(items, (item, nextItem) => {
            let reservoir = item._reservoir;
            let helper = new ReservoirHelper(reservoir);
            let itemHelper = null;
            try {
                itemHelper = new ItemHelper(item);

                // If the item has expired. Then lets complete the item.
                if(itemHelper.item.expiryMs !== 0 && moment(itemHelper.item.expires).isBefore(moment()))
                {
                    itemHelper.complete('expired', reservoir, (err, item) => {
                        if(err)
                        {
                            console.error("ERROR ITEM ID: " + item._id);
                            console.error(err);
                        }
                        return nextItem();
                    });
                }
                else
                {
                    return nextItem();
                }
            }
            catch(error) {
                helper.incrementErrors((err, reservoir) => {
                    if(err) {
                        console.error("ERROR ITEM ID: " + item._id);
                        console.error(err);    
                    }
                    console.error("ERROR ITEM ID: " + item._id);
                    console.error(error);  
                    return nextItem();       
                });
            }
        }, (err) => {
            return cb(err);
        });
    });
};