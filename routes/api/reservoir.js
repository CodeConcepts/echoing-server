const express = require('express');
const mongoose = require('mongoose');
const generator = require('generate-password');
const moment = require('moment');
const asynk = require('async');

const authenticate = require('../../libs/middleware/authenticate');
const router = express.Router();
const schema = require('../../models');

const EmailSender = require('../../libs/email/email-sender');
const pjson = require('../../app.config.json');

// GET reservoirs
router.get('/', authenticate({ roles: ['sysadmin','admin','manager','user']}), function(req, res, next) {
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

/* GET reservoir by id */
router.get('/:id', authenticate({ roles: ['sysadmin','admin','manager','user']}), function(req, res, next) {
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

router.delete('/:id', authenticate({ roles: ['sysadmin','admin','manager','user']}), function(req, res, next) {
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
        if(req.user.role !== 'sysadmin' && req.user.role !== 'sysadmin' &&accessKey.access !== 'full') return res.send(401, "Unauthorised: You do not have the correct permissions to delete this item.");
        if(!accessKey.access) return res.echoJsonResponse(new Error("Failed to locate reservoir."));

        schema.ReservoirItem.delete({ _reservoir: accessKey._reservoir._id }, (err) => {
            if(err) return next(err);
            schema.AccessKey.delete({ _reservoir: accessKey._reservoir._id }, (err) => {
                if(err) return next(err);

                // Now we will update the reservoir to deleted.
                schema.Reservoir.findOne({ _id: req.params._id }, (err, reservoir) => {
                    if(err) return next(err);

                    reservoir.deleted = true;
                    reservoir.deletedBy = req.user._id;
                    reservoir.save((err) => {
                        if(err) return next(err);
                        return res.echoJsonResponse(null);
                    });
                });
            });
        });
    });
});

/* PUT update a user */
router.put('/', authenticate({ roles: ['sysadmin','admin','manager','user']}), function(req, res, next) {
    // The user must have a valid id in the body,
    if(!req.body.id && req.body._id) req.body.id = req.body._id;
    if(!req.body.id) return res.echoJsonResponse(new Error("Failed to locate reservoir."));

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
        if(req.user.role != 'sysadmin' && req.user.role != 'sysadmin' && (accessKey.access !== 'write' || accessKey.access !== 'full')) return res.send(401, "Unauthorised: You do not have the correct permissions to update this item.");
        if(!accessKey.access) return res.echoJsonResponse(new Error("Failed to locate reservoir."));

        // Now we will update the reservoir to deleted.
        schema.Reservoir.findOne({ _id: req.body._id }, (err, reservoir) => {
            if(err) return next(err);

            reservoir.name = req.body.name;
            reservoir.accessType = req.body.accessType;
            reservoir.strategy = req.body.strategy;
            reservoir.overflowStrategy = req.body.overflowStrategy;
            reservoir.defaultExpiryMs = req.body.defaultExpiryMs;
            reservoir.defaultRetentionMs = req.body.defaultRetentionMs;
            reservoir.restrictions = req.body.restrictions;
            reservoir.updatedBy = req.user._id;
            reservoir.updated = new Date();
            
            if(['sysadmin','admin'].indexOf(req.user.role) >= 0)
            {
                reservoir.maxItemSizeBytes = req.body.maxItemSizeBytes;
                reservoir.maxSizeBytes = req.body.maxSizeBytes;
            }

            reservoir.save((err) => {
                if(err) return next(err);
                return res.echoJsonResponse(null);
            });
        });
    });
});

/* POST create a user */
router.post('/', authenticate({ roles: ['sysadmin','admin','manager','user'] }), function(req, res, next) {
    let newReservoir = {
        _account: req.user._account,
        name: req.body.name,
        accessType: req.body.accessType,
        overflowStrategy: req.body.overflowStrategy,
        strategy: req.body.strategy,
        defaultExpiryMs: req.body.defaultExpiryMs,
        defaultRetentionMs: req.body.defaultRetentionMs,
        restrictions: req.body.restrictions,
        isTransient: req.body.isTransient,
        created: new Date(),
        createdBy: req.user._id
    };

    // We only want sysadmin or admin users to be able to select the reservoir account.
    if(req.user.role === 'sysadmin' && req.user.role === 'admin' && req.body._account) newReservoir._account = req.body._account;

    // Lets make a new user :)
    let newReservoirObj = new schema.Reservoir(newReservoir);
    newReservoirObj.save((err, reservoir) => {
        if(err) return next(err);

        let newAccessKeyObj = new schema.AccessKey({
            _account: reservoir._account,
            _reservoir: reservoir._id,
            _user: req.user._id,
            access: 'full',
            active: true,
            notification: {
                errors: true,
                events: true,
                status: true
            },
            channels: {
                email: true
            },
            updatedBy: req.user._id,
            updated: new Date(),
            createdBy: req.user._id,
            created: new Date()
        });

        newAccessKeyObj.save((err, accessKey) => {
            if(err) return next(err);
            return res.echoJsonResponse(null, { reservoir: reservoir, accessKey: accessKey });
        });
    });
});

module.exports = router;
