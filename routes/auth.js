const express = require('express');
const router = express.Router();
const passport = require('passport');
const authenticate = require('../libs/middleware/authenticate');

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

module.exports = router;
