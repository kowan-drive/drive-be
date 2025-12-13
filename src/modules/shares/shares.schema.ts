import { z } from 'zod';

export const createShareSchema = z.object({
  fileId: z.string().uuid(),
  expiresInHours: z.coerce.number().min(1).default(24),
  maxDownloads: z.coerce.number().optional(),
});

export const accessShareSchema = z.object({
  token: z.string(),
});
