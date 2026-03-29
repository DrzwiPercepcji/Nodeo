import { createCipheriv } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import {
  deriveKey,
  encrypt,
  decrypt,
  createCollectionKeys,
  unwrapDek,
  counterAtOffset,
  createStreamDecipher,
  generateFileIv,
} from '../src/services/encryption.js';

describe('deriveKey', () => {
  it('returns a 32-byte key for the same passphrase and salt', () => {
    const salt = Buffer.alloc(16, 7);
    const a = deriveKey('secret', salt);
    const b = deriveKey('secret', salt);
    expect(a.length).toBe(32);
    expect(a.equals(b)).toBe(true);
  });

  it('changes when salt changes', () => {
    const k1 = deriveKey('secret', Buffer.alloc(8, 1));
    const k2 = deriveKey('secret', Buffer.alloc(8, 2));
    expect(k1.equals(k2)).toBe(false);
  });
});

describe('encrypt / decrypt', () => {
  it('round-trips arbitrary bytes', () => {
    const key = Buffer.alloc(32, 9);
    const plaintext = Buffer.from('hello nodeo ctr mode');
    const { iv, ciphertext } = encrypt(key, plaintext);
    expect(iv.length).toBe(16);
    const out = decrypt(key, iv, ciphertext);
    expect(out.equals(plaintext)).toBe(true);
  });
});

describe('createCollectionKeys / unwrapDek', () => {
  it('unwraps with the correct passphrase', () => {
    const passphrase = 'correct horse battery';
    const keys = createCollectionKeys(passphrase);
    const dek = unwrapDek(passphrase, keys.salt, keys.dekIv, keys.encryptedDek, keys.verifyToken);
    expect(dek).not.toBeNull();
    expect(dek!.equals(keys.dek)).toBe(true);
  });

  it('returns null for wrong passphrase', () => {
    const keys = createCollectionKeys('right-password');
    const dek = unwrapDek('wrong-password', keys.salt, keys.dekIv, keys.encryptedDek, keys.verifyToken);
    expect(dek).toBeNull();
  });
});

describe('counterAtOffset', () => {
  it('returns IV unchanged at offset 0', () => {
    const iv = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    expect(counterAtOffset(iv, 0).equals(iv)).toBe(true);
  });

  it('increments the counter for a full block offset', () => {
    const iv = Buffer.alloc(16, 0);
    iv[15] = 0xff;
    const c = counterAtOffset(iv, 16);
    expect(c[15]).toBe(0);
    expect(c[14]).toBe(1);
  });
});

describe('createStreamDecipher', () => {
  it('decrypts ciphertext from a block-aligned byte offset (matches streaming handler)', () => {
    const key = Buffer.alloc(32, 3);
    const iv = Buffer.alloc(16, 5);
    const plaintext = Buffer.alloc(80);
    for (let i = 0; i < plaintext.length; i++) plaintext[i] = i & 0xff;

    const cipher = createCipheriv('aes-256-ctr', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

    const start = 32; // 16-byte aligned, as used after range alignment in the media route
    const decipher = createStreamDecipher(key, iv, start);
    const slice = ciphertext.subarray(start);
    const recovered = Buffer.concat([decipher.update(slice), decipher.final()]);
    expect(recovered.equals(plaintext.subarray(start))).toBe(true);
  });
});

describe('generateFileIv', () => {
  it('returns 16 bytes', () => {
    const iv = generateFileIv();
    expect(iv.length).toBe(16);
  });
});
