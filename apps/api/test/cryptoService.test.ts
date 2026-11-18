import { describe, it, expect } from 'vitest';
import {
  encryptString,
  decryptString,
  encryptObject,
  decryptObject,
} from '../src/services/cryptoService.js';

describe('Crypto Service AES-256-GCM', () => {
  it('encrypts and decrypts string successfully', () => {
    const secret = 'Bearer my-super-secret-token-12345';
    const encrypted = encryptString(secret);

    expect(encrypted.version).toBe(1);
    expect(encrypted.iv).toHaveLength(24); // 12 bytes = 24 hex chars
    expect(encrypted.tag).toHaveLength(32); // 16 bytes = 32 hex chars
    expect(encrypted.data).not.toBe(secret);

    const decrypted = decryptString(encrypted);
    expect(decrypted).toBe(secret);
  });

  it('generates unique IVs and ciphertexts for identical inputs', () => {
    const secret = 'identical-secret';
    const enc1 = encryptString(secret);
    const enc2 = encryptString(secret);

    expect(enc1.iv).not.toBe(enc2.iv);
    expect(enc1.data).not.toBe(enc2.data);
    expect(decryptString(enc1)).toBe(secret);
    expect(decryptString(enc2)).toBe(secret);
  });

  it('encrypts and decrypts complex object successfully', () => {
    const headers = [
      { key: 'Authorization', value: 'Bearer secret_token_xyz', sensitive: true },
      { key: 'X-Api-Key', value: '1234567890', sensitive: true },
    ];

    const encrypted = encryptObject(headers);
    const decrypted = decryptObject<typeof headers>(encrypted);

    expect(decrypted).toEqual(headers);
  });

  it('fails decryption if ciphertext or tag is tampered with', () => {
    const encrypted = encryptString('sensitive-data');
    const tampered = { ...encrypted, data: encrypted.data.slice(0, -2) + '00' };

    expect(() => decryptString(tampered)).toThrow();
  });
});
