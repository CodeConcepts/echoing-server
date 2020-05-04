const express = require('express');
const authenticate = require('../../libs/middleware/authenticate');
const router = express.Router();
const schema = require('../../models');


// GET accounts
router.get('/', authenticate({ roles: ['sysadmin','admin']}), function(req, res, next) {
    let search = { deleted: false };
    let limit = (req.query.limit) ? req.query.limit : 50;
    let offset = (req.query.offset) ? req.query.offset : 0;
    if(req.query.search) {
        search['name'] = new RegExp(req.query.search, 'i');
    }

    schema.Account.find(search).skip(offset).limit(limit).exec(function(err, accounts) {
        if(err) return next(err);
        return res.json(res.skeJsonResponse(null, { accounts: accounts, total: accounts.length }));
    });
});

/* GET account by id */
router.get('/:id', authenticate({ account: { param: "id" } }), function(req, res, next) {
    schema.Account.findOne({ _id: req.params.id }, function(err, account) {
        if(err) return next(err);
        return res.json(res.skeJsonResponse(null, account));
    });
});

router.delete('/:id', authenticate({ roles: ['sysadmin','admin'] }), function(req, res, next) {
    // TODO: We should tidy up all the artifacts that are allocated to this user
    // and either reallocated them to another user or delete them.
    schema.Account.findOneAndUpdate({ _id: req.params.id }, { deleted: true }).exec(function(err) {
        if(err) return next(err);
        return res.json(res.skeJsonResponse(null));
    });
});

/* PUT update a user */
router.put('/', authenticate({ account: { body: "id" } }), function(req, res, next) {
    // The account must already have a valid id in the body,
    // otherwise the authentication would fail.
    if(!req.body.id && req.body._id) req.body.id = req.body._id;

    let updatedAccount = {
        updated: new Date(),
        updatedBy: req.user._id
    };

    if(req.body.name) updatedAccount.name = req.body.name
    if(req.body.address) {
        updatedAccount.address = {
            address1: req.body.address.address1,
            address2: req.body.address.address2,
            address3: req.body.address.address3,
            city: req.body.address.city,
            county: req.body.address.county,
            postcode: req.body.address.postcode,
            country: req.body.address.country
        }
    }

    // Sysadmin and admin users can change the number of max and billed users.
    if((['sysadmin','admin']).indexOf(req.user.role) >= 0)
    {
        updatedAccount.billingPeriod = req.body.billingPeriod;
        updatedAccount.maxUsers = req.body.maxUsers;
        updatedAccount.billedUsers = req.body.billedUsers;
    }

    // Lets do the update.
    schema.Account.updateOne({ _id: req.body.id }, newAccount, function(err, user) {
        if(err) return next(err);
        return res.json(res.skeJsonResponse(null, "Account Updated."));
    });
});

/* POST create a account */
/* This will be handle via the registration pages. */
/* PUT update a user */
router.post('/', authenticate({ roles: ['sysadmin','admin'] }), function(req, res, next) {
    // The account must already have a valid id in the body,
    // otherwise the authentication would fail.
    let newAccount = {
        updated: new Date(),
        updatedBy: req.user._id
    };

    if(req.body.name) newAccount.name = req.body.name
    if(req.body.address) {
        newAccount.address = {
            address1: req.body.address.address1,
            address2: req.body.address.address2,
            address3: req.body.address.address3,
            city: req.body.address.city,
            county: req.body.address.county,
            postcode: req.body.address.postcode,
            country: req.body.address.country
        }
    };

    newAccount.billingPeriod = req.body.billingPeriod;
    newAccount.maxUsers = req.body.maxUsers;
    newAccount.billedUsers = req.body.billedUsers;

    // Lets create a new account
    let accountObj = new schema.Account(newAccount);
    accountObj.save(function(err, account) {
        if(err) return next(err);
        return res.json(res.skeJsonResponse(null, "Account Created."));
    });
});

module.exports = router;