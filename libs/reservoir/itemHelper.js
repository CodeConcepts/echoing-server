const express = require('express');
const mongoose = require('mongoose');
const moment = require('moment');
const asynk = require('async');

class ItemHelper {
    constructor(item) {
        let self = this;

        if (!item)
            throw new Error("No item passed to ItemHelper constructor.");
        self.item = item;

        return self;
    }
    complete(reason, cb) {
        let self = this;

        self.item.completed = moment();
        self.item.compltedReason = reason;
        self.item.data = null;
        self.item.save((err, item) => {
            return cb(err, item);
        });
    }
    collected(accessKey, allAccessKeys, cb) {
        let self = this;

        self.item.collected.push({ _accessKey: accessKey, collected: moment().toDate() });

        // Lets assume all the access keys have collected the data, unless we find an access key that has not.
        let allCollected = true;
        for (let i = 0; i < allAccessKeys.length; i++) {
            let currentKey = self.item.collected.find(obj => obj._accessKey == allAccessKeys[i]._accessKey);
            if (!currentKey)
                allCollected = false;
        }

        // All the access keys have collected the data, now we can mark the item as completed.
        if (allCollected === true) {
            return self.completed('collected', cb);
        }

        else {
            self.item.save((err, item) => {
                return cb(err, item);
            });
        }
    }
};

module.exports = ItemHelper;