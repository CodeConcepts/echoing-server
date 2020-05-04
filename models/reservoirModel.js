/**
 * Created by brett on 01/11/2019.
 */
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var reservoirModel = new Schema({
    _account: {type: Schema.Types.ObjectId, ref: 'Account'},
    name: { type: String, required: true },
    accessType: { type: String, enum: ['public','private'], required: true, default: 'private' },
    maxItemSizeBytes: { type: Number, default: 128000, required: true },
    currentItemCount: { type: Number, default: 0, required: true },
    processedItemCount: { type: Number, default: 0, required: true },
    erroredItemCount: { type: Number, default: 0, required: true },
    expiredItemCount: { type: Number, default: 0, required: true },
    maxSizeBytes: { type: Number, default: 30000000, required: true },
    currentSizeBytes: { type: Number, default: 0, required: true },
    overflowStrategy: { type: String, enum: ['pause','old','new'], default: 'pause', required: true },
    strategy: { type: String, enum: ['fifo','filo'], required: true, default: 'fifo' },
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

module.exports = reservoirModel;