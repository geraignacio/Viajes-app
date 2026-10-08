-- CreateTable
CREATE TABLE "PaymentInfo" (
    "userId" TEXT NOT NULL,
    "holderName" VARCHAR(100),
    "rut" VARCHAR(12),
    "bank" VARCHAR(60),
    "accountType" VARCHAR(40),
    "accountNumber" VARCHAR(30),
    "email" VARCHAR(120),
    "notes" VARCHAR(300),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentInfo_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "PaymentInfo" ADD CONSTRAINT "PaymentInfo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── Seguridad por filas (RLS) ─────────────────────────────────────────────
-- Supabase publica una API REST sobre el schema "public". Activar RLS sin
-- políticas hace que esa API no pueda leer ni escribir nada; la app conecta
-- con el rol dueño de las tablas (vía Prisma), que no está sujeto a RLS.
ALTER TABLE "User"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Trip"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TripMember"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExpensePayer"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExpenseSplit"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transfer"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InstallmentPlan"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentInfo"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
