/**
 * Created by brett on 01/11/2019.
 */
const mongoose = require('mongoose');
const crypto = require('crypto');
const Schema = mongoose.Schema;

let accessKeyModel = new Schema({
    _account: {type: Schema.Types.ObjectId, ref: 'Account'},
    _reservoir: {type: Schema.Types.ObjectId, ref: 'Reservoir'},
    _user: {type: Schema.Types.ObjectId, ref: 'User'},
    access: { type: String, enum: ['read','write','full'], required: true, default: 'read'},
    active: {type: Boolean, default: false},
    lastRead: {type: Date},
    lastWrite: {type: Date},
    notification: {
        errors: { type: Boolean, default: false },
        events: { type: Boolean, default: false },
        status: { type: Boolean, default: false }
    },
    channels: {
        email: { type: Boolean, default: false },
        app: { type: Boolean, defaults: false },
        web: { type: Boolean, defaults: false },
        sms: { type: Boolean, defaults: false }
    },
    updatedBy: {type: Schema.Types.ObjectId, ref: 'User'},
    updated: {type: Date, required: true, default: Date.now},
    createdBy: {type: Schema.Types.ObjectId, ref: 'User'},
    created: {type: Date, required: true, default: Date.now}
});

module.exports = accessKeyModel;