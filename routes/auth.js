const express = require('express');
const router = express.Router();
const passport = require('passport');
const mongoose = require('mongoose');
const crypto = require('crypto');

const authenticate = require('../libs/middleware/authenticate');
const schema = require('../models');

const pjson = require('../app.config.json');

router.get('/check', authenticate(), function(req, res) {
    if(req.user) res.json({ status: "OK", data: req.user });
    else res.json({ status: "FAILED", message: "User not logged in." })
});

router.get('/forbidden', function(req, res, next) {
    let err = new Error(`Ah Ah Ah! You didn't say the magic word! ${req.ip}`);
    err.statusCode = 403;
    next(err);
});

/* auth logout */
router.get('/logout', authenticate(), function(req, res) {
    req.logout();
    res.json({ status: "OK", data: null });
});

/* auth local */
router.post('/login', passport.authenticate('local'), function(req, res) {
    res.json({ status: "OK", data: req.user });
});

router.post('/register', passport.authenticate('local'), function(req, res) {    
    // Lets validate the form data
    if(!req.body.arch) return res.echoJsonResponse(new Error("Failed to register this device, the arch field must be provided."));
    if(!req.body.platform) return res.echoJsonResponse(new Error("Failed to register this device, the platform field must be provided."));
    if(!req.body.mash) return res.echoJsonResponse(new Error("Failed to register this device, the mash field must be provided."));
    if(!req.body.hostname) return res.echoJsonResponse(new Error("Failed to register this device, the hostname field must be provided."));

    let name = "";
    switch(req.body.platform) { 
        case 'aix':  
            name = "IBM AIX";
            break; 
        case 'android':
            name = "Android";
            break;
        case 'darwin':  
            name = "IOS"; 
            break; 
        case 'freebsd':  
            name = "FreeBSD";
            break; 
        case 'linux':  
            name = "Linux";
            break; 
        case 'openbsd':  
            name = "OpenBSD";
            break; 
        case 'sunos':  
            name = "SunOS"; 
            break; 
        case 'win32': 
            name = "Windows"; 
            break;     
        default:  
            console.log("Unknown"); 
    } 
    name += " - " + req.body.hostname.toUpperCase();

    schema.UserDevice.findOne({ secret: req.body.mash }, (err, device) => {
        if(err) return res.echoJsonResponse(err);
        if(device) return res.echoJsonResponse(new Error("Failed to register this device, this device is already registered. Please remove this device at: " + pjson.echoing.guiUrl));



        let newDevice = new schema.UserDevice({
            _user: req.user._id,
            name: name,
            arch: req.body.arch,
            platform: req.body.platform,
            secret: crypto.createHash('md5').update(req.body.mash + pjson.echoing.deviceHashSecret).digest("hex")
        });

        newDevice.save((err, device) => {
            if(err) return res.echoJsonResponse(err);
            return res.echoJsonResponse(null, { key: device.key });
        });
    });
});

module.exports = router;
