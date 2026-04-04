import { VIDEO_PROFILES, AUDIO_PROFILES } from '../transcoding.js';

export function validateUploadProfile(
  mediaType: 'video' | 'audio',
  profileName: string,
): { ok: true } | { ok: false; validKeys: string } {
  const allowed = mediaType === 'video' ? VIDEO_PROFILES : AUDIO_PROFILES;
  if (!allowed[profileName]) {
    return { ok: false, validKeys: Object.keys(allowed).join(', ') };
  }
  return { ok: true };
}
