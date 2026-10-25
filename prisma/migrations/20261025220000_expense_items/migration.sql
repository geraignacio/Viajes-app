-- División por ítem: cada integrante marca lo que consumió.
ALTER TYPE "SplitType" ADD VALUE 'ITEMIZED';

-- CreateTable
CREATE TABLE "ExpenseItem" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "amount" INTEGER NOT NULL,
    "memberIds" TEXT[],

    CONSTRAINT "ExpenseItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ExpenseItem_amount_check" CHECK ("amount" > 0)
);

-- CreateIndex
CREATE INDEX "ExpenseItem_expenseId_idx" ON "ExpenseItem"("expenseId");

-- AddForeignKey
ALTER TABLE "ExpenseItem" ADD CONSTRAINT "ExpenseItem_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Igual que las demás tablas: sin acceso por la API REST de Supabase.
ALTER TABLE "ExpenseItem" ENABLE ROW LEVEL SECURITY;
