import { z } from 'zod';

export const createFolderSchema = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().uuid().optional(),
});

export const updateFolderSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
});

export const deleteFolderSchema = z.object({
  id: z.string().uuid(),
});

export const listFoldersSchema = z.object({
  parentId: z.string().uuid().optional(),
});
