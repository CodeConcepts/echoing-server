const express = require('express');
const mongoose = require('mongoose');
const moment = require('moment');
const asynk = require('async');

//const authenticate = require('../../../../libs/middleware/authenticate');
const passport = require('passport');
const router = express.Router();
const schema = require('../../../../models');
const ItemHelper = require('../../../../libs/reservoir/itemHelper');
const ReservoirHelper = require('../../../../libs/reservoir/reservoirHelper');

const pjson = require('../../../../app.config.json');

// GET items
router.get('/', passport.authenticate('localapikey', { session: false }), function(req, res, next) {
    let limit = (req.query.limit) ? parseInt(req.query.limit) : 100;

    if(limit > 500) {
        return next(new Error("Too many items requested, Maximum request limit is 500 items."));
    }

    schema.Reservoir.findOne({ _id: req.user._reservoir._id }, (err, reservoir) => {
        if(err) return next(err);

        schema.ReservoirItem.find({ 
            '_reservoir': req.user._reservoir._id, 
            'completed': { 
                '$exists': false 
            }, 
            'collected': { 
                '$not': { 
                    '$elemMatch' : { 
                        '_accessKey': req.user._accessKey 
                    } 
                } 
            } 
        }).sort({ "created": 1 }).limit(limit).exec((err, items) => {
            if(err) return next(err);

            schema.AccessKey.find({ '_reservoir': req.user._reservoir._id }, (err, accessKeys) => {
                if(err) return next(err);

                let data = [];
                asynk.eachSeries(items, (item, nextItem) => {
                    let helper = new ItemHelper(item);

                    if(helper.item.expiryMs !== 0 && moment(helper.item.expires).isBefore(moment()))
                    {
                        helper.complete('expired', reservoir, (err) => {
                            return nextItem(err);
                        });
                    }
                    else {
                        data.push({
                            _id: helper.item._id,
                            remoteId: helper.item.remoteId,
                            mimeType: helper.item.mimeType,
                            data: helper.item.dataDecoded
                        });

                        helper.collected(req.user._accessKey, accessKeys, reservoir, (err, item) => {
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

        let safeItem = {
            metaData: item.metaData,
            remoteId: item.remoteId,
            itemSizeBytes: item.itemSizeBytes,
            expiryMs: item.expiryMs,
            retentionMs: item.retentionMs,
            expires: item.expires,
            retentionExpires: item.retentionExpires,
            mimeType: item.mimeType,
            data: item.data,
            completed: item.completed,
            completedReason: item.completedReason,
            created: item.created
        };

        schema.AccessKey.findById(item._accessKey).populate('_user').exec((err, accessKey) => {
            if(err) return next(error);

            safeItem.createdBy = accessKey._user.username;
            return res.echoJsonResponse(null,safeItem);
        });
    });
});

// GET item by id
router.get('/:id', passport.authenticate('localapikey', { session: false }), function(req, res, next) {
    schema.ReservoirItem.findOne({ _reservoir: req.user._reservoir._id, _id: req.params.id }, (error, item) => {
        if(err) return next(error);

        let safeItem = {
            metaData: item.metaData,
            remoteId: item.remoteId,
            itemSizeBytes: item.itemSizeBytes,
            expiryMs: item.expiryMs,
            retentionMs: item.retentionMs,
            expires: item.expires,
            retentionExpires: item.retentionExpires,
            mimeType: item.mimeType,
            data: item.data,
            completed: item.completed,
            completedReason: item.completedReason,
            created: item.created
        };

        schema.AccessKey.findById(item._accessKey).populate('_user').exec((err, accessKey) => {
            if(err) return next(error);

            safeItem.createdBy = accessKey._user.username;
            return res.echoJsonResponse(null, safeItem);
        });
    });
});

// DELETE item by id
router.delete('/:id', passport.authenticate('localapikey', { session: false }), function(req, res, next) {
    if(req.user.apiKeyAccess !== 'full') return res.send(401, "Unauthorised: You do not have the correct permissions to delete this item.");

    schema.ReservoirItem.find({ _reservoir: req.user._reservoir._id, _id: req.params.id }, (err, item) => {
        if(err) return next(err);

        let helper = new ItemHelper(item);
        helper.complete('deleted', reservoir, (err, item) => {
            return res.echoJsonResponse(null,"Item completed with the 'deleted' reason");
        });
    });
});

// POST a new item
router.post('/',passport.authenticate('localapikey', { session: false }), function(req, res, next) {
    if(req.user.apiKeyAccess !== 'full' && req.user.apiKeyAccess !== 'write') return res.send(401, "Unauthorised: You do not have the correct permissions to delete this item.");

    schema.Reservoir.findOne({ _id: req.user._reservoir._id }, (err, reservoir) => {
        if(err) return next(err);
        let helper = new ReservoirHelper(reservoir);
        let itemHelper = null;

        try {
            itemHelper = new ItemHelper(req.body);
        }
        catch(err) {
            helper.incrementErrors((err, reservoir) => {  
                if(err) return next(err);       
            });
        }
   
        // Lets check if the custom meta data is too long. 
        if(itemHelper.item.metaData && JSON.stringify(itemHelper.item.metaData).length > 512) 
        {
            helper.incrementErrors((err, reservoir) => { 
                return res.echoJsonResponse(new Error("Custom meta data must be less than 512 characters, try removing unessasery white space."));
            });
        }

        // Lets check the data length.
        if(itemHelper.item.dataEncoded.length > reservoir.maxItemSizeBytes) {
            helper.incrementErrors((err, reservoir) => { 
                if(err) return next(err);

                return res.echoJsonResponse(new Error("Item data must be less than " + reservoir.maxItemSizeBytes + " bytes."));
            });
        }

        // Now if adding this data exceeds the reservoir's max size then we better not add it.
        if(itemHelper.item.dataEncoded.length + reservoir.currentSizeBytes > reservoir.maxSizeBytes) {
            helper.incrementErrors((err, reservoir) => {
                if(err) return next(err);

                return res.echoJsonResponse(new Error("Inserting this item would exceed the reservoirs maximum size of " + reservoir.maxSizeBytes + " bytes.")); 
            });
        }

        let item = {
            _reservoir: reservoir._id,
            _accessKey: req.user._accessKey,
            metaData: { custom: itemHelper.item.metaData },
            remoteId: itemHelper.item.remoteId,
            itemSizeBytes: itemHelper.item.dataEncoded.length,
            expiryMs: (itemHelper.item.expiryMs) ? itemHelper.item.expiryMs : reservoir.defaultExpiryMs,
            retentionMs: (itemHelper.item.expiryMs) ? itemHelper.item.retentionMs : reservoir.defaultRetentionMs,
            expires: moment().add((itemHelper.item.expiryMs) ? itemHelper.item.expiryMs : reservoir.defaultExpiryMs, 'milliseconds'),
            retentionExpires: moment().add((itemHelper.item.expiryMs) ? itemHelper.item.retentionMs : reservoir.defaultRetentionMs,'milliseconds'),
            mimeType: itemHelper.item.mimeType,
            encoding: itemHelper.item.encoding,
            data: itemHelper.item.dataEncoded
        };

        // Lets make a new item :)
        let newItemObj = new schema.ReservoirItem(item);
        newItemObj.save((err, item) => {
            helper.incrementCurrent(item, (err, reservoir) => {
                if(err) return next(err);
                delete newItemObj;
                delete itemHelper;
                delete helper;
                delete reservoir;
                return res.echoJsonResponse(null, item);
            });
        });
    });
});

module.exports = router;