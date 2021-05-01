"use strict";
const createError = require('http-errors');
const express = require('express');
const cors = require('cors');

const session = require('express-session');
const mongoStore = require('connect-mongo')(session);
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const LocalAPIKeyStrategy = require('passport-localapikey').Strategy;

const mongoose = require('mongoose');
const schema = require('./models');

const SystemInit = require('./system-init');

// Globally load the config file
global.gConfig = require('./app.config.json');

// Lets open the db connection
mongoose.set('debug', global.gConfig.debug);
mongoose.set('useCreateIndex', true);
mongoose.connect(global.gConfig.echoing.database.connection, global.gConfig.echoing.database.options);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open',() => {
  console.log("Connected to database :)");
  new SystemInit();
});

// Passport session setup.
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

// Use the LocalStrategy within Passport.
passport.use(new LocalStrategy({},
    function(username, password, done) {
      schema.User.findOne({ $or: [ {username: username }, { emailAddress: username } ] }).populate('_account').exec(function(err, user) {
        if(err) return done(err);
        if(!user) return done(null, false, { message: 'Incorrect username.' });
        if(user._account.deleted === true) return done(null, false, { message: 'Inactive/Deleted Account.' });
        if(!user.authenticate(password)) return done(null, false, { message: 'Incorrect password.' });

        // Lets make the user object safe to pass around and even pass back to the browser.
        let safeUser = user.toObject();
        safeUser.password = undefined;
        safeUser.passwordSalt = undefined;
        safeUser.passwordFormat = undefined;

        // Update the last login date and save.
        user.lastLogin = new Date();
        user.save((err) => {
          if(err) return done(err);

          return done(null,safeUser);
        });
      });
    }
));

// Use the LocalAPIStrategy.
passport.use(new LocalAPIKeyStrategy(
    function(apiKey, done) {
      if(apiKey.indexOf('::') < 0)
      {
        schema.AccessKey.findOne({ key: apiKey }).populate(['_user','_account','_reservoir']).exec(function(err, accessKey) {
          if(err) return done(err);
          if(!accessKey || accessKey.active === false) return done(null, false, { message: 'Invalid API Key.' });
          if(accessKey._account.deleted === true || !accessKey._user) return done(null, false, { message: 'Inactive/Deleted Account.' });

          // Lets make the user object safe to pass around and even pass back to the browser.
          let safeUser = accessKey._user.toObject();
          safeUser.password = undefined;
          safeUser.passwordSalt = undefined;
          safeUser.passwordFormat = undefined;

          // We want to mark the session as an apiKeySession
          safeUser.apiKeySession = true;
          safeUser.apiKeyAccess = accessKey.access;
          safeUser._accessKey = accessKey._id;
          safeUser._reservoir = accessKey._reservoir;

          // Update the last login date and save.
          accessKey._user.lastLogin = new Date();
          accessKey._user.save((err) => {
            if(err) return done(err);

            return done(null,safeUser);
          });
        });
      }
      else
      {
        let keyParts = apiKey.split("::");
        let deviceKey = keyParts[0];
        let reservoir = keyParts[1];

        schema.UserDevice.findOne({ key: deviceKey }).populate(['_user']).exec(function(err, userDevice) {
          if(err) return done(err);
          if(!userDevice) return done(null, false, { message: 'Invalid Device Key.' });

          if(!reservoir || reservoir === '')
          {
            // Lets make the user object safe to pass around and even pass back to the browser.
            let safeUser = userDevice._user.toObject();
            safeUser.password = undefined;
            safeUser.passwordSalt = undefined;
            safeUser.passwordFormat = undefined;

            // We want to mark the session as an apiKeySession
            safeUser.apiKeySession = false;
            safeUser.userDeviceKeySession = true; 
            
            // Update the last login date and save.
            userDevice._user.lastLogin = new Date();
            userDevice.lastLogin = new Date();
            userDevice.save((err) => {
              if(err) return done(err);

              userDevice._user.save((err) => {
                if(err) return done(err);
  
                return done(null,safeUser);
              });  
            });
          }
          else
          {
            schema.AccessKey.findOne({ _user: userDevice._user, _reservoir: reservoir }).populate(['_user','_account','_reservoir']).exec(function(err, accessKey) {
              if(err) return done(err);
              if(!accessKey || accessKey.active === false) return done(null, false, { message: 'Invalid API Key.' });
              if(accessKey._account.deleted === true || !accessKey._user) return done(null, false, { message: 'Inactive/Deleted Account.' });

              // Lets make the user object safe to pass around and even pass back to the browser.
              let safeUser = accessKey._user.toObject();
              safeUser.password = undefined;
              safeUser.passwordSalt = undefined;
              safeUser.passwordFormat = undefined;

              // We want to mark the session as an apiKeySession
              safeUser.apiKeySession = true;
              safeUser.userDeviceKeySession = true;
              safeUser.apiKeyAccess = accessKey.access;
              safeUser._accessKey = accessKey._id;
              safeUser._reservoir = accessKey._reservoir;

              // Update the last login date and save.
              accessKey._user.lastLogin = new Date();
              accessKey._user.save((err) => {
                if(err) return done(err);

                return done(null,safeUser);
              });
            });
          }
        });  
      }
    }
));

var app = express();

// We need to trust the proxy
app.set('trust proxy', 1);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(cors({
  credentials: true,
  origin: [/\.echoing\.io$/],
}));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'letsR3cordTh3W0rld!!',
  resave: false,
  saveUninitialized: true,
  store: new mongoStore({ mongooseConnection: mongoose.connection }),
  cookie: {
    httpOnly: false,
    secure: true,
    sameSite: 'none'
  }
}));

// lets add a middleware function to standardise our responses
app.use(function(req, res, next) {
  res.echoJsonResponse = function (error, data) {
    let response;
    if(error) {
      response = { status: "ERROR", message: error.message };
    }
    else {
      response = { status: "OK", data: data }
    }
    return res.json(response);
  };

  return next();
});

// initialize passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Echoing.io - Admin site api paths
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/api/user'));
app.use('/api/account', require('./routes/api/account'));
app.use('/api/reservoir', require('./routes/api/reservoir'));
app.use('/api/accessKey', require('./routes/api/accessKey'));

// Echoing.io - External api paths
app.use('/external/api/v1', require('./routes/external/api/v1/index'));
app.use('/external/api/v1/reservoir', require('./routes/external/api/v1/reservoir'));
app.use('/external/api/v1/item', require('./routes/external/api/v1/item'));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

function showHeap() {
  const arr = [1, 2, 3, 4, 5, 6, 9, 7, 8, 9, 10];
  arr.reverse();
  const used = process.memoryUsage();
  for (let key in used) {
    console.log(`${key} ${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB`);
  }
}

//setInterval(showHeap, 2000);
//showHeap();

module.exports = app;
