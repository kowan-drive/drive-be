import { z } from 'zod';

export const uploadFileSchema = z.object({
  folderId: z.string().uuid().optional(),
});

export const downloadFileSchema = z.object({
  id: z.string().uuid(),
});

export const deleteFileSchema = z.object({
  id: z.string().uuid(),
});

export const listFilesSchema = z.object({
  folderId: z.string().uuid().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const moveFileSchema = z.object({
  id: z.string().uuid(),
  folderId: z.string().uuid().nullable(),
});
