/**
 * Created by brett on 30/06/2020.
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let accessInviteModel = new Schema({
    _account: {type: Schema.Types.ObjectId, ref: 'Account'},
    _reservoir: {type: Schema.Types.ObjectId, ref: 'Reservoir'},
    _sender: {type: Schema.Types.ObjectId, ref: 'User'},
    _user: {type: Schema.Types.ObjectId, ref: 'User'},
    emailAddress: { type: String, required: true },
    access: { type: String, enum: ['read','write','full'], required: true, default: 'read'},
    status: { type: String, enum: ['sent','accepted','rejected','bounced','disabled'], default: 'sent', required: true },
    updatedBy: {type: Schema.Types.ObjectId, ref: 'User'},
    updated: {type: Date, required: true, default: Date.now},
    createdBy: {type: Schema.Types.ObjectId, ref: 'User'},
    created: {type: Date, required: true, default: Date.now}
});

module.exports = accessInviteModel;