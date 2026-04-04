import type { components } from '@/api/schema'

export type MediaMetadata = components['schemas']['MediaMetadata']

/** One line for cards / playlist (artist · album). */
export function mediaMetadataSubtitle(meta: MediaMetadata | null | undefined): string {
  if (!meta) return ''
  const parts = [meta.artist, meta.album].filter((x): x is string => Boolean(x?.trim()))
  return parts.join(' · ')
}

/** Ordered rows for a details panel (non-empty values only). */
export function mediaMetadataDetailRows(meta: MediaMetadata | null | undefined): Array<{ label: string; value: string }> {
  if (!meta) return []
  const order: Array<[keyof MediaMetadata, string]> = [
    ['title', 'Title'],
    ['artist', 'Artist'],
    ['album', 'Album'],
    ['album_artist', 'Album artist'],
    ['genre', 'Genre'],
    ['year', 'Year'],
    ['track', 'Track'],
    ['composer', 'Composer'],
    ['comment', 'Comment'],
    ['encoder', 'Encoder'],
    ['creation_time', 'Creation time'],
  ]
  const rows: Array<{ label: string; value: string }> = []
  for (const [key, label] of order) {
    const v = meta[key]
    if (typeof v === 'string' && v.trim()) rows.push({ label, value: v.trim() })
  }
  return rows
}
