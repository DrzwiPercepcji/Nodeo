import { describe, it, expect } from 'vitest';
import { P_TRANSCODE, overallTranscode } from '../src/services/mediaUpload/progressBands.js';

describe('overallTranscode', () => {
  it('maps 0% ffmpeg to the start of the transcode band', () => {
    expect(overallTranscode(0)).toBe(P_TRANSCODE[0]);
  });

  it('maps 100% ffmpeg to the end of the transcode band', () => {
    expect(overallTranscode(100)).toBe(P_TRANSCODE[1]);
  });

  it('maps mid-range linearly', () => {
    const [lo, hi] = P_TRANSCODE;
    expect(overallTranscode(50)).toBe(Math.round(lo + 0.5 * (hi - lo)));
  });
});
