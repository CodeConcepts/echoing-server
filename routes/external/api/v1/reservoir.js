const express = require('express');
const mongoose = require('mongoose');
const generator = require('generate-password');
const moment = require('moment');
const asynk = require('async');

//const authenticate = require('../../../../libs/middleware/authenticate');
const passport = require('passport');
const router = express.Router();
const schema = require('../../../../models');

const pjson = require('../../../../app.config.json');

// GET reservoir status
router.get('/', passport.authenticate('localapikey', { session: false }), function(req, res, next) {
    schema.Reservoir.findOne({ _id: req.user._reservoir._id }, (err, reservoir) => {
        if(err) return next(err);

        let response = {
            _id: reservoir._id,
            name: reservoir.name,
            status: reservoir.status,
            accessMethod: reservoir.accessMethod,
            maxItemSizeBytes: reservoir.maxItemSizeBytes,
            currentItemCount: reservoir.currentItemCount,
            processedItemCount: reservoir.processedItemCount,
            erroredItemCount: reservoir.erroredItemCount,
            expiredItemCount: reservoir.expiredItemCount,
            maxSizeBytes: reservoir.maxSizeBytes,
            currentSizeBytes: reservoir.currentSizeBytes,
            overflowStrategy: reservoir.overflowStrategy,
            defaultExpiryMs: reservoir.defaultExpiryMs,
            defaultRetentionMs: reservoir.defaultRetentionMs,
            isTransient: reservoir.isTransient,
            updated: reservoir.updated,
            created: reservoir.created
        };

        return res.echoJsonResponse(null, response);
    });
});

module.exports = router;