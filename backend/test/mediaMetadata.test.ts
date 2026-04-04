import { describe, it, expect } from 'vitest';
import { mergeFfprobeTagMaps, tagsToMediaMetadata } from '../src/services/mediaMetadata.js';

describe('mergeFfprobeTagMaps', () => {
  it('merges format and stream tags with lowercase keys; later streams override', () => {
    const parsed = {
      format: { tags: { ARTIST: 'FromFormat ', Album: 'A' } },
      streams: [
        { tags: { title: 'StreamTitle' } },
        { tags: { artist: 'StreamArtist' } },
      ],
    };
    const m = mergeFfprobeTagMaps(parsed);
    expect(m.get('artist')).toBe('StreamArtist');
    expect(m.get('album')).toBe('A');
    expect(m.get('title')).toBe('StreamTitle');
  });
});

describe('tagsToMediaMetadata', () => {
  it('maps common ID3 keys for audio', () => {
    const map = new Map<string, string>([
      ['tit2', 'Song'],
      ['tpe1', 'Band'],
      ['talb', 'LP'],
      ['tcon', 'Rock'],
      ['trck', '2/10'],
      ['tyer', '1999'],
    ]);
    const meta = tagsToMediaMetadata(map, 'audio');
    expect(meta).toEqual({
      title: 'Song',
      artist: 'Band',
      album: 'LP',
      genre: 'Rock',
      track: '2/10',
      year: '1999',
    });
  });

  it('parses year from date when year not set', () => {
    const map = new Map<string, string>([['date', '2012-06-15']]);
    expect(tagsToMediaMetadata(map, 'audio')).toEqual({ year: '2012' });
  });

  it('includes encoder and creation_time for video only', () => {
    const map = new Map<string, string>([
      ['title', 'Clip'],
      ['encoder', 'Lavf60'],
      ['creation_time', '2024-01-01T12:00:00.000000Z'],
    ]);
    expect(tagsToMediaMetadata(map, 'video')).toMatchObject({
      title: 'Clip',
      encoder: 'Lavf60',
      creation_time: '2024-01-01T12:00:00.000000Z',
    });
    expect(tagsToMediaMetadata(map, 'audio')).toEqual({ title: 'Clip' });
  });

  it('returns null when no known fields', () => {
    expect(tagsToMediaMetadata(new Map([['unknown', 'x']]), 'audio')).toBeNull();
  });
});
