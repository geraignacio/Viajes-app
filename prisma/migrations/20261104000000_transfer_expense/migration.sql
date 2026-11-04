-- Pagos ligados a un gasto ("Saldar" desde el gasto). Columna opcional: los
-- abonos existentes quedan igual y los saldos no cambian.
ALTER TABLE "Transfer" ADD COLUMN "expenseId" TEXT;

CREATE INDEX "Transfer_expenseId_idx" ON "Transfer"("expenseId");

ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
