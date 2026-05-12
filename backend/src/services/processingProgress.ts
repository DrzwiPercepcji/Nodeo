export type ProcessingStage =
  | 'downloading'
  | 'transcoding'
  | 'thumbnails'
  | 'encrypting'
  | 'uploading_main'
  | 'uploading_thumbs';

export interface MediaJobProgressState {
  stage: ProcessingStage;
  overall_percent: number;
  current_sec: number | null;
  total_sec: number | null;
  updated_at_ms: number;
}

const store = new Map<string, MediaJobProgressState>();

/** Drop entries older than this (e.g. crash before clear). */
const STALE_MS = 45 * 60 * 1000;

export function setMediaJobProgress(
  mediaId: string,
  patch: Partial<Omit<MediaJobProgressState, 'updated_at_ms'>> & Pick<MediaJobProgressState, 'stage'>,
): void {
  const prev = store.get(mediaId);
  const next: MediaJobProgressState = {
    stage: patch.stage,
    overall_percent: patch.overall_percent ?? prev?.overall_percent ?? 0,
    current_sec: patch.current_sec !== undefined ? patch.current_sec : prev?.current_sec ?? null,
    total_sec: patch.total_sec !== undefined ? patch.total_sec : prev?.total_sec ?? null,
    updated_at_ms: Date.now(),
  };
  store.set(mediaId, next);
}

export function getMediaJobProgress(mediaId: string): MediaJobProgressState | null {
  const p = store.get(mediaId);
  if (!p) return null;
  if (Date.now() - p.updated_at_ms > STALE_MS) {
    store.delete(mediaId);
    return null;
  }
  return p;
}

export function clearMediaJobProgress(mediaId: string): void {
  store.delete(mediaId);
}

/** JSON shape for GET /media/:id (no internal timestamp). */
export function progressForApi(mediaId: string): {
  stage: ProcessingStage;
  overall_percent: number;
  current_sec: number | null;
  total_sec: number | null;
} | null {
  const p = getMediaJobProgress(mediaId);
  if (!p) return null;
  return {
    stage: p.stage,
    overall_percent: p.overall_percent,
    current_sec: p.current_sec,
    total_sec: p.total_sec,
  };
}
