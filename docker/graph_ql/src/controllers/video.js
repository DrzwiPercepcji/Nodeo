'use strict';

import mongoose from 'mongoose';

import Video from '../models/video';
import User from '../models/user';

export function getVideoById(root, { id }) {
    return Video.findById(new mongoose.Types.ObjectId(id)).populate('user');
}

export function getVideos() {
    return Video.find().populate('user').exec();
}

export async function createVideo(root, { input, userId }) {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const user = await User.findById(userObjectId);

    if (!user) {
        throw new Error('User does not exist.');
    }

    input.user = userObjectId;
    const video = await new Video(input).save();

    user.videos.push(video);
    await user.save();

    return getVideoById(null, video);
}