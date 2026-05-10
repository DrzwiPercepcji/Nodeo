const USER_AGENT = 'Nodeo/2.0 (https://github.com/nodeo)';
const MB_BASE = 'https://musicbrainz.org/ws/2/release';
const CAA_BASE = 'https://coverartarchive.org/release';

const cache = new Map<string, string | null>();

let lastMbRequestMs = 0;

function cacheKey(artist: string, album: string): string {
  return `${artist.toLowerCase().trim()}\0${album.toLowerCase().trim()}`;
}

async function rateLimitedFetch(url: string, init?: RequestInit): Promise<Response> {
  const now = Date.now();
  const waitMs = Math.max(0, 1100 - (now - lastMbRequestMs));
  if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
  lastMbRequestMs = Date.now();
  return fetch(url, init);
}

async function searchMbid(artist: string, album: string): Promise<string | null> {
  const query = `release:"${album}" AND artist:"${artist}"`;
  const url = `${MB_BASE}?query=${encodeURIComponent(query)}&fmt=json&limit=1`;

  const res = await rateLimitedFetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });

  if (!res.ok) return null;

  const body = (await res.json()) as { releases?: Array<{ id: string; score: number }> };
  const release = body.releases?.[0];
  if (!release || release.score < 80) return null;
  return release.id;
}

async function verifyCoverArt(mbid: string): Promise<string | null> {
  const url = `${CAA_BASE}/${mbid}/front-250`;
  const res = await fetch(url, { method: 'HEAD', redirect: 'manual' });

  if (res.status === 307 || res.status === 302) {
    return res.headers.get('location') ?? url;
  }
  if (res.ok) return url;
  return null;
}

const pending = new Map<string, Promise<string | null>>();

export async function lookupCoverArt(artist: string, album: string): Promise<string | null> {
  const key = cacheKey(artist, album);

  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const inflight = pending.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      const mbid = await searchMbid(artist, album);
      if (!mbid) {
        cache.set(key, null);
        return null;
      }

      const imageUrl = await verifyCoverArt(mbid);
      cache.set(key, imageUrl);
      return imageUrl;
    } catch {
      return null;
    } finally {
      pending.delete(key);
    }
  })();

  pending.set(key, promise);
  return promise;
}
