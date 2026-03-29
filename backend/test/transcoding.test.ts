import { describe, it, expect } from 'vitest';
import {
  detectMediaType,
  outputExtension,
  outputMime,
  VIDEO_PROFILES,
  AUDIO_PROFILES,
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

describe('profile maps', () => {
  it('has expected video keys', () => {
    expect(Object.keys(VIDEO_PROFILES).sort()).toEqual(['1080p', '1080p60', '480p', '720p']);
  });

  it('has expected audio keys', () => {
    expect(Object.keys(AUDIO_PROFILES).sort()).toEqual(['aac-256', 'mp3-128', 'mp3-192', 'mp3-320']);
  });
});
