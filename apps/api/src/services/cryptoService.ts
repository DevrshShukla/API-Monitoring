import crypto from 'crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const CURRENT_KEY_VERSION = 1;

export interface EncryptedData {
  version: number;
  iv: string; // hex
  tag: string; // hex
  data: string; // hex
}

function getKey(keyHexOrStr: string): Buffer {
  if (keyHexOrStr.length === 64 && /^[0-9a-fA-F]+$/.test(keyHexOrStr)) {
    return Buffer.from(keyHexOrStr, 'hex');
  }
  return crypto.createHash('sha256').update(keyHexOrStr).digest();
}

const masterKey = getKey(env.ENCRYPTION_KEY);

export function encryptString(text: string): EncryptedData {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return {
    version: CURRENT_KEY_VERSION,
    iv: iv.toString('hex'),
    tag,
    data: encrypted,
  };
}

export function decryptString(encrypted: EncryptedData): string {
  const iv = Buffer.from(encrypted.iv, 'hex');
  const tag = Buffer.from(encrypted.tag, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted.data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function encryptObject(obj: unknown): EncryptedData {
  return encryptString(JSON.stringify(obj));
}

export function decryptObject<T = unknown>(encrypted: EncryptedData): T {
  const decrypted = decryptString(encrypted);
  return JSON.parse(decrypted) as T;
}
