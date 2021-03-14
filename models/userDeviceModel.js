/**
 * Created by brett on 01/11/2019.
 */
var mongoose = require('mongoose');
const hat = require('hat');
var Schema = mongoose.Schema;

var userDeviceModel = new Schema({
    _user: {type: Schema.Types.ObjectId, ref: 'User'},
    name: { type: String, required: true },
    arch: { type: String, required: true },
    platform: { type: String, required: true },
    secret: { type: String, required: true },
    key: { type: String, required: true, default: hat(), index: true },
    lastLogin: { type: Date, default: Date.now },
    created: { type: Date, required: true, default: Date.now }
});

module.exports = userDeviceModel;