const mongoose = require('mongoose');

module.exports = {
    User: mongoose.model("User", require("./userModel")),
    UserDevice: mongoose.model("UserDevice", require("./userDeviceModel")),
    Account: mongoose.model("Account", require("./accountModel")),
    AccessKey: mongoose.model("AccessKey", require("./accessKeyModel")),
    AccessInvite: mongoose.model("AccessInvite", require("./accessInviteModel")),
    Reservoir: mongoose.model('Reservoir', require('./reservoirModel')),
    ReservoirItem: mongoose.model('ReservoirItem', require('./reservoirItemModel')),
};