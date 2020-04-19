const mongoose = require('mongoose');

module.exports = {
    User: mongoose.model("User", require("./userModel")),
    Account: mongoose.model("Account", require("./accountModel"))
};