/**
 * Created by brett on 01/11/2019.
 */
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var accountModel = new Schema({
    name: { type: String, required: true },
    address: {
        address1: { type: String, required: true },
        address2: { type: String },
        address3: { type: String },
        city: { type: String, required: true },
        county: { type: String, required: true },
        postcode: { type: String },
        country: { type: String, required: true }
    },
    billingEmailAddress: { type: String },
    maxUsers: { type: Number, default: 1, required: true },
    billedUsers: { type: Number, default: 0, required: true },
    userCount: { type: Number, default: 0 },
    billingPeriod: { type: String, enum: ["None", "Monthly", "Quarterly", "Annually"], required: true },
    lastPayment: { type: Schema.Types.ObjectId, ref: "Payment" },
    lastPaymentDate: { type: Date },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updated: { type: Date, required: true, default: Date.now },
    deleted: { type: Boolean, required: true, default: false },
    created: { type: Date, required: true, default: Date.now }
});

module.exports = accountModel;