'use strict';

import { GraphQLInputObjectType, GraphQLString, GraphQLNonNull } from 'graphql';

export default new GraphQLInputObjectType({
    name: 'VideoInput',
    fields: () => ({
        name: { type: new GraphQLNonNull(GraphQLString) }
    })
});