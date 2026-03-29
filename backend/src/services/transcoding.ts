import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';

export interface TranscodeProfile {
  name: string;
  type: 'video' | 'audio';
  width?: number;
  height?: number;
  fps?: number;
  videoBitrate?: string;
  audioBitrate: string;
  audioCodec?: string;
}

export const VIDEO_PROFILES: Record<string, TranscodeProfile> = {
  '480p': { name: '480p', type: 'video', width: 854, height: 480, fps: 30, videoBitrate: '1500k', audioBitrate: '128k' },
  '720p': { name: '720p', type: 'video', width: 1280, height: 720, fps: 30, videoBitrate: '3000k', audioBitrate: '192k' },
  '1080p': { name: '1080p', type: 'video', width: 1920, height: 1080, fps: 30, videoBitrate: '6000k', audioBitrate: '192k' },
  '1080p60': { name: '1080p60', type: 'video', width: 1920, height: 1080, fps: 60, videoBitrate: '8000k', audioBitrate: '192k' },
};

export const AUDIO_PROFILES: Record<string, TranscodeProfile> = {
  'mp3-128': { name: 'mp3-128', type: 'audio', audioBitrate: '128k', audioCodec: 'libmp3lame' },
  'mp3-192': { name: 'mp3-192', type: 'audio', audioBitrate: '192k', audioCodec: 'libmp3lame' },
  'mp3-320': { name: 'mp3-320', type: 'audio', audioBitrate: '320k', audioCodec: 'libmp3lame' },
  'aac-256': { name: 'aac-256', type: 'audio', audioBitrate: '256k', audioCodec: 'aac' },
};

export const PROFILES: Record<string, TranscodeProfile> = { ...VIDEO_PROFILES, ...AUDIO_PROFILES };

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

/** Parse ffmpeg stderr progress `time=HH:MM:SS.xx`. */
export function parseFfmpegTimeSeconds(line: string): number | null {
  const m = line.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const s = parseFloat(m[3]);
  if (Number.isNaN(h) || Number.isNaN(min) || Number.isNaN(s)) return null;
  return h * 3600 + min * 60 + s;
}

export type TranscodeProgressCb = (info: { ffmpegPercent: number; currentSec: number }) => void;

async function runFfmpeg(
  args: string[],
  onStderrLine?: (line: string) => void,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    let carry = '';
    proc.stderr.on('data', (chunk: Buffer) => {
      const piece = chunk.toString();
      stderr += piece;
      if (!onStderrLine) return;
      const text = carry + piece;
      const lines = text.split('\n');
      carry = lines.pop() ?? '';
      for (const line of lines) onStderrLine(line);
    });
    proc.on('close', (code) => {
      if (carry && onStderrLine) onStderrLine(carry);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
    });
    proc.on('error', reject);
  });
}

export async function transcodeVideo(
  inputPath: string,
  outputPath: string,
  profileName: string,
  progress?: { durationSec: number | null; onProgress: TranscodeProgressCb },
): Promise<void> {
  const profile = VIDEO_PROFILES[profileName];
  if (!profile) throw new Error(`Unknown video profile: ${profileName}`);

  const scale = `scale=${profile.width}:${profile.height}:force_original_aspect_ratio=decrease,pad=${profile.width}:${profile.height}:(ow-iw)/2:(oh-ih)/2`;

  const args = [
    '-y', '-i', inputPath,
    '-c:v', 'libx264', '-preset', 'medium',
    '-b:v', profile.videoBitrate!, '-maxrate', `${parseInt(profile.videoBitrate!) * 1.2}k`, '-bufsize', `${parseInt(profile.videoBitrate!) * 2}k`,
    '-vf', scale,
    '-r', String(profile.fps),
    '-c:a', 'aac', '-b:a', profile.audioBitrate,
    '-movflags', '+faststart',
    outputPath,
  ];

  const dur = progress?.durationSec;
  if (progress && dur !== null && dur !== undefined && dur > 0) {
    await runFfmpeg(args, (line) => {
      const t = parseFfmpegTimeSeconds(line);
      if (t === null) return;
      const ffmpegPercent = Math.min(99, Math.round((t / dur) * 100));
      progress.onProgress({ ffmpegPercent, currentSec: t });
    });
  } else {
    await runFfmpeg(args);
  }
}

export async function transcodeAudio(
  inputPath: string,
  outputPath: string,
  profileName: string,
  progress?: { durationSec: number | null; onProgress: TranscodeProgressCb },
): Promise<void> {
  const profile = AUDIO_PROFILES[profileName];
  if (!profile) throw new Error(`Unknown audio profile: ${profileName}`);

  const args = [
    '-y', '-i', inputPath,
    '-vn',
    '-c:a', profile.audioCodec || 'libmp3lame',
    '-b:a', profile.audioBitrate,
    outputPath,
  ];

  const dur = progress?.durationSec;
  if (progress && dur !== null && dur !== undefined && dur > 0) {
    await runFfmpeg(args, (line) => {
      const t = parseFfmpegTimeSeconds(line);
      if (t === null) return;
      const ffmpegPercent = Math.min(99, Math.round((t / dur) * 100));
      progress.onProgress({ ffmpegPercent, currentSec: t });
    });
  } else {
    await runFfmpeg(args);
  }
}

/** Number of preview frames extracted along the timeline (video only). */
export const THUMB_FRAME_COUNT = 5;

const THUMB_SEEK_RATIOS = [0.04, 0.12, 0.28, 0.52, 0.78];

/** Seek positions in seconds for thumbnail grabs (after duration is known). */
export function thumbSeekSeconds(durationSec: number | null | undefined): number[] {
  const d = typeof durationSec === 'number' && durationSec > 1 ? Math.floor(durationSec) : null;
  if (d !== null) {
    return THUMB_SEEK_RATIOS.map((r) => {
      const s = Math.floor(r * d);
      return Math.max(0, Math.min(s, d - 1));
    });
  }
  return [1, 2, 3, 5, 8];
}

/** Single frame at `seekSec` (fast seek: -ss before -i). */
export async function generateThumbnailAt(inputPath: string, outputPath: string, seekSec: number): Promise<void> {
  await runProcess('ffmpeg', [
    '-y', '-ss', String(seekSec),
    '-i', inputPath,
    '-vframes', '1',
    '-vf', 'scale=480:-1',
    '-q:v', '5',
    outputPath,
  ]);
}

/** @deprecated Use {@link generateThumbnailAt} with duration-based seeks. */
export async function generateThumbnail(inputPath: string, outputPath: string): Promise<void> {
  await generateThumbnailAt(inputPath, outputPath, 3);
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

const AUDIO_MIMES = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/aac', 'audio/ogg',
  'audio/flac', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/x-m4a',
]);

const AUDIO_EXTENSIONS = new Set([
  '.mp3', '.m4a', '.aac', '.ogg', '.flac', '.wav', '.wma', '.opus', '.webm',
]);

export function detectMediaType(mimeType: string | undefined, originalName: string | undefined): 'video' | 'audio' {
  if (mimeType && AUDIO_MIMES.has(mimeType.toLowerCase())) return 'audio';
  if (originalName) {
    const ext = originalName.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (ext && AUDIO_EXTENSIONS.has(ext)) return 'audio';
  }
  return 'video';
}

export function outputExtension(mediaType: 'video' | 'audio', profileName: string): string {
  if (mediaType === 'video') return '.mp4';
  const profile = AUDIO_PROFILES[profileName];
  return profile?.audioCodec === 'aac' ? '.m4a' : '.mp3';
}

export function outputMime(mediaType: 'video' | 'audio', profileName: string): string {
  if (mediaType === 'video') return 'video/mp4';
  const profile = AUDIO_PROFILES[profileName];
  return profile?.audioCodec === 'aac' ? 'audio/mp4' : 'audio/mpeg';
}
