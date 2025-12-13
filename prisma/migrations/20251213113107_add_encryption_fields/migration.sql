-- AlterTable
ALTER TABLE "files" ADD COLUMN     "encrypted_file_key" TEXT,
ADD COLUMN     "encryption_iv" TEXT;
