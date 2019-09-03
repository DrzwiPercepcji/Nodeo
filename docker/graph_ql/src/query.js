'use strict';

import { GraphQLObjectType, GraphQLID, GraphQLList } from 'graphql';

import user from './types/user';
import video from './types/video';

import { getUsers, getUserById } from './controllers/user';
import { getVideos, getVideoById } from './controllers/video';

export default new GraphQLObjectType({
    name: 'Query',
    description: 'Root type for queries',
    fields: {
        users: {
            type: new GraphQLList(user),
            description: 'List of all users',
            resolve: getUsers
        },
        user: {
            type: user,
            description: 'Get user by ID',
            args: { id: { type: GraphQLID } },
            resolve: getUserById
        },
        videos: {
            type: new GraphQLList(video),
            description: 'List of all videos',
            resolve: getVideos
        },
        video: {
            type: video,
            description: 'Get video by ID',
            args: { id: { type: GraphQLID } },
            resolve: getVideoById
        }
    }
});