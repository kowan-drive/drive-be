-- DropForeignKey
ALTER TABLE "userProfile" DROP CONSTRAINT "userProfile_user_id_fkey";

-- AddForeignKey
ALTER TABLE "userProfile" ADD CONSTRAINT "userProfile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
