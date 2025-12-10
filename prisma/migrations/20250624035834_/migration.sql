/*
  Warnings:

  - You are about to drop the column `email` on the `company` table. All the data in the column will be lost.
  - Made the column `name` on table `company` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "company" DROP COLUMN "email",
ALTER COLUMN "name" SET NOT NULL;
