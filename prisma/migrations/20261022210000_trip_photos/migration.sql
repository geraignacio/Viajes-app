-- Fotos y videos del viaje en Google Drive.
-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "driveFolderId" VARCHAR(128),
ADD COLUMN     "driveOwnerId" TEXT;

-- AlterTable
ALTER TABLE "TripMember" ADD COLUMN     "drivePermissionId" VARCHAR(128);

-- CreateTable
CREATE TABLE "TripPhoto" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "driveFileId" VARCHAR(128) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TripPhoto_driveFileId_key" ON "TripPhoto"("driveFileId");

-- CreateIndex
CREATE INDEX "TripPhoto_tripId_createdAt_idx" ON "TripPhoto"("tripId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "TripPhoto_uploadedById_idx" ON "TripPhoto"("uploadedById");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_driveOwnerId_fkey" FOREIGN KEY ("driveOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripPhoto" ADD CONSTRAINT "TripPhoto_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripPhoto" ADD CONSTRAINT "TripPhoto_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "TripMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Igual que el resto de las tablas: la API REST de Supabase no la puede leer.
ALTER TABLE "TripPhoto" ENABLE ROW LEVEL SECURITY;
