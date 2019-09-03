'use strict';

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const Schema = mongoose.Schema;
const SchemaObjectId = Schema.Types.ObjectId;

const UserSchema = new Schema({
    username: { type: String, required: true, max: 100, unique: true },
    password: { type: String, required: true },
    token: { type: String, unique: true },
    role: { type: Number, required: true, default: 0 },
    videos: [{ type: SchemaObjectId, ref: 'Video' }]
});

UserSchema.methods.generateHash = function (password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

UserSchema.methods.validatePassword = function (password) {
    return bcrypt.compareSync(password, this.local.password);
};

export default mongoose.model('User', UserSchema);