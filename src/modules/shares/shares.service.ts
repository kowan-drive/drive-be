import prisma from '../../../prisma/prisma';
import { generateShareToken } from '../../lib/encryption';
import { generatePresignedUrl } from '../../lib/minio';

interface CreateShareParams {
  fileId: string;
  userId: string;
  expiresInHours: number;
  maxDownloads?: number;
}

export async function createShare(params: CreateShareParams) {
  const { fileId, userId, expiresInHours, maxDownloads } = params;

  const file = await prisma.file.findFirst({ where: { id: fileId, ownerId: userId } });
  if (!file) throw new Error('File not found or access denied');

  const token = generateShareToken();

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expiresInHours);

  const share = await prisma.share.create({ data: { token, fileId, expiresAt, maxDownloads: maxDownloads || null } });

  return { token: share.token, shareUrl: `${process.env.APP_URL || 'http://localhost:3001'}/api/v1/shares/${token}`, expiresAt: share.expiresAt, maxDownloads: share.maxDownloads };
}

export async function accessShare(token: string) {
  const share = await prisma.share.findUnique({ where: { token }, include: { file: true } });
  if (!share) throw new Error('Share link not found');

  if (share.expiresAt < new Date()) throw new Error('Share link has expired');

  if (share.maxDownloads !== null && share.downloadCount >= share.maxDownloads) throw new Error('Download limit reached for this share link');

  await prisma.share.update({ where: { id: share.id }, data: { downloadCount: { increment: 1 } } });

  const presignedUrl = await generatePresignedUrl(share.file.minioObjectKey, 3600);

  return { presignedUrl, filename: share.file.name, size: share.file.size, mimeType: share.file.mimeType, expiresAt: share.expiresAt, downloadsRemaining: share.maxDownloads !== null ? share.maxDownloads - share.downloadCount : null };
}

export async function listShares(userId: string) {
  const shares = await prisma.share.findMany({ where: { file: { ownerId: userId }, expiresAt: { gt: new Date() } }, include: { file: { select: { id: true, name: true, size: true, mimeType: true } } }, orderBy: { createdAt: 'desc' } });

  return shares.map((share: any) => ({ id: share.id, token: share.token, shareUrl: `${process.env.APP_URL || 'http://localhost:3001'}/api/v1/shares/${share.token}`, file: share.file, expiresAt: share.expiresAt, maxDownloads: share.maxDownloads, downloadCount: share.downloadCount, createdAt: share.createdAt }));
}

export async function deleteShare(shareId: string, userId: string) {
  const share = await prisma.share.findFirst({ where: { id: shareId, file: { ownerId: userId } } });
  if (!share) throw new Error('Share not found or access denied');

  await prisma.share.delete({ where: { id: shareId } });

  return { success: true };
}
