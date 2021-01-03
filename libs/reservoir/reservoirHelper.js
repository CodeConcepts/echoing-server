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
        
        // If the reason is expiered we need to increment the expired counter.
        if(item.completedReason === 'expired') {
            self.reservoir.expiredItemCount++;
        }

        self.reservoir.save((err, reservoir) => {
            if(err) return cb(err);

            if(!item.purged) {
                return cb(err, reservoir);
            } else {
                self.updateCurrentSize(item, (err) => {
                    return cb(err, reservoir);
                });
            }
        });
    }

    updateCurrentSize(item, cb) {
        let self = this;
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