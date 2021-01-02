const express = require('express');
const mongoose = require('mongoose');
const moment = require('moment');
const asynk = require('async');

class ReservoirHelper {
    constructor(reservoir) {
        let self = this;

        if (!reservoir)
            throw new Error("No item passed to ReservoirHelper constructor.");
        self.reservoir = reservoir;

        return self;
    }

    incrementErrors(cb) {
        let self = this;
        
        self.reservoir.erroredItemCount++;
        self.reservoir.save((err, reservoir) => {
            return cb(err, reservoir);
        });
    }

    incrementProcessed(item, cb) {
        let self = this;
        
        self.reservoir.processedItemCount++;
        self.reservoir.currentItemCount--;
        self.reservoir.currentSizeBytes -= item.itemSizeBytes;
        self.reservoir.save((err, reservoir) => {
            return cb(err, reservoir);
        });
    }

    incrementCurrent(item, cb) {
        let self = this;
        
        self.reservoir.currentSizeBytes += item.itemSizeBytes;
        self.reservoir.currentItemCount++;
        self.reservoir.save((err, reservoir) => {
            return cb(err, reservoir);
        });
    }
};

module.exports = ReservoirHelper;