const express = require('express');
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

    if(req.query.search) {
        search['$or'] = [
            { "_reservoir.name": new RegExp(req.query.search, 'i') },
        ];
    }

    if(!search['$or']) search['$or'] = [];
    if(['sysadmin','admin','manager'].indexOf(req.user.role) >= 0) {
        if(req.user.role == 'manager') search['$or'].push({ '_account._id':  req.user._account });

        search = {
            "deleted": false,
            "_account.deleted": false
        };

        schema.Reservoir.populate('_account').find(search).skip(offset).limit(limit).exec(function(err, reservoirs) {
            if (err) return next(err);
            schema.Reservoir.populate('_account').countDocuments(search, function (err, count) {
                return res.json(res.skeJsonResponse(null, { users: reservoirs, total: count }));
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
                let reservoirs = [];

                asynk.eachSeries(accessKeys, (accessKey, nextKey) => {
                        reservoirs.push(accessKey._reservoir.toObject());
                        return nextKey;
                    },
                    (err) => {
                        if(err) return next(err);
                        return res.json(res.skeJsonResponse(null, { users: reservoirs, total: count }));
                    });
            });
        });
    }
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

        return res.json(res.skeJsonResponse(null, accessKey._reservoir));
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
        if(accessKey.access !== 'full') return res.send(401, "Unauthorised: You do not have the correct permissions to delete this item.");
        if(!accessKey.access) return res.json(res.skeJsonResponse(new Error("Failed to locate reservoir.")));

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
                        return res.json(res.skeJsonResponse(null));
                    });
                })
            });
        });
    });
});

/* PUT update a user */
router.put('/', authenticate({ roles: ['sysadmin','admin','manager','user']}), function(req, res, next) {
    // The user must have a valid id in the body,
    if(!req.body.id && req.body._id) req.body.id = req.body._id;
    if(!req.body.id) return res.json(res.skeJsonResponse(new Error("Failed to locate reservoir.")));

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
        if(accessKey.access !== 'write' || accessKey.access !== 'full') return res.send(401, "Unauthorised: You do not have the correct permissions to update this item.");
        if(!accessKey.access) return res.json(res.skeJsonResponse(new Error("Failed to locate reservoir.")));

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
                return res.json(res.skeJsonResponse(null));
            });
        });
    });
});

/* POST create a user */
router.post('/', authenticate({ roles: ['sysadmin','admin','manager','user'] }), function(req, res, next) {
    let newUser = {
        _account: req.body._account,
        emailAddress: req.body.emailAddress,
        forename: req.body.forename,
        surname: req.body.surname,
        username: req.body.username,
        hash_password: req.body.password,
        updated: new Date(),
        updatedBy: req.user._id,
        created: new Date(),
        createdBy: req.user._id,
        active: true,
        role: 'user'
    };

    // We only want sysadmin or admin users to be able to select the user account.
    if((req.user.role !== 'sysadmin' && req.user.role !== 'admin') || !req.body._account) newUser._account = req.user._account;

    if(req.user.role === 'manager') {
        // If the user is a account manager, then they can create new account managers.
        if(req.body.role === 'manager') newUser.role = 'manager';

        // We also need to join the new user to the managers account
        newUser._account = req.user._account;
    }

    // If the user is an super/admin then they can make any user type for client accounts (user or manager).
    if(req.user.role === 'admin' || req.user.role === 'sysadmin')
    {
        if(req.body.role === 'manager') newUser.role = 'manager';
        newUser._account = req.body._account;
    }

    // If the user is a super admin then they can create more super & admin users
    if(req.user.role === 'sysadmin' && (req.body.role === 'sysadmin' || req.body.role === 'admin'))
    {
        newUser.role = req.body.role;
    }

    if(req.body.emailInvite === true)
    {
        newUser.hash_password = generator.generate({
            length: 30,
            numbers: true,
            symbols: true,
            uppercase: true,
            strict: true
        });
        newUser.inviteSent = new Date();
        newUser.inviteStatus = 'invited';
    }

    // Lets make a new user :)
    let newUserObj = new schema.User(newUser);
    newUserObj.save(function(err, user) {
        if(err) return next(err);

        if(req.body.emailInvite === true)
        {
            user.populate("_account", (err, user) =>
            {
                const emailSender = new EmailSender();
                emailSender.sendMail("no-reply@echoing.io",
                    newUser.emailAddress,
                    "Echoing.io User Invite Request",
                    "user-invite",
                    {
                        user: {
                            forename: user.forename,
                            surname: user.surname,
                            role: user.role,
                            emailAddress: user.emailAddress
                        },
                        account: user._account,
                        links: {
                            confirm: pjson.echoing.guiUrl + "/#/invite?uid=" + user._id.toString()
                        }
                    }).then(() => {
                    return res.json(res.skeJsonResponse(null, "User created & Invite Sent."));
                }, () => {
                    return res.json(res.skeJsonResponse(null, "User created, but the invite was not sent."));
                });
            });
        }
        else {
            return res.json(res.skeJsonResponse(null, "User created."));
        }
    });
});

module.exports = router;
