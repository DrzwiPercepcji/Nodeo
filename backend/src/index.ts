import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import config from './config.js';
import migrate from './db/migrate.js';
import authRoutes from './routes/auth.js';
import collectionsRoutes from './routes/collections.js';
import mediaRoutes from './routes/media.js';
import importRoutes from './routes/import.js';
import { disconnectStreamCache } from './services/streamCache.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(morgan('short'));
app.use(express.json({ limit: '1mb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.auth.loginRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, try again in 15 minutes' },
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/openapi.yaml', (_req, res) => {
  const spec = readFileSync(join(__dirname, 'openapi.yaml'), 'utf-8');
  res.type('text/yaml').send(spec);
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/collections', collectionsRoutes);
app.use('/api', mediaRoutes);
app.use('/api', importRoutes);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack || err.message);
  const status = 'status' in err ? (err as { status: number }).status : 500;
  res.status(status).json({ error: config.nodeEnv === 'production' ? 'Internal server error' : err.message });
});

async function start(): Promise<void> {
  console.log('Running database migrations...');
  await migrate();

  app.listen(config.port, () => {
    console.log(`Nodeo backend listening on port ${config.port} [${config.nodeEnv}]`);
  });
}

function shutdownSignal(sig: string): void {
  process.on(sig, () => {
    void disconnectStreamCache().finally(() => process.exit(0));
  });
}
shutdownSignal('SIGTERM');
shutdownSignal('SIGINT');

start().catch((err: Error) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
