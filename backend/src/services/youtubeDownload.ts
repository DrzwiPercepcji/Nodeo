import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { setMediaJobProgress } from './processingProgress.js';

export interface YouTubeDownloadResult {
  filePath: string;
  title: string;
}

/**
 * Download best-quality audio from a YouTube URL using yt-dlp.
 * Returns the path to the downloaded file and the video title.
 * The caller is responsible for cleaning up the file.
 */
export async function downloadYouTubeAudio(
  mediaId: string,
  url: string,
  tempDir: string,
): Promise<YouTubeDownloadResult> {
  const title = await getYouTubeTitle(url);

  const filePrefix = `${mediaId}-yt`;
  const outputTemplate = join(tempDir, `${filePrefix}.%(ext)s`);

  setMediaJobProgress(mediaId, {
    stage: 'downloading',
    overall_percent: 1,
    current_sec: null,
    total_sec: null,
  });

  const args = [
    '--no-playlist',
    '-f', 'bestaudio',
    '-o', outputTemplate,
    '--no-check-certificates',
    '--no-cache-dir',
    url,
  ];

  await new Promise<void>((resolve, reject) => {
    const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderrBuf = '';

    proc.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderrBuf += text;
      const match = text.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
      if (match) {
        const dlPct = parseFloat(match[1]);
        const overall = Math.max(1, Math.min(15, Math.round(dlPct * 0.15)));
        setMediaJobProgress(mediaId, {
          stage: 'downloading',
          overall_percent: overall,
          current_sec: null,
          total_sec: null,
        });
      }
    });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`yt-dlp exited with code ${code}: ${stderrBuf.slice(-500)}`));
    });

    proc.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error('yt-dlp is not installed. Install it with: pip install yt-dlp'));
      } else {
        reject(err);
      }
    });
  });

  const files = await readdir(tempDir);
  const downloaded = files.find((f) => f.startsWith(filePrefix));
  if (!downloaded) {
    throw new Error('yt-dlp completed but no output file found');
  }

  return { filePath: join(tempDir, downloaded), title };
}

async function getYouTubeTitle(url: string): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn('yt-dlp', ['--get-title', '--no-playlist', url], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0 && stdout.trim()) resolve(stdout.trim());
      else resolve('YouTube Import');
    });

    proc.on('error', () => resolve('YouTube Import'));
  });
}
