/*
  Warnings:

  - You are about to drop the column `job_id` on the `faq` table. All the data in the column will be lost.
  - Added the required column `company_id` to the `faq` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "faq" DROP CONSTRAINT "faq_job_id_fkey";

-- AlterTable
ALTER TABLE "faq" DROP COLUMN "job_id",
ADD COLUMN     "company_id" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "faq" ADD CONSTRAINT "faq_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
