import { z } from 'zod';

// File Upload Schema
export const uploadFileSchema = z.object({
    folderId: z.string().uuid().optional(),
});

// File Download Schema
export const downloadFileSchema = z.object({
    id: z.string().uuid(),
});

// File Delete Schema
export const deleteFileSchema = z.object({
    id: z.string().uuid(),
});

// File List Schema
export const listFilesSchema = z.object({
    folderId: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
});

// File Move Schema
export const moveFileSchema = z.object({
    id: z.string().uuid(),
    folderId: z.string().uuid().nullable(),
});
