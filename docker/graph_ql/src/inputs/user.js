'use strict';

import { GraphQLInputObjectType, GraphQLString, GraphQLInt, GraphQLNonNull } from 'graphql';

export default new GraphQLInputObjectType({
    name: 'UserInput',
    fields: () => ({
        username: { type: new GraphQLNonNull(GraphQLString) },
        password: { type: new GraphQLNonNull(GraphQLString) },
        role: { type: GraphQLInt }
    })
});