import { encrypt, decrypt, rotateEncryptionKey } from '../lib/encryption';

describe('Encryption Key Rotation', () => {
  const oldKey = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';
  const newKey = 'f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6b7a8f9e0d1c2b3a4f5e6d7c8b9a0f1e2';
  const originalText = 'This is a secret message.';

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = oldKey; // Set a default key for general encryption/decryption
  });

  afterAll(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  test('should encrypt and decrypt with the same key', () => {
    const encrypted = encrypt(originalText, oldKey);
    const decrypted = decrypt(encrypted, [oldKey]);
    expect(decrypted).toBe(originalText);
  });

  test('should rotate encryption key successfully', () => {
    // Encrypt with the old key
    const encryptedWithOldKey = encrypt(originalText, oldKey);

    // Rotate the key
    const encryptedWithNewKey = rotateEncryptionKey(encryptedWithOldKey, oldKey, newKey);

    // Decrypt with the new key
    const decryptedWithNewKey = decrypt(encryptedWithNewKey, [newKey]);

    expect(decryptedWithNewKey).toBe(originalText);
  });

  test('should decrypt with fallback to old key', () => {
    // Encrypt with the old key
    const encryptedWithOldKey = encrypt(originalText, oldKey);

    // Try to decrypt with new key first, then old key
    const decrypted = decrypt(encryptedWithOldKey, [newKey, oldKey]);

    expect(decrypted).toBe(originalText);
  });

  test('should throw error if decryption fails with all provided keys', () => {
    const wrongKey = '1111111111111111111111111111111111111111111111111111111111111111';
    const encrypted = encrypt(originalText, oldKey);
    expect(() => decrypt(encrypted, [wrongKey])).toThrow('Decryption failed with all provided keys');
  });

  test('should use process.env.ENCRYPTION_KEY if no keys are provided to decrypt', () => {
    const encrypted = encrypt(originalText);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(originalText);
  });

  test('should use process.env.ENCRYPTION_KEY if no key is provided to encrypt', () => {
    const encrypted = encrypt(originalText);
    const decrypted = decrypt(encrypted, [oldKey]);
    expect(decrypted).toBe(originalText);
  });
});
