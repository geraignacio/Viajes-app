-- Gastos en otra moneda: `amount` sigue en la moneda del viaje (los saldos no
-- cambian); se guarda además el monto original y el tipo de cambio usado.
ALTER TABLE "Expense" ADD COLUMN "originalCurrency" CHAR(3),
ADD COLUMN "originalAmount" INTEGER,
ADD COLUMN "fxRate" DOUBLE PRECISION;

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_original_check" CHECK (
  ("originalCurrency" IS NULL AND "originalAmount" IS NULL AND "fxRate" IS NULL)
  OR ("originalCurrency" IS NOT NULL AND "originalAmount" > 0 AND "fxRate" > 0)
);
