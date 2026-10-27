-- CreateTable
CREATE TABLE "KeepAlive" (
    "id" INTEGER NOT NULL,
    "pingedAt" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "KeepAlive_pkey" PRIMARY KEY ("id")
);

-- Igual que el resto: sin acceso desde la API REST pública de Supabase.
ALTER TABLE "KeepAlive" ENABLE ROW LEVEL SECURITY;
