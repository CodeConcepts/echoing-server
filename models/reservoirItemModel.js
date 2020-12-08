/**
 * Created by brett on 01/11/2019.
 */
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var reservoirItemModel = new Schema({
    _reservoir: {type: Schema.Types.ObjectId, ref: 'Reservoir'},
    _accessKey: {type: Schema.Types.ObjectId, ref: 'AccessKey'},
    metaData: { type: Schema.Types.Mixed, required: false },
    remoteId: { type: String, required: false },
    itemSizeBytes: { type: Number, default: 0, required: true },
    expiryMs: { type: Number, default: 0, required: true },
    mimeType: { type: String, required: true },
    data: { type: Schema.Types.Buffer },
    collected: [
        {
            _accessKey: { type: Schema.Types.ObjectId, ref: 'AccessKey' },
            collected: { type: Date, required: true }
        }
    ],
    completed: { type: Date },
    completedReason: { type: String, enum: ['expired','delivered','deleted'] },
    created: { type: Date, required: true, default: Date.now }
});

module.exports = reservoirItemModel;