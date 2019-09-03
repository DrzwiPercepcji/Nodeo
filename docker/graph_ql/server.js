'use strict';

import mongoose from 'mongoose';
import express from 'express';
import dotenv from 'dotenv';

import { init as initGraphQLSchema } from './src/graphql';

const app = express();

dotenv.config();

mongoose.connect(process.env.MONGODB_URI, {
    promiseLibrary: require('bluebird')
});

app.use('/', initGraphQLSchema());

app.listen(process.env.PORT || 4000);