var createError = require('http-errors');
var express = require('express');
const session = require('express-session');
const mongoStore = require('connect-mongo')(session);
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

const mongoose = require('mongoose');
const schema = require('./models');

const SystemInit = require('./system-init');

// Globally load the config file
global.gConfig = require('./app.config.json');

// Lets open the db connection
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

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'letsR3cordTh3W0rld!!',
  resave: false,
  saveUninitialized: true,
  store: new mongoStore({ mongooseConnection: mongoose.connection })
}));

// lets add a middleware function to standardise our responses
app.use(function(req, res, next) {
  res.skeJsonResponse = function (error, data) {
    if(error) {
      return { status: "ERROR", message: error.message };
    }
    else {
      return { status: "OK", data: data }
    }
  };
  next();
});

// initialize passport middleware
app.use(passport.initialize());
app.use(passport.session());

app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/api/user'));
app.use('/api/account', require('./routes/api/account'));

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

module.exports = app;
