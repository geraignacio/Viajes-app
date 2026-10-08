import type { PrismaClient } from "@prisma/client";

export type MemberBalance = {
  memberId: string;
  /** Lo que puso de su bolsillo en gastos (ExpensePayer). */
  paid: number;
  /** Cuota asignada: lo que le corresponde según las divisiones (ExpenseSplit). */
  share: number;
  /** Abonos enviados a otros integrantes (Transfer.from). */
  sent: number;
  /** Abonos recibidos de otros integrantes (Transfer.to). */
  received: number;
  /** paid - share + sent - received. > 0 le deben, < 0 debe. */
  balance: number;
  /** Lo que ya aportó a su cuota: paid + sent - received. */
  contributed: number;
  /** Parte de la cuota ya cubierta, acotada a [0, cuota] (lo que se muestra como "Abonado"). */
  covered: number;
  /** Restante por pagar: max(0, -balance). */
  remaining: number;
  /** Lo que aún le deben: max(0, balance). */
  owedToMe: number;
  /** 0..1 para la barra de progreso (contributed / share). */
  progress: number;
};

type Totals = { paid: number; share: number; sent: number; received: number };

/**
 * Función pura: arma los saldos a partir de sumas agregadas por miembro.
 * Separada de la BD para poder testearla sin Postgres.
 */
export function buildBalances(
  memberIds: string[],
  sums: {
    paid: Map<string, number>;
    share: Map<string, number>;
    sent: Map<string, number>;
    received: Map<string, number>;
  },
): MemberBalance[] {
  return memberIds.map((memberId) => {
    const t: Totals = {
      paid: sums.paid.get(memberId) ?? 0,
      share: sums.share.get(memberId) ?? 0,
      sent: sums.sent.get(memberId) ?? 0,
      received: sums.received.get(memberId) ?? 0,
    };
    const balance = t.paid - t.share + t.sent - t.received;
    const contributed = t.paid + t.sent - t.received;
    return {
      memberId,
      ...t,
      balance,
      contributed,
      covered: Math.min(t.share, Math.max(0, contributed)),
      remaining: Math.max(0, -balance),
      owedToMe: Math.max(0, balance),
      progress: t.share === 0 ? 1 : Math.min(1, Math.max(0, contributed / t.share)),
    };
  });
}

type BalanceRow = { memberId: string; paid: bigint; share: bigint; sent: bigint; received: bigint };

/**
 * Saldos de todo el viaje en UNA consulta: por cada integrante, cuatro
 * subconsultas SUM correlacionadas (usan los índices por memberId). Una sola
 * ida y vuelta a la BD sin importar cuántos gastos o abonos haya.
 */
export async function getTripBalances(db: PrismaClient, tripId: string): Promise<MemberBalance[]> {
  const rows = await db.$queryRaw<BalanceRow[]>`
    SELECT m."id" AS "memberId",
      COALESCE((SELECT SUM(p."amount") FROM "ExpensePayer" p JOIN "Expense" e ON e."id" = p."expenseId"
                WHERE p."memberId" = m."id" AND e."deletedAt" IS NULL), 0) AS "paid",
      COALESCE((SELECT SUM(s."amount") FROM "ExpenseSplit" s JOIN "Expense" e ON e."id" = s."expenseId"
                WHERE s."memberId" = m."id" AND e."deletedAt" IS NULL), 0) AS "share",
      COALESCE((SELECT SUM(t."amount") FROM "Transfer" t
                WHERE t."fromMemberId" = m."id" AND t."deletedAt" IS NULL), 0) AS "sent",
      COALESCE((SELECT SUM(t."amount") FROM "Transfer" t
                WHERE t."toMemberId" = m."id" AND t."deletedAt" IS NULL), 0) AS "received"
    FROM "TripMember" m
    WHERE m."tripId" = ${tripId}
    ORDER BY m."joinedAt" ASC`;

  const col = (k: Exclude<keyof BalanceRow, "memberId">) =>
    new Map(rows.map((r) => [r.memberId, Number(r[k])]));
  return buildBalances(
    rows.map((r) => r.memberId),
    { paid: col("paid"), share: col("share"), sent: col("sent"), received: col("received") },
  );
}
