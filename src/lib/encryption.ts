import * as crypto from 'crypto';

const SCHEME = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // per NIST recommendation for GCM

// Use a strong key in production, ideally from a secure source
let KEY: Buffer | null = null;
function getKey(key?: string): Buffer {
  const k = key || process.env.ENCRYPTION_KEY;
  if (!k) throw new Error('ENCRYPTION_KEY environment variable must be set');
  if (!/^[0-9a-fA-F]{64}$/.test(k)) {
    throw new Error('ENCRYPTION_KEY must be a 64-hex-char (256-bit) value');
  }
  if (!KEY || key) KEY = Buffer.from(k, 'hex'); // Re-initialize KEY if a specific key is provided
  return KEY;
}

export function encrypt(text: string, key?: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(key), iv);
  const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${SCHEME}:${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext.toString('hex')}`;
}

export function decrypt(text: string, keys?: string[]): string {
  const parts = text.split(':');
  if (parts.length !== 4) throw new Error('Invalid payload format');
  const [scheme, ivHex, tagHex, dataHex] = parts;
  if (scheme !== SCHEME) throw new Error(`Unsupported scheme: ${scheme}`);
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');

  const decryptionKeys = keys && keys.length > 0 ? keys : [process.env.ENCRYPTION_KEY as string];

  for (const k of decryptionKeys) {
    try {
      const decipher = crypto.createDecipheriv(ALGORITHM, getKey(k), iv);
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
      return plaintext.toString('utf8');
    } catch (e) {
      // If decryption fails with this key, try the next one
      continue;
    }
  }
  throw new Error('Decryption failed with all provided keys');
}

/**
 * @function rotateEncryptionKey
 * @description Rotates an encryption key by decrypting data with an old key and re-encrypting it with a new key.
 * This is useful when you need to update the encryption key used for sensitive data without losing access to existing encrypted information.
 * @param {string} encryptedText The text encrypted with the old key.
 * @param {string} oldKey The old encryption key (64-hex-char string).
 * @param {string} newKey The new encryption key (64-hex-char string).
 * @returns {string} The text re-encrypted with the new key.
 * @throws {Error} If decryption with the old key fails or if encryption with the new key fails.
 * @example
 * // Example usage:
 * // const oldKey = process.env.OLD_ENCRYPTION_KEY;
 * // const newKey = process.env.NEW_ENCRYPTION_KEY;
 * // const originalData = 'sensitive information';
 * // const encryptedWithOldKey = encrypt(originalData, oldKey);
 * // const encryptedWithNewKey = rotateEncryptionKey(encryptedWithOldKey, oldKey, newKey);
 * // const decryptedWithNewKey = decrypt(encryptedWithNewKey, [newKey]);
 * // console.log(decryptedWithNewKey); // sensitive information
 */
export function rotateEncryptionKey(encryptedText: string, oldKey: string, newKey: string): string {
  const decryptedText = decrypt(encryptedText, [oldKey]);
  return encrypt(decryptedText, newKey);
}
