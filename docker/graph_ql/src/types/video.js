'use strict';

import { GraphQLObjectType, GraphQLID, GraphQLString } from 'graphql';
import User from './user';

export default new GraphQLObjectType({
    name: 'Video',
    fields: () => ({
        id: { type: GraphQLID },
        name: { type: GraphQLString },
        user: { type: User }
    })
});