import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';

export interface TranscodeProfile {
  name: string;
  width: number;
  height: number;
  fps: number;
  videoBitrate: string;
  audioBitrate: string;
}

export const PROFILES: Record<string, TranscodeProfile> = {
  '480p': { name: '480p', width: 854, height: 480, fps: 30, videoBitrate: '1500k', audioBitrate: '128k' },
  '720p': { name: '720p', width: 1280, height: 720, fps: 30, videoBitrate: '3000k', audioBitrate: '192k' },
  '1080p': { name: '1080p', width: 1920, height: 1080, fps: 30, videoBitrate: '6000k', audioBitrate: '192k' },
  '1080p60': { name: '1080p60', width: 1920, height: 1080, fps: 60, videoBitrate: '8000k', audioBitrate: '192k' },
};

function runProcess(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}: ${stderr.slice(-500)}`));
    });
    proc.on('error', reject);
  });
}

export async function transcode(inputPath: string, outputPath: string, profileName: string): Promise<void> {
  const profile = PROFILES[profileName];
  if (!profile) throw new Error(`Unknown profile: ${profileName}`);

  const scale = `scale=${profile.width}:${profile.height}:force_original_aspect_ratio=decrease,pad=${profile.width}:${profile.height}:(ow-iw)/2:(oh-ih)/2`;

  await runProcess('ffmpeg', [
    '-y', '-i', inputPath,
    '-c:v', 'libx264', '-preset', 'medium',
    '-b:v', profile.videoBitrate, '-maxrate', `${parseInt(profile.videoBitrate) * 1.2}k`, '-bufsize', `${parseInt(profile.videoBitrate) * 2}k`,
    '-vf', scale,
    '-r', String(profile.fps),
    '-c:a', 'aac', '-b:a', profile.audioBitrate,
    '-movflags', '+faststart',
    outputPath,
  ]);
}

export async function generateThumbnail(inputPath: string, outputPath: string): Promise<void> {
  await runProcess('ffmpeg', [
    '-y', '-i', inputPath,
    '-ss', '00:00:03',
    '-vframes', '1',
    '-vf', 'scale=480:-1',
    '-q:v', '5',
    outputPath,
  ]);
}

export async function probeDuration(inputPath: string): Promise<number | null> {
  return new Promise((resolve) => {
    const proc = spawn('ffprobe', [
      '-v', 'quiet', '-print_format', 'json', '-show_format', inputPath,
    ]);
    let stdout = '';
    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.on('close', (code) => {
      if (code !== 0) { resolve(null); return; }
      try {
        const info = JSON.parse(stdout);
        resolve(Math.round(parseFloat(info.format?.duration ?? '0')));
      } catch { resolve(null); }
    });
    proc.on('error', () => resolve(null));
  });
}

export async function getFileSize(filePath: string): Promise<number> {
  const s = await stat(filePath);
  return s.size;
}
