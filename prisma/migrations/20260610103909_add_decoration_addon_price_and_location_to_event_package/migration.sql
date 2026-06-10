-- AlterTable
ALTER TABLE "EventPackage" ADD COLUMN     "decorationAddonPrice" INTEGER NOT NULL DEFAULT 375,
ADD COLUMN     "locationId" TEXT;

-- CreateIndex
CREATE INDEX "EventPackage_locationId_isActive_sortOrder_idx" ON "EventPackage"("locationId", "isActive", "sortOrder");

-- AddForeignKey
ALTER TABLE "EventPackage" ADD CONSTRAINT "EventPackage_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
