import { Client } from 'minio';
import { ENV } from './env';
import { Readable } from 'stream';

// Initialize MinIO client
export const minioClient = new Client({
    endPoint: ENV.MINIO_ENDPOINT,
    port: ENV.MINIO_PORT,
    useSSL: ENV.MINIO_USE_SSL,
    accessKey: ENV.MINIO_ROOT_USER,
    secretKey: ENV.MINIO_ROOT_PASSWORD,
});

export const BUCKET_NAME = ENV.MINIO_BUCKET_NAME;

/**
 * Ensure the MinIO bucket exists
 */
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

/**
 * Upload file to MinIO
 */
export async function uploadFileWithEncryption(
    objectKey: string,
    buffer: Buffer,
    encryptionKey: Buffer,
    metadata?: Record<string, string>,
) {
    return await minioClient.putObject(
        BUCKET_NAME,
        objectKey,
        buffer,
        buffer.length,
        metadata,
    );
}

/**
 * Download file from MinIO
 */
export async function downloadFileWithDecryption(
    objectKey: string,
    encryptionKey: Buffer,
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];

        minioClient.getObject(BUCKET_NAME, objectKey, (err, dataStream) => {
            if (err) {
                reject(err);
                return;
            }

            dataStream.on('data', (chunk) => chunks.push(chunk));
            dataStream.on('end', () => resolve(Buffer.concat(chunks)));
            dataStream.on('error', reject);
        });
    });
}

/**
 * Get file as a readable stream from MinIO
 */
export async function getFileStream(objectKey: string): Promise<Readable> {
    return await minioClient.getObject(BUCKET_NAME, objectKey);
}

/**
 * Delete file from MinIO
 */
export async function deleteFile(objectKey: string): Promise<void> {
    await minioClient.removeObject(BUCKET_NAME, objectKey);
}

/**
 * Generate presigned URL for temporary file access
 */
export async function generatePresignedUrl(
    objectKey: string,
    expirySeconds: number = 3600,
): Promise<string> {
    return await minioClient.presignedGetObject(BUCKET_NAME, objectKey, expirySeconds);
}
