-- AlterTable
ALTER TABLE "sponsor" ADD COLUMN     "website_link" TEXT;

-- CreateTable
CREATE TABLE "companyPartner" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(50),
    "logo_link" TEXT,

    CONSTRAINT "companyPartner_pkey" PRIMARY KEY ("id")
);
