import { join } from 'node:path';
import { thumbSeekSeconds, generateThumbnailAt, THUMB_FRAME_COUNT } from '../transcoding.js';
import { setMediaJobProgress } from '../processingProgress.js';
import { P_THUMBS } from './progressBands.js';
import { cleanupFiles } from './uploadTemp.js';

/** Extract JPEG frames on disk for video; returns paths (may be empty). */
export async function extractVideoThumbnailsToDisk(params: {
  mediaId: string;
  transcodedPath: string;
  durationSec: number;
  tempDir: string;
}): Promise<string[]> {
  const { mediaId, transcodedPath, durationSec, tempDir } = params;
  const seeks = thumbSeekSeconds(durationSec);
  const thumbTotal = Math.min(seeks.length, THUMB_FRAME_COUNT);
  const thumbPaths: string[] = [];

  console.log(`[${mediaId}] Generating ${thumbTotal} thumbnail frames...`);
  for (let i = 0; i < thumbTotal; i++) {
    const [lo, hi] = P_THUMBS;
    setMediaJobProgress(mediaId, {
      stage: 'thumbnails',
      overall_percent: lo + Math.round(((i + 1) / thumbTotal) * (hi - lo)),
      current_sec: null,
      total_sec: null,
    });
    const p = join(tempDir, `${mediaId}-thumb-${i}.jpg`);
    try {
      await generateThumbnailAt(transcodedPath, p, seeks[i]!);
      thumbPaths.push(p);
    } catch {
      await cleanupFiles(p);
    }
  }
  return thumbPaths;
}
