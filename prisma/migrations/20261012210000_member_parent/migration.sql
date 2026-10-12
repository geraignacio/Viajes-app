-- Hijo/a a cargo de otro integrante del viaje.
ALTER TABLE "TripMember" ADD COLUMN "parentMemberId" TEXT;

CREATE INDEX "TripMember_parentMemberId_idx" ON "TripMember"("parentMemberId");

ALTER TABLE "TripMember" ADD CONSTRAINT "TripMember_parentMemberId_fkey"
  FOREIGN KEY ("parentMemberId") REFERENCES "TripMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TripMember" ADD CONSTRAINT "TripMember_parent_not_self"
  CHECK ("parentMemberId" IS NULL OR "parentMemberId" <> "id");
