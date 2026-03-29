import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from 'node:crypto';

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = 'sha256';
const AES_ALGO = 'aes-256-ctr';
const VERIFY_PLAINTEXT = Buffer.from('nodeo-verify-token');

/** Derive a 256-bit key from passphrase + salt using PBKDF2. */
export function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST);
}

/** Encrypt data with AES-256-CTR. Returns { iv, ciphertext }. */
export function encrypt(key: Buffer, plaintext: Buffer): { iv: Buffer; ciphertext: Buffer } {
  const iv = randomBytes(16);
  const cipher = createCipheriv(AES_ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { iv, ciphertext };
}

/** Decrypt data with AES-256-CTR. */
export function decrypt(key: Buffer, iv: Buffer, ciphertext: Buffer): Buffer {
  const decipher = createDecipheriv(AES_ALGO, key, iv);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Create encryption material for a new encrypted collection.
 * - Generates a random DEK (Data Encryption Key)
 * - Wraps (encrypts) the DEK with a KEK derived from the passphrase
 * - Creates a verification token to validate passphrase later
 */
export function createCollectionKeys(passphrase: string) {
  const dek = randomBytes(32);
  const salt = randomBytes(32);
  const kek = deriveKey(passphrase, salt);

  const { iv: dekIv, ciphertext: encryptedDek } = encrypt(kek, dek);
  const { iv: verifyIv, ciphertext: verifyCipher } = encrypt(dek, VERIFY_PLAINTEXT);
  const verifyToken = Buffer.concat([verifyIv, verifyCipher]);

  return { dek, salt, dekIv, encryptedDek, verifyToken };
}

/**
 * Attempt to unwrap (decrypt) the DEK using the provided passphrase.
 * Returns the DEK if the passphrase is correct, null otherwise.
 */
export function unwrapDek(
  passphrase: string,
  salt: Buffer,
  dekIv: Buffer,
  encryptedDek: Buffer,
  verifyToken: Buffer,
): Buffer | null {
  const kek = deriveKey(passphrase, salt);
  const dek = decrypt(kek, dekIv, encryptedDek);

  const storedIv = verifyToken.subarray(0, 16);
  const storedCipher = verifyToken.subarray(16);
  const decrypted = decrypt(dek, storedIv, storedCipher);

  if (!decrypted.equals(VERIFY_PLAINTEXT)) return null;
  return dek;
}
