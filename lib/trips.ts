import "server-only";
import { prisma } from "@/lib/db";
import { getTripBalances, type MemberBalance } from "@/lib/finance/balances";
import { minimizeTransfers, type Settlement } from "@/lib/finance/settlement";

export type TripStatus = "active" | "past";

export function tripStatus(trip: { archivedAt: Date | null; endDate: Date | null }): TripStatus {
  if (trip.archivedAt) return "past";
  if (!trip.endDate) return "active";
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return trip.endDate < today ? "past" : "active";
}

/** Viajes del usuario con total gastado (una consulta agregada para todos). */
export async function listTripsForUser(userId: string) {
  const trips = await prisma.trip.findMany({
    where: { members: { some: { userId, leftAt: null } } },
    include: { _count: { select: { members: { where: { leftAt: null } } } } },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
  });
  const totals = await prisma.expense.groupBy({
    by: ["tripId"],
    where: { tripId: { in: trips.map((t) => t.id) }, deletedAt: null },
    _sum: { amount: true },
    orderBy: { tripId: "asc" },
  });
  const totalByTrip = new Map(totals.map((t) => [t.tripId, t._sum.amount ?? 0]));
  return trips.map((t) => ({
    ...t,
    status: tripStatus(t),
    totalSpent: totalByTrip.get(t.id) ?? 0,
    memberCount: t._count.members,
  }));
}

export type TripDashboard = Awaited<ReturnType<typeof getTripDashboard>>;

/** Todo lo que necesita la vista del viaje (y la exportación). */
export async function getTripDashboard(tripId: string) {
  const [trip, balances, expenses, transfers] = await Promise.all([
    prisma.trip.findUniqueOrThrow({
      where: { id: tripId },
      include: {
        members: {
          orderBy: { joinedAt: "asc" },
          include: { user: { select: { image: true, email: true } } },
        },
      },
    }),
    getTripBalances(prisma, tripId),
    prisma.expense.findMany({
      where: { tripId, deletedAt: null },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: { payers: true, splits: true },
    }),
    prisma.transfer.findMany({
      where: { tripId, deletedAt: null },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const settlement: Settlement[] = minimizeTransfers(balances);
  const totalSpent = expenses.reduce((a, e) => a + e.amount, 0);
  const balanceById = new Map<string, MemberBalance>(balances.map((b) => [b.memberId, b]));

  return { trip, balances, balanceById, expenses, transfers, settlement, totalSpent };
}
