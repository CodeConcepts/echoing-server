const express = require('express');


const authenticate = require('../../libs/middleware/authenticate');
const router = express.Router();
const schema = require('../../models');

const EmailSender = require('../../libs/email/email-sender');
const pjson = require('../../app.config.json');

// GET accessKeys
router.get('/', authenticate({ roles: ['sysadmin','admin','manager','user']}), function(req, res, next) {
    let limit = (req.query.limit) ? parseInt(req.query.limit) : 50;
    let offset = (req.query.offset) ? parseInt(req.query.offset) : 0;
    let search = {};

    if(req.query.search) {
        search['$or'] = [
            { "_reservoir.name": new RegExp(req.query.search, 'i') },
            { "_user.username": new RegExp(req.query.search, 'i') },
            { "_user.emailAddress": new RegExp(req.query.search, 'i') },
            { "_user.forename": new RegExp(req.query.search, 'i') },
            { "_user.surname": new RegExp(req.query.search, 'i') },
        ];
    }

    if(!search['$or']) search['$or'] = [];
    if(['sysadmin','admin','manager'].indexOf(req.user.role) >= 0) {
        if(req.user.role == 'manager') search['$or'].push({ '_account._id':  req.user._account._id });

        search = {
            "_reservoir.deleted": false,
            "_account.deleted": false,
            "_user.active": true,
        };

        schema.AccessKey.aggregate([
            { $lookup: {
                    from: "accounts",
                    localField: "_account",
                    foreignField: "_id",
                    as: "_account"
                } },
            { $lookup: {
                    from: "reservoirs",
                    localField: "_reservoir",
                    foreignField: "_id",
                    as: "_reservoir"
                } },
            { $lookup: {
                    from: "users",
                    localField: "_user",
                    foreignField: "_id",
                    as: "_user"
                } },
            { $lookup: {
                    from: "users",
                    localField: "createdBy",
                    foreignField: "_id",
                    as: "createdByUser"
                } },
            { $unwind: "$_reservoir" },
            { $unwind: "$_account" },
            { $unwind: "$_user" },
            { $unwind: "$createdByUser" },
            { $match: search }
        ]).skip(offset).limit(limit).exec(function(err, accessKeys) {

            if (err) return next(err);
            schema.AccessKey.aggregate([
                { $lookup: {
                        from: "accounts",
                        localField: "_account",
                        foreignField: "_id",
                        as: "_account"
                    } },
                { $lookup: {
                        from: "reservoirs",
                        localField: "_reservoir",
                        foreignField: "_id",
                        as: "_reservoir"
                    } },
                { $lookup: {
                        from: "users",
                        localField: "_user",
                        foreignField: "_id",
                        as: "_user"
                    } },
                { $unwind: "$_account" },
                { $unwind: "$_reservoir" },
                { $unwind: "$_user" },
                { $match: search },
                { $count: 'count'}
            ]).exec(function (err, result) {
                return res.json(res.skeJsonResponse(null, { accessKeys: accessKeys, total: result.count }));
            });
        });
    }
    else
    {
        search['$or'].push({ '_user':  req.user._id });

        schema.AccessKey.populate(['_account','_reservoir']).find(search).skip(offset).limit(limit).exec(function(err, accessKeys) {
            if (err) return next(err);
            schema.AccessKey.populate(['_account','_reservoir']).countDocuments(search, function (err, count) {
                if (err) return next(err);

                return res.json(res.skeJsonResponse(null, { accessKeys: accessKeys, total: count }));
            });
        });
    }
});

/* GET invite a user to access a reservoir */
router.get('/:id/invite', function(req, res, next) {
    schema.Reservoir.findOne({ _id: req.params.id }, function(err, user) {
        if(err) return next(err);
        if(!user || !user.inviteStatus || user.inviteStatus !== 'invited') return res.json(res.skeJsonResponse(new Error("Failed to re-send invite, incorrect invite status.")));
        if(moment().isAfter(moment(user.inviteSent).add(24, 'hours'))) return res.json(res.skeJsonResponse(new Error("Sorry your invite has expired, please ask for it to be sent again.")));

        user.populate("_account", (err, user) => {
            if(err) return next(err);

            let safeUser = user.toObject();
            safeUser.password = undefined;
            safeUser.passwordSalt = undefined;
            safeUser.passwordFormat = undefined;

            return res.json(res.skeJsonResponse(null, safeUser));
        });
    });
});

/* GET accessKey by id */
router.get('/:id', authenticate({ roles: ['sysadmin','admin','manager','user']}), function(req, res, next) {
    let search = {
        "_id": req.params.id,
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

        return res.json(res.skeJsonResponse(null, accessKey));
    });
});

router.delete('/:id', authenticate({ roles: ['sysadmin','admin','manager','user']}), function(req, res, next) {
    let search = {
        "_id": req.params.id,
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
        if(req.user.role !== 'sysadmin' && req.user.role !== 'sysadmin' && accessKey.access !== 'full') return res.send(401, "Unauthorised: You do not have the correct permissions to delete this item.");
        if(!accessKey.access) return res.json(res.skeJsonResponse(new Error("Failed to locate requested access key.")));

        accessKey.delete((err) => {
            if(err) return next(err);
            return res.json(res.skeJsonResponse(null));
        });
    });
});

/* PUT update a access key */
router.put('/', authenticate({ roles: ['sysadmin','admin','manager','user']}), function(req, res, next) {
    // The user must have a valid id in the body,
    if(!req.body.id && req.body._id) req.body.id = req.body._id;
    if(!req.body.id) return res.json(res.skeJsonResponse(new Error("Failed to locate access key.")));

    let search = {
        "_id": req.body.id
    };

    schema.AccessKey.findOne(search).populate(['_account','_reservoir']).exec(function(err, accessKey) {
        if(err) return next(err);
        if(!accessKey) return res.json(res.skeJsonResponse(new Error("Failed to locate reservoir.")));
        if(req.user.role !== 'sysadmin' && req.user.role !== 'admin' && accessKey._account._id != req.user._account._id && accessKey._user != req.user._id) return res.send(401, "Unauthorised: You do not have access to this item.");
        if(req.user.role !== 'sysadmin' && req.user.role !== 'admin' && (accessKey.access !== 'write' || accessKey.access !== 'full')) return res.send(401, "Unauthorised: You do not have the correct permissions to update this item.");

        // Now we will update the access key
        if(req.user.role === 'sysadmin' || req.user.role === 'sysadmin' || req.user.role === 'manager') {
            accessKey.access = req.body.access;
            accessKey.active = req.body.active;
        }

        accessKey.notification.errors = req.body.notification.errors;
        accessKey.notification.events = req.body.notification.events;
        accessKey.notification.status = req.body.notification.status;

        accessKey.channels.email = req.body.channels.email;
        accessKey.channels.app = req.body.channels.app;

        accessKey.updated = new Date();
        accessKey.updatedBy = req.user._id;

        accessKey.save((err) => {
            if(err) return next(err);
            return res.json(res.skeJsonResponse(null));
        });
    });
});

/* POST create a access key */
router.post('/', authenticate({ roles: ['sysadmin','admin','manager'] }), function(req, res, next) {
    let search = {
        "_reservoir._id": req.body._reservoir,
        "_id": req.body._id,
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
        if(req.user.role !== 'sysadmin' && req.user.role !== 'sysadmin' && (accessKey.access !== 'write' || accessKey.access !== 'full')) return res.send(401, "Unauthorised: You do not have the correct permissions to create a new access key.");
        if(!accessKey.access) return res.json(res.skeJsonResponse(new Error("Failed to locate your access key for this reservoir.")));

        let newAccessKey = {
            _account: req.user._account,
            _reservoir: req.body._reservoir,
            _user: req.body._user,
            notification: {
                errors: req.body.notification.errors,
                events: req.body.notification.events,
                status: req.body.notification.status
            },
            channels: {
                email: true,
            },
            access: req.body.access,
            active: req.body.active,
            updated: new Date(),
            updatedBy: req.user._id,
            created: new Date(),
            createdBy: req.user._id
        };

        // We only want sysadmin or admin users to be able to select the reservoir account.
        if (req.user.role === 'sysadmin' && req.user.role === 'admin' && req.body._account) newAccessKey._account = req.body._account;

        // Lets make a new user :)
        let newAccessKeyObj = new schema.AccessKey(newReservoir);
        newAccessKeyObj.save((err, accessKey) => {
            if (err) return next(err);
            return res.json(res.skeJsonResponse(null, { accessKey: accessKey }));
        });
    });
});

module.exports = router;
