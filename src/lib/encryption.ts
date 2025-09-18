import * as crypto from 'crypto';

const SCHEME = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // per NIST recommendation for GCM

// Use a strong key in production, ideally from a secure source
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable must be set');
}
if (!/^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY)) {
    throw new Error('ENCRYPTION_KEY must be a 64-hex-char (256-bit) value');
}
const KEY: Buffer = Buffer.from(ENCRYPTION_KEY, 'hex');


export function encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
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
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
    return plaintext.toString('utf8');
}
