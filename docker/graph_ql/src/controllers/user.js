'use strict';

import mongoose from 'mongoose';
import User from '../models/user';

export function getUserById(root, { id }) {
    return User.findById(new mongoose.Types.ObjectId(id)).populate('videos');
}

export function getUsers() {
    return User.find().populate('videos').exec();
}

export function createUser(root, { input }) {
    let user = new User(input);
    user.password = user.generateHash(input.password);
    return user.save();
}

export async function createToken(root, { input }) {
    let user = await User.find({ username: input.username });

    if (!user) {
        throw new Error('User does not exist.');
    }

    if (!user.validatePassword(input.password)) {
        throw new Error('User does not exist.');
    }

    return user;
}