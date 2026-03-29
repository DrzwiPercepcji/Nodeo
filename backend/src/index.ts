import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import config from './config.js';
import migrate from './db/migrate.js';
import authRoutes from './routes/auth.js';
import collectionsRoutes from './routes/collections.js';
import mediaRoutes from './routes/media.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(morgan('short'));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/openapi.yaml', (_req, res) => {
  const spec = readFileSync(join(__dirname, 'openapi.yaml'), 'utf-8');
  res.type('text/yaml').send(spec);
});

app.use('/api/auth', authRoutes);
app.use('/api/collections', collectionsRoutes);
app.use('/api', mediaRoutes);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack || err.message);
  res.status(500).json({ error: 'Internal server error' });
});

async function start(): Promise<void> {
  console.log('Running database migrations...');
  await migrate();

  app.listen(config.port, () => {
    console.log(`Nodeo backend listening on port ${config.port}`);
  });
}

start().catch((err: Error) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
