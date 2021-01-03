const express = require('express');
const mongoose = require('mongoose');
const moment = require('moment');
const asynk = require('async');
const ReservoirHelper = require('./reservoirHelper');

class ItemHelper {
    constructor(item) {
        let self = this;

        if (!item)
            throw new Error("No item passed to ItemHelper constructor.");
        self.item = item;

        // Lets check if the custom meta data is valid JSON.
        if(self.item.metaData) {
            try { 
                self.item.metaData = JSON.parse(self.item.metaData); 
            }
            catch(err) { 
                console.error("Failed to parse metadata, it must be valid JSON.");
                throw err;
            }
        }

        if(self.item.encoding)
        {
            // If we are provided with information on how the data was encoded then we will decode it.
            try {
                self.item.dataDecoded = Buffer.from(self.item.data);
                if(self.item.encoding === 'json') {
                    let parsedJson = JSON.parse(self.item.data.toString('utf8'));
                    self.item.dataDecoded = parsedJson;
                }
                else if(self.item.encoding === 'base64') {
                    // Well we could do something, but we are not going to.
                }
                else if(self.item.encoding === 'raw') {
                    // Well we could do something, but we are not going to.
                }
                else if(self.item.encoding === 'text') {
                    self.item.data = self.item.data.toString('utf8');
                }
                else {
                    throw new Error("Unknown encoding type: " + self.item.encoding);
                }
            }
            catch(err)
            {
                console.error("Failed to decode item data.");
                throw(err);
            }
        }
        else
        {
            try {
                // If no encoding information was passed then we will encode it depending on the mimetype.
                if(self.item.mimeType === 'application/json' && typeof self.item.data === 'object') {
                    self.item.encoding = 'json';
                    self.item.dataEncoded = Buffer.from(JSON.stringify(self.item.data), 'utf8');
                }
                else if(self.item.mimeType === 'application/json' && typeof self.item.data === 'string') {
                    // If its already a string then lets just leave it alone.
                    self.item.encoding = 'json';
                    self.item.dataEncoded = Buffer.from(self.item.data, 'utf8');
                }
                else if((self.item.mimeType === 'text/plain' || self.item.mimeType === 'text/html') && typeof self.item.data === 'string') {
                    self.item.encoding = 'text';
                    self.item.dataEncoded = Buffer.from(self.item.data, 'utf8');
                }
                else { 
                    // To keep things simple we will treat everyting else as base64.
                    self.item.encoding = 'base64';
                    self.item.dataEncoded = Buffer.from(self.item.data, 'base64');
                }
            }
            catch(err) {
                console.error("Failed to encode item data.");
                throw(err);
            }
        }

        return self;
    }

    complete(reason, reservoir, cb) {
        let self = this;
        let helper = new ReservoirHelper(reservoir);

        self.item.completed = moment();
        self.item.completedReason = reason;

        // If the retension period is not set or has expired, then we should empty the data.
        if(self.item.retentionMs === 0 || moment(helper.item.retentionExpires).isBefore(moment())) { 
            self.item.data = null;
            self.item.purged = moment().toDate();
        }

        self.item.save((err) => {
            if(err) return cb(err);

            helper.incrementProcessed(self.item, (err, reservoir) => {
                return cb(err, self.item);
            });
        });
    }

    collected(accessKey, allAccessKeys, reservoir, cb) {
        let self = this;

        self.item.collected.push({ _accessKey: accessKey, collected: moment().toDate() });

        // Lets assume all the access keys have collected the data, unless we find an access key that has not.
        let allCollected = true;
        for (let i = 0; i < allAccessKeys.length; i++) {
            let currentKey = self.item.collected.find(obj => obj._accessKey.toString() === allAccessKeys[i]._id.toString());
            if (!currentKey)
                allCollected = false;
        }

        self.item.save((err, item) => {
            // All the access keys have collected the data, now we can mark the item as completed.
            if (allCollected === true) {
                return self.complete('collected', reservoir, cb);
            }
            else {
                return cb(err, item);
            }
        });
    }
};

module.exports = ItemHelper;