'use strict';

import { GraphQLObjectType, GraphQLID, GraphQLString, GraphQLInt, GraphQLList } from 'graphql';
import Video from './video';

export default new GraphQLObjectType({
    name: 'User',
    fields: () => ({
        id: { type: GraphQLID },
        username: { type: GraphQLString },
        password: { type: GraphQLString },
        role: { type: GraphQLInt },
        videos: { type: new GraphQLList(Video) }
    })
});