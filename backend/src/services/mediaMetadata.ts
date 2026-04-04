import { spawn } from 'node:child_process';

/** Normalized tags for API / UI (from ID3, MP4 metadata, etc.). */
export type MediaMetadata = {
  title?: string;
  artist?: string;
  album?: string;
  album_artist?: string;
  genre?: string;
  year?: string;
  track?: string;
  composer?: string;
  comment?: string;
  encoder?: string;
  creation_time?: string;
};

type FfprobeJson = {
  format?: { tags?: Record<string, string> };
  streams?: Array<{ tags?: Record<string, string> }>;
};

export function mergeFfprobeTagMaps(parsed: FfprobeJson): Map<string, string> {
  const merged = new Map<string, string>();

  function ingest(tags: Record<string, string> | undefined): void {
    if (!tags) return;
    for (const [k, v] of Object.entries(tags)) {
      if (typeof v !== 'string') continue;
      const t = v.trim();
      if (t) merged.set(k.toLowerCase(), t);
    }
  }

  ingest(parsed.format?.tags);
  for (const s of parsed.streams ?? []) {
    ingest(s.tags);
  }
  return merged;
}

function pick(map: Map<string, string>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = map.get(k);
    if (v) return v;
  }
  return undefined;
}

function normalizeYearFromDate(dateVal: string | undefined): string | undefined {
  if (!dateVal) return undefined;
  const y = dateVal.match(/^(\d{4})/);
  if (y) return y[1];
  return dateVal.length <= 4 ? dateVal : undefined;
}

/** Build {@link MediaMetadata} from lowercase ffprobe tag keys. Exported for unit tests. */
export function tagsToMediaMetadata(tagMap: Map<string, string>, mediaType: 'video' | 'audio'): MediaMetadata | null {
  const title = pick(tagMap, ['title', 'tit2', 'song_name']);
  const artist = pick(tagMap, ['artist', 'tpe1', 'author', 'performer']);
  const album = pick(tagMap, ['album', 'talb']);
  const album_artist = pick(tagMap, ['album_artist', 'albumartist', 'band', 'tpe2', 'album artist']);
  const genre = pick(tagMap, ['genre', 'tcon', 'tcon1']);
  const year =
    pick(tagMap, ['year', 'tyer'])
    ?? normalizeYearFromDate(pick(tagMap, ['date', 'tdrc']));
  const track = pick(tagMap, ['track', 'tracknumber', 'trck']);
  const composer = pick(tagMap, ['composer', 'tcom']);
  const comment = pick(tagMap, ['comment', 'comments', 'comm', 'description']);
  const encoder = pick(tagMap, ['encoder', 'encoded_by', 'encoding_tool']);
  const creation_time = pick(tagMap, ['creation_time', 'com.apple.quicktime.creationdate']);

  const meta: MediaMetadata = {};
  if (title) meta.title = title;
  if (artist) meta.artist = artist;
  if (album) meta.album = album;
  if (album_artist) meta.album_artist = album_artist;
  if (genre) meta.genre = genre;
  if (year) meta.year = year;
  if (track) meta.track = track;
  if (composer) meta.composer = composer;
  if (comment) meta.comment = comment;
  if (mediaType === 'video') {
    if (encoder) meta.encoder = encoder;
    if (creation_time) meta.creation_time = creation_time;
  }

  return Object.keys(meta).length > 0 ? meta : null;
}

export async function probeFfprobeJson(filePath: string): Promise<FfprobeJson | null> {
  return new Promise((resolve) => {
    const proc = spawn('ffprobe', [
      '-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', filePath,
    ]);
    let stdout = '';
    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.on('close', (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(stdout) as FfprobeJson);
      } catch {
        resolve(null);
      }
    });
    proc.on('error', () => resolve(null));
  });
}

/** Read container / stream tags from the **source** file (before transcoding strips them). */
export async function extractMediaMetadata(filePath: string, mediaType: 'video' | 'audio'): Promise<MediaMetadata | null> {
  const parsed = await probeFfprobeJson(filePath);
  if (!parsed) return null;
  const map = mergeFfprobeTagMaps(parsed);
  return tagsToMediaMetadata(map, mediaType);
}
