const express = require('express');
const mongoose = require('mongoose');
const moment = require('moment');
const asynk = require('async');

//const authenticate = require('../../../../libs/middleware/authenticate');
const passport = require('passport');
const router = express.Router();
const schema = require('../../../../models');
const ItemHelper = require('../../../../libs/reservoir/itemHelper');

const pjson = require('../../../../app.config.json');

// GET items
router.get('/', passport.authenticate('localapikey', { session: false }), function(req, res, next) {
    schema.Reservoir.findOne({ _id: req.user._reservoir._id }, (err, reservoir) => {
        if(err) return next(err);

        schema.ReservoirItem.find({ '_reservoir': req.user._reservoir._id, "completed": { "$exists": false }, '$not': { 'collectedBy': { '$elemMatch' : { _accessKey: req.user._accessKey } } } }).sort({ "created": 1 }).exec((err, items) => {
            if(err) return next(err);

            schema.AccessKey.find({ '_reservoir': req.user._reservoir._id }, (err, accessKeys) => {
                if(err) return next(err);

                let data = [];
                asynk.allSeries(items, (item, nextItem) => {
                    let helper = new ItemHelper(item);
                    if(item.expiryMs > 0 && moment(item.created).add(item.expiryMs, 'milliseconds').isAfter(moment()))
                    {
                        helper.complete('expired', (err, item) => {
                            return nextItem(err);
                        });
                    }
                    else {
                        data.push({
                            _id: item._id,
                            remoteId: item.remoteId,
                            mimeType: item.mimeType,
                            data: item.data
                        });

                        helper.collected(req.user._accessKey, accessKeys, (err, item) => {
                            return nextItem(err);
                        });
                    }
                }, (err) => {
                    if(err) return next(err);
                    
                    return res.echoJsonResponse(null,data);
                });
            });
        });
    });
});

// GET item by remote id
router.get('/remote/:id', passport.authenticate('localapikey', { session: false }), function(req, res, next) {
    schema.ReservoirItem.findOne({ _reservoir: req.user._reservoir._id, remoteId: req.params.id }, (error, item) => {
        if(err) return next(error);

        let item = {
            metaData: item.metaData,
            remoteId: item.remoteId,
            itemSizeBytes: item.itemSizeBytes,
            expiryMs: item.expiryMs,
            mimeType: item.mimeType,
            data: item.data,
            completed: item.completed,
            completedReason: item.completedReason,
            created: item.created
        };

        schema.AccessKey.findById(item._accessKey).populate('_user').exec((err, accessKey) => {
            if(err) return next(error);

            item.createdBy = accessKey._user.username;
            return res.echoJsonResponse(null,item);
        });
    });
});

// GET item by id
router.get('/:id', passport.authenticate('localapikey', { session: false }), function(req, res, next) {
    schema.ReservoirItem.findOne({ _reservoir: req.user._reservoir._id, _id: req.params.id }, (error, item) => {
        if(err) return next(error);

        let item = {
            metaData: item.metaData,
            remoteId: item.remoteId,
            itemSizeBytes: item.itemSizeBytes,
            expiryMs: item.expiryMs,
            mimeType: item.mimeType,
            data: item.data,
            completed: item.completed,
            completedReason: item.completedReason,
            created: item.created
        };

        schema.AccessKey.findById(item._accessKey).populate('_user').exec((err, accessKey) => {
            if(err) return next(error);

            item.createdBy = accessKey._user.username;
            return res.echoJsonResponse(null, item);
        });
    });
});

// DELETE item by id
router.delete('/:id', passport.authenticate('localapikey', { session: false }), function(req, res, next) {
    if(req.user.apiKeyAccess !== 'full') return res.send(401, "Unauthorised: You do not have the correct permissions to delete this item.");

    schema.ReservoirItem.find({ _reservoir: req.user._reservoir._id, _id: req.params.id }, (err, item) => {
        if(err) return next(err);

        let helper = new ItemHelper(item);
        helper.complete('deleted', (err, item) {
            return res.echoJsonResponse(null,"Item completed with the 'deleted' reason");
        });
    });
});

module.exports = router;