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

export async function createFolder(params: CreateFolderParams) {
  const { name, parentId, ownerId } = params;

  if (parentId) {
    const parentFolder = await prisma.folder.findFirst({ where: { id: parentId, ownerId } });
    if (!parentFolder) throw new Error('Parent folder not found or access denied');
  }

  const existing = await prisma.folder.findFirst({ where: { name, parentId: parentId || null, ownerId } });
  if (existing) throw new Error('Folder with this name already exists in this location');

  const folder = await prisma.folder.create({ data: { name, parentId: parentId || null, ownerId } });

  return { id: folder.id, name: folder.name, parentId: folder.parentId, createdAt: folder.createdAt };
}

export async function listFolders(ownerId: string, parentId?: string) {
  const folders = await prisma.folder.findMany({ where: { ownerId, parentId: parentId || null }, orderBy: { name: 'asc' }, select: { id: true, name: true, parentId: true, createdAt: true, updatedAt: true, _count: { select: { files: true, children: true } } } });

  return folders.map((folder) => ({ id: folder.id, name: folder.name, parentId: folder.parentId, createdAt: folder.createdAt, updatedAt: folder.updatedAt, filesCount: folder._count.files, foldersCount: folder._count.children }));
}

export async function updateFolder(params: UpdateFolderParams) {
  const { id, name, ownerId } = params;

  const folder = await prisma.folder.findFirst({ where: { id, ownerId } });
  if (!folder) throw new Error('Folder not found or access denied');

  const existing = await prisma.folder.findFirst({ where: { name, parentId: folder.parentId, ownerId, NOT: { id } } });
  if (existing) throw new Error('Folder with this name already exists in this location');

  const updatedFolder = await prisma.folder.update({ where: { id }, data: { name } });
  return { id: updatedFolder.id, name: updatedFolder.name, parentId: updatedFolder.parentId };
}

export async function deleteFolder(id: string, ownerId: string) {
  const folder = await prisma.folder.findFirst({ where: { id, ownerId } });
  if (!folder) throw new Error('Folder not found or access denied');

  const filesToDelete = await getAllFilesInFolder(id);

  for (const file of filesToDelete) {
    try {
      await deleteMinioFile(file.minioObjectKey);
    } catch (error) {
      console.error(`Failed to delete file ${file.id} from MinIO:`, error);
    }
  }

  const totalSize = filesToDelete.reduce((sum, file) => sum + file.size, BigInt(0));

  await prisma.folder.delete({ where: { id } });

  if (totalSize > BigInt(0)) {
    await prisma.user.update({ where: { id: ownerId }, data: { storageUsed: { decrement: totalSize } } });
  }

  return { success: true, deletedFiles: filesToDelete.length };
}

async function getAllFilesInFolder(folderId: string) {
  const files: Array<{ id: string; minioObjectKey: string; size: bigint }> = [];

  const directFiles = await prisma.file.findMany({ where: { folderId }, select: { id: true, minioObjectKey: true, size: true } });
  files.push(...directFiles);

  const childFolders = await prisma.folder.findMany({ where: { parentId: folderId }, select: { id: true } });

  for (const childFolder of childFolders as Array<{ id: string }>) {
    const childFiles = await getAllFilesInFolder(childFolder.id);
    files.push(...childFiles);
  }

  return files;
}
