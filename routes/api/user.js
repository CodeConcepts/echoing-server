const express = require('express');
const generator = require('generate-password');
const moment = require('moment');
const authenticate = require('../../libs/middleware/authenticate');
const router = express.Router();
const schema = require('../../models');

const EmailSender = require('../../libs/email/email-sender');
const pjson = require('../../app.config.json');

// PUT Update user password
router.put('/password',authenticate({ user: { body: "id" } }), function(req, res, next) {
    // The user must already have a valid id in the body,
    // otherwise the authentication would fail.
    let updatedUser = {
        updated: new Date(),
        updatedBy: req.user._id,
        hash_password: req.body.password
    };

    // Lets do the update.
    schema.User.updateOne({ _id: req.body.id }, updatedUser, function(err) {
        if(err) return next(err);
        return res.json(res.skeJsonResponse(null, "User password changed."));
    });
});

// GET users
router.get('/', authenticate({ roles: ['sysadmin']}), function(req, res, next) {
    let search = {};
    let limit = (req.query.limit) ? parseInt(req.query.limit) : 50;
    let offset = (req.query.offset) ? parseInt(req.query.offset) : 0;
    if(req.query.search) {
        search['$or'] = [
            { username: new RegExp(req.query.search, 'i') },
            { emailAddress: new RegExp(req.query.search, 'i') },
            { forename: new RegExp(req.query.search, 'i') },
            { surname: new RegExp(req.query.search, 'i') }
        ];
    }

    schema.User.find(search).skip(offset).limit(limit).exec(function(err, users) {
        if(err) return next(err);
        schema.User.countDocuments(search, function(err, count) {
            if(err) return next(err);
            let safeUsers = [];

            users.forEach(function(user) {
                let safeUser = user.toObject();
                safeUser.password = undefined;
                safeUser.passwordSalt = undefined;
                safeUser.passwordFormat = undefined;
                safeUsers.push(safeUser);
            });

            return res.json(res.skeJsonResponse(null, { users: safeUsers, total: count }));
        });
    });
});

router.get('/roles', authenticate(), function(req, res){
    let roles = [{ value:'user', text: 'User' }];

    if(['sysadmin'].indexOf(req.user.role) >= 0)
    {
        roles = [...roles, { value: 'sysadmin', text: 'System Administrator' }];
    }

    res.json(res.skeJsonResponse(null, roles));
});

/* GET user by id */
router.get('/:id/invite', function(req, res, next) {
    schema.User.findOne({ _id: req.params.id }, function(err, user) {
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

/* GET user by id */
router.get('/:id', authenticate({ user: { param: "id" } }), function(req, res, next) {
    schema.User.findOne({ _id: req.params.id }, function(err, user) {
        if(err) return next(err);

        let safeUser = user.toObject();
        safeUser.password = undefined;
        safeUser.passwordSalt = undefined;
        safeUser.passwordFormat = undefined;

        return res.json(res.skeJsonResponse(null, safeUser));
    });
});

router.delete('/:id', authenticate({ roles: ['sysadmin'] , user: { param: "id" } }), function(req, res, next) {
    // TODO: We should tidy up all the artifacts that are allocated to this user
    // and either reallocated them to another user or delete them.
    schema.User.deleteOne({ _id: req.params.id }, function(err) {
        if(err) return next(err);
        return res.json(res.skeJsonResponse(null));
    });
});

router.get('/:id/resend', authenticate({ roles: ['sysadmin'] , user: { param: "id" } }), function(req, res, next) {
    schema.User.findOne({ _id: req.params.id }, function(err, user) {
        if(err) return next(err);
        if(!user) return res.json(res.skeJsonResponse(new Error("Failed to re-send invite, unknown user.")));
        if(user.inviteStatus !== 'invited') return res.json(res.skeJsonResponse(new Error("Failed to re-send invite, incorrect invite status.")));

        user.inviteSent = new Date();
        user.save();

        const emailSender = new EmailSender();
        emailSender.sendMail("no-reply@echoing.io",
            user.emailAddress,
            "Echoing.io User Invite Request",
            "user-invite",
            {
                user: {
                    forename: user.forename,
                    surname: user.surname,
                    role: user.role,
                    emailAddress: user.emailAddress
                },
                links: {
                    confirm: pjson.guiUrl + "/#/invite?uid=" + user._id.toString()
                }
            }).then(() => {
            return res.json(res.skeJsonResponse(null, "User Invite re-sent."));
        });
    });
});

/* PUT accept user invite */
router.put('/accept', function(req, res, next) {
    // We have not authentication, as the user has not accepted the invite and does not know their password.
    if(!req.body.id && req.body._id) req.body.id = req.body._id;

    schema.User.findOne({ _id: req.body.id }, function(err, user) {
        if(err) return next(err);
        if(!user) return res.json(res.skeJsonResponse(new Error("Failed to accept invite, unknown user.")));
        if(user.inviteStatus !== 'invited') return res.json(res.skeJsonResponse(new Error("Failed to accept invite, incorrect invite status.")));
        if(moment().isAfter(moment(user.inviteSent).add(24, 'hours'))) return res.json(res.skeJsonResponse(new Error("Sorry your invite has expired, please ask for it to be sent again.")));

        user.hash_password = req.body.password;
        user.inviteStatus = 'accepted';
        user.inviteAccepted = new Date();

        user.save(function(err) {
            if(err) return next(err);
            return res.json(res.skeJsonResponse(null, "User Updated."));
        });
    });
});

/* PUT update a user */
router.put('/', authenticate({ user: { body: "id" } }), function(req, res, next) {
    // The user must already have a valid id in the body,
    // otherwise the authentication would fail.
    if(!req.body.id && req.body._id) req.body.id = req.body._id;

    let updatedUser = {
        updated: new Date(),
        updatedBy: req.user._id
    };

    if(req.body.active) updatedUser.active = req.body.active;
    if(req.body.username) updatedUser.username = req.body.username;
    if(req.body.emailAddress) updatedUser.emailAddress = req.body.emailAddress;
    if(req.body.forename) updatedUser.forename = req.body.forename;
    if(req.body.surname) updatedUser.surname = req.body.surname;

    if((['sysadmin']).indexOf(req.user.role) >= 0)
    {
        if(req.body.role) updatedUser.role = req.body.role;
    }

    // Lets do the update.
    schema.User.updateOne({ _id: req.body.id }, updatedUser, function(err) {
        if(err) return next(err);
        return res.json(res.skeJsonResponse(null, "User Updated."));
    });
});

/* POST create a user */
router.post('/', authenticate({ roles: ['sysadmin','admin','manager'] }), function(req, res, next) {
    let newUser = {
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
                emailSender.sendMail("no-reply@sidekickengine.com",
                    newUser.emailAddress,
                    "SidekickEngine User Invite Request",
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
                            confirm: pjson.guiUrl + "/#/invite?uid=" + user._id.toString()
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
