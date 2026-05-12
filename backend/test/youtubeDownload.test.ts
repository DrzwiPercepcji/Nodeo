import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
  access: vi.fn().mockRejectedValue(new Error('ENOENT')),
}));

vi.mock('../src/services/processingProgress.js', () => ({
  setMediaJobProgress: vi.fn(),
}));

vi.mock('../src/services/ytdlpCookies.js', () => ({
  getYtdlpCookiesPath: () => '/fake/cookies.txt',
}));

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { downloadYouTubeAudio } from '../src/services/youtubeDownload.js';
import { setMediaJobProgress } from '../src/services/processingProgress.js';

const spawnMock = vi.mocked(spawn);
const readdirMock = vi.mocked(readdir);
const progressMock = vi.mocked(setMediaJobProgress);

interface FakeProc extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
}

function fakeChildProcess(
  stdoutData: string,
  exitCode: number,
  stderrData = '',
): FakeProc {
  const proc = new EventEmitter() as FakeProc;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  queueMicrotask(() => {
    if (stdoutData) proc.stdout.emit('data', Buffer.from(stdoutData));
    if (stderrData) proc.stderr.emit('data', Buffer.from(stderrData));
    proc.emit('close', exitCode);
  });
  return proc;
}

function fakeErrorProc(code: string): FakeProc {
  const proc = new EventEmitter() as FakeProc;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  queueMicrotask(() => {
    const err = Object.assign(new Error(`spawn yt-dlp ${code}`), { code });
    proc.emit('error', err);
  });
  return proc;
}

/**
 * Build a mockImplementation that lazily creates fake processes per call index.
 * This ensures microtask events fire AFTER listeners are attached.
 */
function sequentialSpawn(fns: Array<() => FakeProc>): () => FakeProc {
  let idx = 0;
  return () => {
    const fn = fns[idx++];
    if (!fn) throw new Error(`Unexpected spawn call #${idx}`);
    return fn();
  };
}

describe('downloadYouTubeAudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('downloads audio and returns file path with detected title', async () => {
    spawnMock.mockImplementation(sequentialSpawn([
      () => fakeChildProcess('My Song Title\n', 0),
      () => fakeChildProcess('', 0, '[download] 100%\n'),
    ]) as never);

    readdirMock.mockResolvedValue(['test-id-yt.webm'] as never);

    const result = await downloadYouTubeAudio('test-id', 'https://youtube.com/watch?v=abc', '/tmp');

    expect(result.title).toBe('My Song Title');
    expect(result.filePath).toBe('/tmp/test-id-yt.webm');

    expect(spawnMock).toHaveBeenCalledTimes(2);

    const titleArgs = spawnMock.mock.calls[0];
    expect(titleArgs[0]).toBe('yt-dlp');
    expect(titleArgs[1]).toContain('--get-title');
    expect(titleArgs[1]).toContain('--no-playlist');

    const downloadArgs = spawnMock.mock.calls[1];
    expect(downloadArgs[0]).toBe('yt-dlp');
    expect(downloadArgs[1]).toContain('-f');
    expect(downloadArgs[1]).toContain('bestaudio');
    expect(downloadArgs[1]).toContain('--no-playlist');
  });

  it('uses fallback title when yt-dlp --get-title fails', async () => {
    spawnMock.mockImplementation(sequentialSpawn([
      () => fakeChildProcess('', 1),
      () => fakeChildProcess('', 0),
    ]) as never);

    readdirMock.mockResolvedValue(['test-id-yt.m4a'] as never);

    const result = await downloadYouTubeAudio('test-id', 'https://youtube.com/watch?v=abc', '/tmp');

    expect(result.title).toBe('YouTube Import');
  });

  it('reports download progress via setMediaJobProgress', async () => {
    const downloadOutput = '[download]  45.2% of 5.00MiB at 1.00MiB/s\n';

    spawnMock.mockImplementation(sequentialSpawn([
      () => fakeChildProcess('Title\n', 0),
      () => fakeChildProcess('', 0, downloadOutput),
    ]) as never);

    readdirMock.mockResolvedValue(['media-yt.opus'] as never);

    await downloadYouTubeAudio('media', 'https://youtube.com/watch?v=x', '/tmp');

    const downloadingCalls = progressMock.mock.calls.filter(
      (c) => c[1].stage === 'downloading',
    );
    expect(downloadingCalls.length).toBeGreaterThan(0);

    const lastPct = downloadingCalls.at(-1)![1].overall_percent;
    expect(lastPct).toBeGreaterThanOrEqual(1);
    expect(lastPct).toBeLessThanOrEqual(15);
  });

  it('throws when yt-dlp download exits non-zero', async () => {
    spawnMock.mockImplementation(sequentialSpawn([
      () => fakeChildProcess('Title\n', 0),
      () => fakeChildProcess('', 1),
    ]) as never);

    await expect(
      downloadYouTubeAudio('fail-id', 'https://youtube.com/watch?v=bad', '/tmp'),
    ).rejects.toThrow('yt-dlp exited with code 1');
  });

  it('throws descriptive error when yt-dlp is not installed', async () => {
    spawnMock.mockImplementation(sequentialSpawn([
      () => fakeChildProcess('Title\n', 0),
      () => fakeErrorProc('ENOENT'),
    ]) as never);

    await expect(
      downloadYouTubeAudio('no-ytdlp', 'https://youtube.com/watch?v=x', '/tmp'),
    ).rejects.toThrow('yt-dlp is not installed');
  });

  it('throws when no output file is found after download', async () => {
    spawnMock.mockImplementation(sequentialSpawn([
      () => fakeChildProcess('Title\n', 0),
      () => fakeChildProcess('', 0),
    ]) as never);

    readdirMock.mockResolvedValue(['other-file.txt'] as never);

    await expect(
      downloadYouTubeAudio('missing', 'https://youtube.com/watch?v=x', '/tmp'),
    ).rejects.toThrow('no output file found');
  });
});
