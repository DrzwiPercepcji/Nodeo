import { describe, it, expect } from 'vitest';
import { validateUploadProfile } from '../src/services/mediaUpload/validateProfile.js';
import { VIDEO_PROFILES, AUDIO_PROFILES } from '../src/services/transcoding.js';

describe('validateUploadProfile', () => {
  it('accepts known video profiles', () => {
    for (const key of Object.keys(VIDEO_PROFILES)) {
      expect(validateUploadProfile('video', key)).toEqual({ ok: true });
    }
  });

  it('accepts known audio profiles', () => {
    for (const key of Object.keys(AUDIO_PROFILES)) {
      expect(validateUploadProfile('audio', key)).toEqual({ ok: true });
    }
  });

  it('rejects unknown video profile and lists valid keys', () => {
    const r = validateUploadProfile('video', 'not-a-profile');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.validKeys).toBe(Object.keys(VIDEO_PROFILES).join(', '));
    }
  });

  it('rejects audio profile name when used as video', () => {
    const r = validateUploadProfile('video', 'mp3-128');
    expect(r.ok).toBe(false);
  });

  it('rejects video profile name when used as audio', () => {
    const r = validateUploadProfile('audio', '720p');
    expect(r.ok).toBe(false);
  });
});
