import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from 'crypto';
import { ENV } from './env';

export function generateSalt(): string {
  return randomBytes(32).toString('base64');
}

export function deriveFileEncryptionKey(salt: string, fileId: string): Buffer {
  const masterKey = Buffer.from(ENV.MASTER_ENCRYPTION_KEY, 'utf-8');
  const saltBuffer = Buffer.from(salt, 'base64');
  const info = Buffer.from(`minidrive-file-${fileId}`, 'utf-8');

  const derivedKey = hkdf(sha256, masterKey, saltBuffer, info, 32);

  return Buffer.from(derivedKey);
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function generateShareToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashData(data: string): string {
  return Buffer.from(sha256(data)).toString('base64');
}

export function getQuotaLimit(tier: 'FREE' | 'PRO' | 'PREMIUM'): bigint {
  const limits = {
    FREE: BigInt(50 * 1024 * 1024),
    PRO: BigInt(500 * 1024 * 1024),
    PREMIUM: BigInt(1024 * 1024 * 1024),
  } as const;

  return limits[tier];
}

export function formatBytes(bytes: bigint): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = Number(bytes);
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}
