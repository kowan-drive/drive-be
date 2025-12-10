import { z } from 'zod';

// Create Share Schema
export const createShareSchema = z.object({
    fileId: z.string().uuid(),
    expiresInHours: z.coerce.number().min(1).max(168).default(24), // Max 7 days
    maxDownloads: z.coerce.number().min(1).max(100).optional(),
});

// Access Share Schema
export const accessShareSchema = z.object({
    token: z.string(),
});
