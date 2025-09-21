import * as crypto from 'crypto';

const SCHEME = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // per NIST recommendation for GCM

// Use a strong key in production, ideally from a secure source
let KEY: Buffer | null = null;
function getKey(): Buffer {
  const k = process.env.ENCRYPTION_KEY;
  if (!k) throw new Error('ENCRYPTION_KEY environment variable must be set');
  if (!/^[0-9a-fA-F]{64}$/.test(k)) {
    throw new Error('ENCRYPTION_KEY must be a 64-hex-char (256-bit) value');
  }
  if (!KEY) KEY = Buffer.from(k, 'hex');
  return KEY;
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${SCHEME}:${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext.toString('hex')}`;
}

export function decrypt(text: string): string {
  const parts = text.split(':');
  if (parts.length !== 4) throw new Error('Invalid payload format');
  const [scheme, ivHex, tagHex, dataHex] = parts;
  if (scheme !== SCHEME) throw new Error(`Unsupported scheme: ${scheme}`);
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return plaintext.toString('utf8');
}
