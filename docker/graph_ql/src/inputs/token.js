'use strict';

import { GraphQLInputObjectType, GraphQLString, GraphQLNonNull } from 'graphql';

export default new GraphQLInputObjectType({
    name: 'TokenInput',
    fields: () => ({
        username: { type: new GraphQLNonNull(GraphQLString) },
        password: { type: new GraphQLNonNull(GraphQLString) }
    })
});