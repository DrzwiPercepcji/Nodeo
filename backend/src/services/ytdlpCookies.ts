import { join } from 'node:path';
import config from '../config.js';

export function getYtdlpCookiesPath(): string {
  return join(config.dataDir, 'ytdlp-cookies.txt');
}
