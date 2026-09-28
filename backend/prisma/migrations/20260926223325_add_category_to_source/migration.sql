-- AlterTable
ALTER TABLE "sources" ADD COLUMN     "categoryId" TEXT;

-- AddForeignKey
ALTER TABLE "sources" ADD CONSTRAINT "sources_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
