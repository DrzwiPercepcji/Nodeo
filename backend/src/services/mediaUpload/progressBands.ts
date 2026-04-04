/** Overall % bands: transcode → thumbs → encrypt → main S3 → thumb S3 */
export const P_TRANSCODE = [0, 50] as const;
export const P_THUMBS = [50, 62] as const;
export const P_ENCRYPT = [62, 68] as const;
export const P_MAIN = [68, 85] as const;
export const P_THUMB_UP = [85, 100] as const;

export function overallTranscode(ffmpegPct: number): number {
  const [lo, hi] = P_TRANSCODE;
  return Math.round(lo + (ffmpegPct / 100) * (hi - lo));
}
