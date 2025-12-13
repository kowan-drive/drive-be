import prisma from '../../../prisma/prisma';
import { uploadFileWithEncryption, downloadFileWithDecryption, deleteFile as deleteMinioFile } from '../../lib/minio';
import { generateSalt, deriveFileEncryptionKey } from '../../lib/encryption';
import type { User } from '@prisma/client';

interface UploadFileParams {
  user: User;
  file: any;
  fileSize: bigint;
  folderId?: string;
}

interface ListFilesParams {
  userId: string;
  folderId?: string;
  page: number;
  limit: number;
}

export async function uploadFile(params: UploadFileParams) {
  const { user, file, fileSize, folderId } = params;

  if (folderId) {
    const folder = await prisma.folder.findFirst({ where: { id: folderId, ownerId: user.id } });
    if (!folder) throw new Error('Folder not found or access denied');
  }

  const salt = generateSalt();

  const fileMetadata = await prisma.file.create({
    data: {
      name: file.name,
      size: fileSize,
      mimeType: file.type || 'application/octet-stream',
      encryptionKeySalt: salt,
      minioObjectKey: '',
      folderId: folderId || null,
      ownerId: user.id,
    },
  });

  try {
    const encryptionKey = deriveFileEncryptionKey(salt, fileMetadata.id);
    const objectKey = `${user.id}/${fileMetadata.id}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await uploadFileWithEncryption(objectKey, buffer, encryptionKey, {
      'Content-Type': file.type || 'application/octet-stream',
      'Original-Filename': file.name,
    });

    const updatedFile = await prisma.file.update({ where: { id: fileMetadata.id }, data: { minioObjectKey: objectKey } });

    await prisma.user.update({ where: { id: user.id }, data: { storageUsed: { increment: fileSize } } });

    return {
      id: updatedFile.id,
      name: updatedFile.name,
      size: updatedFile.size,
      mimeType: updatedFile.mimeType,
      folderId: updatedFile.folderId,
      createdAt: updatedFile.createdAt,
    };
  } catch (error) {
    await prisma.file.delete({ where: { id: fileMetadata.id } });
    throw error;
  }
}

export async function downloadFile(fileId: string, userId: string) {
  const file = await prisma.file.findFirst({ where: { id: fileId, ownerId: userId } });
  if (!file) throw new Error('File not found or access denied');

  const encryptionKey = deriveFileEncryptionKey(file.encryptionKeySalt, file.id);
  const buffer = await downloadFileWithDecryption(file.minioObjectKey, encryptionKey);

  return { buffer, filename: file.name, mimeType: file.mimeType };
}

export async function deleteFile(fileId: string, userId: string) {
  const file = await prisma.file.findFirst({ where: { id: fileId, ownerId: userId } });
  if (!file) throw new Error('File not found or access denied');

  await deleteMinioFile(file.minioObjectKey);
  await prisma.file.delete({ where: { id: file.id } });

  await prisma.user.update({ where: { id: userId }, data: { storageUsed: { decrement: file.size } } });

  return { success: true };
}

export async function listFiles(params: ListFilesParams) {
  const { userId, folderId, page, limit } = params;
  const skip = (page - 1) * limit;

  const where = { ownerId: userId, folderId: folderId || null };

  const [files, total] = await Promise.all([
    prisma.file.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit, select: { id: true, name: true, size: true, mimeType: true, folderId: true, createdAt: true, updatedAt: true } }),
    prisma.file.count({ where }),
  ]);

  return { files, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getFileMetadata(fileId: string, userId: string) {
  const file = await prisma.file.findFirst({ where: { id: fileId, ownerId: userId }, select: { id: true, name: true, size: true, mimeType: true, folderId: true, createdAt: true, updatedAt: true, folder: { select: { id: true, name: true } } } });
  if (!file) throw new Error('File not found or access denied');
  return file;
}

export async function moveFile(fileId: string, userId: string, targetFolderId: string | null) {
  const file = await prisma.file.findFirst({ where: { id: fileId, ownerId: userId } });
  if (!file) throw new Error('File not found or access denied');

  if (targetFolderId) {
    const folder = await prisma.folder.findFirst({ where: { id: targetFolderId, ownerId: userId } });
    if (!folder) throw new Error('Target folder not found or access denied');
  }

  const updatedFile = await prisma.file.update({ where: { id: fileId }, data: { folderId: targetFolderId } });

  return { id: updatedFile.id, name: updatedFile.name, folderId: updatedFile.folderId };
}
