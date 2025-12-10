import prisma from '../../../prisma/prisma';
import { deleteFile as deleteMinioFile } from '../../lib/minio';

interface CreateFolderParams {
    name: string;
    parentId?: string;
    ownerId: string;
}

interface UpdateFolderParams {
    id: string;
    name: string;
    ownerId: string;
}

/**
 * Create a new folder
 */
export async function createFolder(params: CreateFolderParams) {
    const { name, parentId, ownerId } = params;

    // Verify parent folder ownership if provided
    if (parentId) {
        const parentFolder = await prisma.folder.findFirst({
            where: {
                id: parentId,
                ownerId,
            },
        });

        if (!parentFolder) {
            throw new Error('Parent folder not found or access denied');
        }
    }

    // Check for duplicate folder name in same parent
    const existing = await prisma.folder.findFirst({
        where: {
            name,
            parentId: parentId || null,
            ownerId,
        },
    });

    if (existing) {
        throw new Error('Folder with this name already exists in this location');
    }

    const folder = await prisma.folder.create({
        data: {
            name,
            parentId: parentId || null,
            ownerId,
        },
    });

    return {
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        createdAt: folder.createdAt,
    };
}

/**
 * List folders (optionally filtered by parent)
 */
export async function listFolders(ownerId: string, parentId?: string) {
    const folders = await prisma.folder.findMany({
        where: {
            ownerId,
            parentId: parentId || null,
        },
        orderBy: { name: 'asc' },
        select: {
            id: true,
            name: true,
            parentId: true,
            createdAt: true,
            updatedAt: true,
            _count: {
                select: {
                    files: true,
                    children: true,
                },
            },
        },
    });

    return folders.map((folder) => ({
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
        filesCount: folder._count.files,
        foldersCount: folder._count.children,
    }));
}

/**
 * Update folder name
 */
export async function updateFolder(params: UpdateFolderParams) {
    const { id, name, ownerId } = params;

    // Verify folder ownership
    const folder = await prisma.folder.findFirst({
        where: {
            id,
            ownerId,
        },
    });

    if (!folder) {
        throw new Error('Folder not found or access denied');
    }

    // Check for duplicate folder name in same parent
    const existing = await prisma.folder.findFirst({
        where: {
            name,
            parentId: folder.parentId,
            ownerId,
            NOT: { id },
        },
    });

    if (existing) {
        throw new Error('Folder with this name already exists in this location');
    }

    const updatedFolder = await prisma.folder.update({
        where: { id },
        data: { name },
    });

    return {
        id: updatedFolder.id,
        name: updatedFolder.name,
        parentId: updatedFolder.parentId,
    };
}

/**
 * Delete folder and all its contents (cascade)
 */
export async function deleteFolder(id: string, ownerId: string) {
    // Verify folder ownership
    const folder = await prisma.folder.findFirst({
        where: {
            id,
            ownerId,
        },
    });

    if (!folder) {
        throw new Error('Folder not found or access denied');
    }

    // Get all files in this folder and its subfolders recursively
    const filesToDelete = await getAllFilesInFolder(id);

    // Delete all files from MinIO
    for (const file of filesToDelete) {
        try {
            await deleteMinioFile(file.minioObjectKey);
        } catch (error) {
            console.error(`Failed to delete file ${file.id} from MinIO:`, error);
        }
    }

    // Calculate total size of deleted files
    const totalSize = filesToDelete.reduce((sum, file) => sum + file.size, BigInt(0));

    // Delete folder (will cascade to files and subfolders due to Prisma schema)
    await prisma.folder.delete({
        where: { id },
    });

    // Update user storage usage
    if (totalSize > BigInt(0)) {
        await prisma.user.update({
            where: { id: ownerId },
            data: {
                storageUsed: {
                    decrement: totalSize,
                },
            },
        });
    }

    return { success: true, deletedFiles: filesToDelete.length };
}

/**
 * Helper: Get all files in folder and subfolders recursively
 */
async function getAllFilesInFolder(folderId: string) {
    const files: Array<{ id: string; minioObjectKey: string; size: bigint }> = [];

    // Get direct files in this folder
    const directFiles = await prisma.file.findMany({
        where: { folderId },
        select: {
            id: true,
            minioObjectKey: true,
            size: true,
        },
    });

    files.push(...directFiles);

    // Get all child folders
    const childFolders = await prisma.folder.findMany({
        where: { parentId: folderId },
        select: { id: true },
    });

    // Recursively get files from child folders
    for (const childFolder of childFolders as Array<{ id: string }>) {
        const childFiles = await getAllFilesInFolder(childFolder.id);
        files.push(...childFiles);
    }

    return files;
}
