'use strict';

import { GraphQLObjectType, GraphQLID, GraphQLNonNull } from 'graphql';

import userType from './types/user';
import videoType from './types/video';

import userInput from './inputs/user';
import tokenInput from './inputs/token';
import videoInput from './inputs/video';

import { createUser, createToken } from './controllers/user';
import { createVideo } from './controllers/video';

export default new GraphQLObjectType({
    name: 'Mutation',
    description: 'Root type for mutations',
    fields: {
        createUser: {
            type: userType,
            description: 'Create a new user',
            args: { input: { type: userInput } },
            resolve: createUser
        },
        createToken: {
            type: userType,
            description: 'Create a new token',
            args: { input: { type: tokenInput } },
            resolve: createToken
        },
        createVideo: {
            type: videoType,
            description: 'Create a new video',
            args: {
                userId: { type: new GraphQLNonNull(GraphQLID) },
                input: { type: videoInput }
            },
            resolve: createVideo
        }
    }
});