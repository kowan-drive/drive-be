import { Client } from 'minio';
import { ENV } from './env';

export const minioClient = new Client({
  endPoint: ENV.MINIO_ENDPOINT,
  port: ENV.MINIO_PORT,
  useSSL: ENV.MINIO_USE_SSL,
  accessKey: ENV.MINIO_ROOT_USER,
  secretKey: ENV.MINIO_ROOT_PASSWORD,
});

export const BUCKET_NAME = ENV.MINIO_BUCKET_NAME;

export async function ensureBucket(): Promise<void> {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
      console.log(`✅ MinIO bucket '${BUCKET_NAME}' created successfully`);
    }
  } catch (error) {
    console.error('❌ Error ensuring MinIO bucket:', error);
    throw error;
  }
}

export async function uploadFileWithEncryption(
  objectKey: string,
  buffer: Buffer,
  encryptionKey: Buffer,
  metadata?: Record<string, string>,
) {
  const headers = {
    'X-Amz-Server-Side-Encryption-Customer-Algorithm': 'AES256',
    'X-Amz-Server-Side-Encryption-Customer-Key': encryptionKey.toString('base64'),
    'X-Amz-Server-Side-Encryption-Customer-Key-MD5': require('crypto')
      .createHash('md5')
      .update(encryptionKey)
      .digest('base64'),
  };

  return await minioClient.putObject(
    BUCKET_NAME,
    objectKey,
    buffer,
    buffer.length,
    {
      ...metadata,
      ...headers,
    },
  );
}

export async function downloadFileWithDecryption(objectKey: string, encryptionKey: Buffer): Promise<Buffer> {
  const headers = {
    'X-Amz-Server-Side-Encryption-Customer-Algorithm': 'AES256',
    'X-Amz-Server-Side-Encryption-Customer-Key': encryptionKey.toString('base64'),
    'X-Amz-Server-Side-Encryption-Customer-Key-MD5': require('crypto')
      .createHash('md5')
      .update(encryptionKey)
      .digest('base64'),
  };

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    minioClient.getObject(BUCKET_NAME, objectKey, headers)
      .then((dataStream: NodeJS.ReadableStream) => {
        dataStream.on('data', (chunk: Buffer) => chunks.push(chunk));
        dataStream.on('end', () => resolve(Buffer.concat(chunks)));
        dataStream.on('error', reject);
      })
      .catch((err: Error) => {
        reject(err);
      });
  });
}

export async function deleteFile(objectKey: string): Promise<void> {
  await minioClient.removeObject(BUCKET_NAME, objectKey);
}

export async function generatePresignedUrl(objectKey: string, expirySeconds: number = 3600): Promise<string> {
  return await minioClient.presignedGetObject(BUCKET_NAME, objectKey, expirySeconds);
}
