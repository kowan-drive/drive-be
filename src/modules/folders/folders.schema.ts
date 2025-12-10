import { z } from 'zod';

// Create Folder Schema
export const createFolderSchema = z.object({
    name: z.string().min(1).max(255),
    parentId: z.string().uuid().optional(),
});

// Update Folder Schema
export const updateFolderSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(255),
});

// Delete Folder Schema
export const deleteFolderSchema = z.object({
    id: z.string().uuid(),
});

// List Folders Schema
export const listFoldersSchema = z.object({
    parentId: z.string().uuid().optional(),
});
