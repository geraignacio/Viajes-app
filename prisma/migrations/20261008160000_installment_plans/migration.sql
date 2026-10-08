-- CreateTable
CREATE TABLE "InstallmentPlan" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "installments" INTEGER NOT NULL,
    "baseAmount" INTEGER NOT NULL,
    "baseContributed" INTEGER NOT NULL,
    "firstDueDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstallmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstallmentPlan_memberId_key" ON "InstallmentPlan"("memberId");

-- AddForeignKey
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TripMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_installments_range" CHECK ("installments" BETWEEN 2 AND 24);
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_base_positive"      CHECK ("baseAmount" > 0);
