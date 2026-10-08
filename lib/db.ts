import { PrismaClient } from "@prisma/client";

// Una sola instancia por proceso. En dev, el hot reload recrearía el cliente
// en cada cambio y agotaría las conexiones, por eso se guarda en globalThis.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
