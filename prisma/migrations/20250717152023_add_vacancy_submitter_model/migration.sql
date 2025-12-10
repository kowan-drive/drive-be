/*
  Warnings:

  - You are about to drop the column `userId` on the `VacancySubmission` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "VacancySubmission" DROP CONSTRAINT "VacancySubmission_userId_fkey";

-- AlterTable
ALTER TABLE "VacancySubmission" DROP COLUMN "userId",
ADD COLUMN     "submitter_id" TEXT;

-- CreateTable
CREATE TABLE "VacancySubmitter" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "vacancy_id" TEXT NOT NULL,

    CONSTRAINT "VacancySubmitter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VacancySubmitter_user_id_vacancy_id_key" ON "VacancySubmitter"("user_id", "vacancy_id");

-- AddForeignKey
ALTER TABLE "VacancySubmission" ADD CONSTRAINT "VacancySubmission_submitter_id_fkey" FOREIGN KEY ("submitter_id") REFERENCES "VacancySubmitter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacancySubmitter" ADD CONSTRAINT "VacancySubmitter_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacancySubmitter" ADD CONSTRAINT "VacancySubmitter_vacancy_id_fkey" FOREIGN KEY ("vacancy_id") REFERENCES "Vacancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
