import { describe, it, expect } from 'vitest';
import {
  detectMediaType,
  outputExtension,
  outputMime,
  VIDEO_PROFILES,
  AUDIO_PROFILES,
  thumbSeekSeconds,
  THUMB_FRAME_COUNT,
  parseFfmpegTimeSeconds,
} from '../src/services/transcoding.js';

describe('detectMediaType', () => {
  it('detects audio by MIME', () => {
    expect(detectMediaType('audio/mpeg', 'x.bin')).toBe('audio');
    expect(detectMediaType('audio/flac', undefined)).toBe('audio');
  });

  it('detects audio by extension when MIME is generic', () => {
    expect(detectMediaType('application/octet-stream', 'song.mp3')).toBe('audio');
    expect(detectMediaType(undefined, 'track.flac')).toBe('audio');
  });

  it('defaults to video', () => {
    expect(detectMediaType('video/mp4', 'clip.mp4')).toBe('video');
    expect(detectMediaType(undefined, 'movie.mkv')).toBe('video');
  });
});

describe('outputExtension / outputMime', () => {
  it('video is always mp4 / video/mp4', () => {
    expect(outputExtension('video', '720p')).toBe('.mp4');
    expect(outputMime('video', '720p')).toBe('video/mp4');
  });

  it('audio mp3 profiles use audio/mpeg and .mp3', () => {
    expect(outputExtension('audio', 'mp3-192')).toBe('.mp3');
    expect(outputMime('audio', 'mp3-192')).toBe('audio/mpeg');
  });

  it('aac profile uses .m4a and audio/mp4', () => {
    expect(outputExtension('audio', 'aac-256')).toBe('.m4a');
    expect(outputMime('audio', 'aac-256')).toBe('audio/mp4');
  });
});

describe('thumbSeekSeconds', () => {
  it('returns five positions for long enough duration', () => {
    const s = thumbSeekSeconds(100);
    expect(s).toHaveLength(THUMB_FRAME_COUNT);
    expect(s[0]).toBeGreaterThanOrEqual(0);
    expect(s[THUMB_FRAME_COUNT - 1]).toBeLessThanOrEqual(99);
  });

  it('uses fallback offsets when duration unknown', () => {
    const s = thumbSeekSeconds(null);
    expect(s.length).toBe(THUMB_FRAME_COUNT);
  });
});

describe('parseFfmpegTimeSeconds', () => {
  it('parses ffmpeg stderr time= line', () => {
    expect(
      parseFfmpegTimeSeconds('frame= 120 fps=25 q=28.0 size= 1024kB time=00:01:30.50 bitrate= 500kbits/s'),
    ).toBe(90.5);
  });

  it('returns null when no time=', () => {
    expect(parseFfmpegTimeSeconds('Input #0, mov,mp4,m4a')).toBeNull();
  });
});

describe('profile maps', () => {
  it('has expected video keys', () => {
    expect(Object.keys(VIDEO_PROFILES).sort()).toEqual(['1080p', '1080p60', '480p', '720p']);
  });

  it('has expected audio keys', () => {
    expect(Object.keys(AUDIO_PROFILES).sort()).toEqual(['aac-256', 'mp3-128', 'mp3-192', 'mp3-320']);
  });
});
