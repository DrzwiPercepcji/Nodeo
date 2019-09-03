'use strict';

import { GraphQLSchema } from 'graphql';
import graphqlHTTP from 'express-graphql';

import queryType from './query';
import mutationType from './mutation';

export function init() {
    const schema = new GraphQLSchema({
        query: queryType,
        mutation: mutationType
    });

    return graphqlHTTP({
        schema: schema,
        graphiql: true
    });
}