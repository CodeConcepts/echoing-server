/**
 * Created by brett on 01/11/2019.
 */
const mongoose = require('mongoose');
const crypto = require('crypto');
const Schema = mongoose.Schema;

let userModel = new Schema({
    username: {type: String, required: true},
    forename: {type: String},
    surname: {type: String},
    emailAddress: {type: String, required: true},
    password: {type: String},
    passwordSalt: {type: String},
    passwordFormat: {type: String, enum: ['text', 'hash'], default: 'hash'},
    passwordReset: {type: Boolean, default: false},
    role: {type: String, enum: ['user', 'sysadmin'], default: 'user', required: true},
    loginMessage: {type: String},
    lastLogin: {type: Date},
    active: {type: Boolean, default: false},
    updatedBy: {type: Schema.Types.ObjectId, ref: 'User'},
    updated: {type: Date, required: true, default: Date.now},
    createdBy: {type: Schema.Types.ObjectId, ref: 'User'},
    created: {type: Date, required: true, default: Date.now}
});

userModel
    .virtual('hash_password')
    .set(function(password) {
        this._password = password;
        this.passwordSalt = this.makeSalt();
        this.passwordFormat = 'hash';
        this.password = this.encryptPassword(password);
    })
    .get(function() { return this._password});

userModel.methods = {
    authenticate: function (plainText) {
        if(this.passwordFormat === 'hash') return this.encryptPassword(plainText) === this.password;
        else return plainText === this.password;
    },
    makeSalt: function () {
        return Math.round((new Date().valueOf() * Math.random())) + '';
    },
    encryptPassword: function (password) {
        if (!password) return '';
        try {
            return crypto
                .createHmac('sha1', this.passwordSalt)
                .update(password)
                .digest('hex');
        } catch (err) {
            return '';
        }
    },
    skipValidation: function() {
        return ~oAuthTypes.indexOf(this.provider);
    }
};

module.exports = userModel;