'use strict';

import mongoose from 'mongoose';

const Schema = mongoose.Schema;
const SchemaObjectId = Schema.Types.ObjectId;

const VideoSchema = new Schema({
    name: { type: String, required: true, max: 100 },
    user: { type: SchemaObjectId, ref: 'User' },
    private: { type: Boolean, required: false, default: true },
});

export default mongoose.model('Video', VideoSchema);