import prisma from '../../../prisma/prisma';
import {
    uploadFileWithEncryption,
    downloadFileWithDecryption,
    deleteFile as deleteMinioFile,
} from '../../lib/minio';
import { generateSalt, deriveFileEncryptionKey } from '../../lib/encryption';
import type { User } from '@prisma/client';

interface UploadFileParams {
    user: User;
    file: File;
    fileSize: bigint;
    folderId?: string;
}

interface ListFilesParams {
    userId: string;
    folderId?: string;
    page: number;
    limit: number;
}

/**
 * Upload file with SSE-C encryption
 */
export async function uploadFile(params: UploadFileParams) {
    const { user, file, fileSize, folderId } = params;

    // Validate folder ownership if provided
    if (folderId) {
        const folder = await prisma.folder.findFirst({
            where: {
                id: folderId,
                ownerId: user.id,
            },
        });

        if (!folder) {
            throw new Error('Folder not found or access denied');
        }
    }

    // Generate encryption salt and derive key
    const salt = generateSalt();

    // Create file metadata first to get the ID
    const fileMetadata = await prisma.file.create({
        data: {
            name: file.name,
            size: fileSize,
            mimeType: file.type || 'application/octet-stream',
            encryptionKeySalt: salt,
            minioObjectKey: '', // Will be updated after we have the file ID
            folderId: folderId || null,
            ownerId: user.id,
        },
    });

    try {
        // Derive encryption key using file ID
        const encryptionKey = deriveFileEncryptionKey(salt, fileMetadata.id);

        // Generate MinIO object key (user-scoped)
        const objectKey = `${user.id}/${fileMetadata.id}`;

        // Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to MinIO with encryption
        await uploadFileWithEncryption(objectKey, buffer, encryptionKey, {
            'Content-Type': file.type || 'application/octet-stream',
            'Original-Filename': file.name,
        });

        // Update file metadata with MinIO object key
        const updatedFile = await prisma.file.update({
            where: { id: fileMetadata.id },
            data: {
                minioObjectKey: objectKey,
            },
        });

        // Update user storage usage
        await prisma.user.update({
            where: { id: user.id },
            data: {
                storageUsed: {
                    increment: fileSize,
                },
            },
        });

        return {
            id: updatedFile.id,
            name: updatedFile.name,
            size: updatedFile.size,
            mimeType: updatedFile.mimeType,
            folderId: updatedFile.folderId,
            createdAt: updatedFile.createdAt,
        };
    } catch (error) {
        // Cleanup: delete file metadata if upload fails
        await prisma.file.delete({ where: { id: fileMetadata.id } });
        throw error;
    }
}

/**
 * Download file with SSE-C decryption
 */
export async function downloadFile(fileId: string, userId: string) {
    const file = await prisma.file.findFirst({
        where: {
            id: fileId,
            ownerId: userId,
        },
    });

    if (!file) {
        throw new Error('File not found or access denied');
    }

    // Derive encryption key
    const encryptionKey = deriveFileEncryptionKey(file.encryptionKeySalt, file.id);

    // Download and decrypt from MinIO
    const buffer = await downloadFileWithDecryption(file.minioObjectKey, encryptionKey);

    return {
        buffer,
        filename: file.name,
        mimeType: file.mimeType,
    };
}

/**
 * Delete file
 */
export async function deleteFile(fileId: string, userId: string) {
    const file = await prisma.file.findFirst({
        where: {
            id: fileId,
            ownerId: userId,
        },
    });

    if (!file) {
        throw new Error('File not found or access denied');
    }

    // Delete from MinIO
    await deleteMinioFile(file.minioObjectKey);

    // Delete from database
    await prisma.file.delete({
        where: { id: file.id },
    });

    // Update user storage usage
    await prisma.user.update({
        where: { id: userId },
        data: {
            storageUsed: {
                decrement: file.size,
            },
        },
    });

    return { success: true };
}

/**
 * List user files
 */
export async function listFiles(params: ListFilesParams) {
    const { userId, folderId, page, limit } = params;
    const skip = (page - 1) * limit;

    const where = {
        ownerId: userId,
        folderId: folderId || null,
    };

    const [files, total] = await Promise.all([
        prisma.file.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            select: {
                id: true,
                name: true,
                size: true,
                mimeType: true,
                folderId: true,
                createdAt: true,
                updatedAt: true,
            },
        }),
        prisma.file.count({ where }),
    ]);

    return {
        files,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

/**
 * Get file metadata
 */
export async function getFileMetadata(fileId: string, userId: string) {
    const file = await prisma.file.findFirst({
        where: {
            id: fileId,
            ownerId: userId,
        },
        select: {
            id: true,
            name: true,
            size: true,
            mimeType: true,
            folderId: true,
            createdAt: true,
            updatedAt: true,
            folder: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    });

    if (!file) {
        throw new Error('File not found or access denied');
    }

    return file;
}

/**
 * Move file to another folder
 */
export async function moveFile(fileId: string, userId: string, targetFolderId: string | null) {
    // Verify file ownership
    const file = await prisma.file.findFirst({
        where: {
            id: fileId,
            ownerId: userId,
        },
    });

    if (!file) {
        throw new Error('File not found or access denied');
    }

    // Verify folder ownership if targetFolderId is provided
    if (targetFolderId) {
        const folder = await prisma.folder.findFirst({
            where: {
                id: targetFolderId,
                ownerId: userId,
            },
        });

        if (!folder) {
            throw new Error('Target folder not found or access denied');
        }
    }

    // Update file's folder
    const updatedFile = await prisma.file.update({
        where: { id: fileId },
        data: {
            folderId: targetFolderId,
        },
    });

    return {
        id: updatedFile.id,
        name: updatedFile.name,
        folderId: updatedFile.folderId,
    };
}
