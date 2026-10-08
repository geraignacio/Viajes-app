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

const toMap = <T extends { _sum?: { amount?: number | null } }>(
  rows: T[],
  key: (r: T) => string,
) => new Map(rows.map((r) => [key(r), r._sum?.amount ?? 0]));

/**
 * Saldos de todo el viaje en 5 consultas agregadas (GROUP BY en Postgres),
 * independiente del número de gastos: O(miembros) filas transferidas.
 * Usa los índices (memberId) de ExpensePayer/ExpenseSplit y
 * (tripId, deletedAt) de Expense/Transfer.
 */
export async function getTripBalances(
  db: PrismaClient,
  tripId: string,
): Promise<MemberBalance[]> {
  const liveExpense = { tripId, deletedAt: null };
  const liveTransfer = { tripId, deletedAt: null };

  const [members, paid, share, sent, received] = await db.$transaction([
    db.tripMember.findMany({ where: { tripId }, select: { id: true } }),
    db.expensePayer.groupBy({
      by: ["memberId"],
      where: { expense: liveExpense },
      _sum: { amount: true },
      orderBy: { memberId: "asc" },
    }),
    db.expenseSplit.groupBy({
      by: ["memberId"],
      where: { expense: liveExpense },
      _sum: { amount: true },
      orderBy: { memberId: "asc" },
    }),
    db.transfer.groupBy({
      by: ["fromMemberId"],
      where: liveTransfer,
      _sum: { amount: true },
      orderBy: { fromMemberId: "asc" },
    }),
    db.transfer.groupBy({
      by: ["toMemberId"],
      where: liveTransfer,
      _sum: { amount: true },
      orderBy: { toMemberId: "asc" },
    }),
  ]);

  return buildBalances(
    members.map((m) => m.id),
    {
      paid: toMap(paid, (r) => r.memberId),
      share: toMap(share, (r) => r.memberId),
      sent: toMap(sent, (r) => r.fromMemberId),
      received: toMap(received, (r) => r.toMemberId),
    },
  );
}
