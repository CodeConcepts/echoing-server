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

router.get('/', passport.authenticate('localapikey', { session: false }), function(req, res, next) {
    let limit = (req.query.limit) ? parseInt(req.query.limit) : 50;
    let offset = (req.query.offset) ? parseInt(req.query.offset) : 0;
    let search = {};

    if(req.query.search) {
        search["_reservoir.name"] = new RegExp(req.query.search, 'i');
    }

    if(!search['$or']) search['$or'] = [];
    if(req.user.role === 'manager') search['$or'].push({ '_account':  req.user._account._id });
    if(req.user.role === 'manager' || req.user.role === 'user') search['$or'].push({ '_user':  req.user._id });

    search = {
        "deleted": false,
        "_account.deleted": false
    };

    let pipeline = [{ $lookup: {
                     from: "accounts",
                     localField: "_account",
                     foreignField: "_id",
                     as: "_account"
                    }},
                    { $unwind: "$_account" },
                    { $match: search }];

    if(req.user.role !== 'sysadmin' && req.user.role !== 'admin'&& req.user.role !== 'manager')
    {
        //let cuid = mongoose.Types.ObjectId(req.user._id);
        pipeline.push({
            $lookup: {
                from: 'accesskeys',
                let: { reservoirID: '$_id' },
                pipeline: [
                    { $match:
                        { $expr:
                            { $and:
                                [
                                    { $eq: ['$_reservoir','$$reservoirID'] },
                                    { $eq: ['$_user', { $toObjectId: req.user._id }] }
                                ]
                            }
                        }
                    }
                ],
                as: 'userAccess'
            }
        });
        pipeline.push({
            $unwind: '$userAccess'
        });
    }

    schema.Reservoir.aggregate(pipeline).skip(offset).limit(limit).exec(function(err, reservoirs) {
        if (err) return next(err);
        pipeline.push({ $count: 'count' });
        schema.Reservoir.aggregate(pipeline).exec(function (err, result) {
            return res.echoJsonResponse(null, { reservoirs: reservoirs, total: result.count });
        });
    });
});

// GET reservoir status
router.get('/status', passport.authenticate('localapikey', { session: false }), function(req, res, next) {
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

/* GET reservoir by id */
router.get('/:id', passport.authenticate('localapikey', { session: false }), function(req, res, next) {
    let search = {
        "_reservoir._id": req.params.id,
        "$or": []
    };

    if(req.user.role == 'manager') {
        search['$or'].push({ '_account._id': req.user._account });
        search['$or'].push({ '_user': req.user._id });
    }
    else if(req.user.role == 'user') {
        search['_user'] = req.user._id;
    }

    schema.AccessKey.populate(['_account','_reservoir']).findOne(search, function(err, accessKey) {
        if(err) return next(err);

        return res.echoJsonResponse(null, accessKey._reservoir);
    });
});


module.exports = router;