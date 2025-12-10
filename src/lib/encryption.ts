import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from 'crypto';
import { ENV } from './env';

/**
 * Generate a cryptographically secure random salt
 */
export function generateSalt(): string {
    return randomBytes(32).toString('base64');
}

/**
 * Derive a file-specific encryption key from master key and salt
 * Uses HKDF (HMAC-based Key Derivation Function) with SHA256
 * 
 * @param salt - Unique salt for this file (stored in database)
 * @param fileId - File ID for additional context
 * @returns 32-byte encryption key
 */
export function deriveFileEncryptionKey(salt: string, fileId: string): Buffer {
    const masterKey = Buffer.from(ENV.MASTER_ENCRYPTION_KEY, 'utf-8');
    const saltBuffer = Buffer.from(salt, 'base64');
    const info = Buffer.from(`minidrive-file-${fileId}`, 'utf-8');

    // Derive 32-byte key using HKDF-SHA256
    const derivedKey = hkdf(sha256, masterKey, saltBuffer, info, 32);

    return Buffer.from(derivedKey);
}

/**
 * Generate a secure random session token
 */
export function generateSessionToken(): string {
    return randomBytes(32).toString('base64url');
}

/**
 * Generate a secure random share token
 */
export function generateShareToken(): string {
    return randomBytes(32).toString('base64url');
}

/**
 * Hash a password or token (for storage)
 */
export function hashData(data: string): string {
    return Buffer.from(sha256(data)).toString('base64');
}

/**
 * Get quota limit in bytes for a tier
 */
export function getQuotaLimit(tier: 'FREE' | 'PRO' | 'PREMIUM'): bigint {
    const limits = {
        FREE: BigInt(50 * 1024 * 1024),      // 50 MB
        PRO: BigInt(500 * 1024 * 1024),      // 500 MB
        PREMIUM: BigInt(1024 * 1024 * 1024), // 1 GB
    };

    return limits[tier];
}

/**
 * Format bytes to human-readable string
 */
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
