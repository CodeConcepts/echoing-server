/**
 * Created by brett on 01/11/2019.
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Sentencer = require('sentencer');
const titleCase = require("title-case").titleCase;



let reservoirModel = new Schema({
    _account: {type: Schema.Types.ObjectId, ref: 'Account'},
    name: { type: String, required: true, default: getDefaultName() },
    status: { type: String, enum: ['active','inactive','paused','deleted'], required: true, default: 'active' },
    accessType: { type: String, enum: ['public','private'], required: true, default: 'private' },
    accessMethod: { type: String, enum: ['fifo','lifo'], required: true, default: 'fifo' },
    maxItemSizeBytes: { type: Number, default: 128000, required: true },
    currentItemCount: { type: Number, default: 0, required: true },
    processedItemCount: { type: Number, default: 0, required: true },
    erroredItemCount: { type: Number, default: 0, required: true },
    expiredItemCount: { type: Number, default: 0, required: true },
    maxSizeBytes: { type: Number, default: 30000000, required: true },
    currentSizeBytes: { type: Number, default: 0, required: true },
    overflowStrategy: { type: String, enum: ['break','pause','old','new'], default: 'break', required: true },
    defaultExpiryMs: { type: Number, default: 0, required: true },
    defaultRetentionMs: { type: Number, default: 0, required: true },
    restrictions: {
        ipAddress: [{ type: String }],
        httpRefer: [{ type: String }],
    },
    isTransient: { type: Boolean, required: true, default: false },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updated: { type: Date, required: true, default: Date.now },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User'},
    deleted: { type: Boolean, required: true, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User'},
    created: { type: Date, required: true, default: Date.now }
});

function getDefaultName() {
    let adjective = titleCase(Sentencer.make("{{ adjective }}"));
    let noun = titleCase(Sentencer.make("{{ noun }}"));
    let adjective2 = titleCase(Sentencer.make("{{ adjective }}"));

    return adjective + noun + adjective2;
}

module.exports = reservoirModel;