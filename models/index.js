const mongoose = require('mongoose');

module.exports = {
    User: mongoose.model("User", require("./userModel")),
    Account: mongoose.model("Account", require("./accountModel")),
    AccessKey: mongoose.model("AccessKey", require("./accessKeyModel")),
    Reservoir: mongoose.model('Reservoir', require('./reservoirModel')),
    ReservoirItem: mongoose.model('ReservoirItem', require('./reservoirItemModel')),
};