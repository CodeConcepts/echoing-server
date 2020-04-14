var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res) {
  res.json({ status: "OK", message: "Welcome to the echoing.io API."});
});

module.exports = router;