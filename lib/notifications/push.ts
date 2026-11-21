import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { expenseMessages, transferMessages, type PushMessage } from "./messages";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

export const pushEnabled = Boolean(PUBLIC_KEY && PRIVATE_KEY);

let configured = false;
function configure() {
  if (configured || !pushEnabled) return pushEnabled;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:avisos@viajes.app", PUBLIC_KEY!, PRIVATE_KEY!);
  configured = true;
  return true;
}

/** Envía cada aviso a todos los celulares/navegadores de esa persona. Nunca lanza. */
export async function sendPush(messages: PushMessage[]) {
  if (messages.length === 0 || !configure()) return;
  try {
    const subs = await prisma.pushSubscription.findMany({
      where: { userId: { in: [...new Set(messages.map((m) => m.userId))] } },
    });
    const gone: string[] = [];
    await Promise.all(
      messages.flatMap((m) =>
        subs
          .filter((s) => s.userId === m.userId)
          .map((s) =>
            webpush
              .sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                JSON.stringify({ title: m.title, body: m.body, url: m.url, tag: m.tag }),
                { TTL: 60 * 60 * 24, urgency: "normal", timeout: 8000 },
              )
              .catch((e: { statusCode?: number }) => {
                // 404/410: el navegador dio de baja la suscripción.
                if (e?.statusCode === 404 || e?.statusCode === 410) gone.push(s.id);
                else console.error("push", e);
              }),
          ),
      ),
    );
    if (gone.length) await prisma.pushSubscription.deleteMany({ where: { id: { in: gone } } });
  } catch (e) {
    console.error("push", e);
  }
}

const memberSelect = { id: true, userId: true, parentMemberId: true, displayName: true } as const;

export async function notifyExpenseCreated(expenseId: string, authorUserId: string) {
  if (!pushEnabled) return;
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      trip: { select: { id: true, name: true, currency: true } },
      createdBy: { select: { displayName: true } },
      payers: { select: { memberId: true, amount: true } },
      splits: { select: { memberId: true, amount: true } },
    },
  });
  if (!expense) return;
  const members = await prisma.tripMember.findMany({ where: { tripId: expense.tripId }, select: memberSelect });
  await sendPush(
    expenseMessages({
      trip: expense.trip,
      expense,
      authorUserId,
      authorName: expense.createdBy.displayName,
      members,
      payers: expense.payers,
      splits: expense.splits,
      fmt: (n) => formatMoney(n, expense.trip.currency),
    }),
  );
}

export async function notifyTransferCreated(transferId: string, authorUserId: string) {
  if (!pushEnabled) return;
  const transfer = await prisma.transfer.findUnique({
    where: { id: transferId },
    include: {
      trip: { select: { id: true, name: true, currency: true } },
      createdBy: { select: { displayName: true } },
      expense: { select: { title: true } },
    },
  });
  if (!transfer) return;
  const members = await prisma.tripMember.findMany({ where: { tripId: transfer.tripId }, select: memberSelect });
  await sendPush(
    transferMessages({
      trip: transfer.trip,
      transfer: { ...transfer, expenseTitle: transfer.expense?.title },
      authorUserId,
      authorName: transfer.createdBy.displayName,
      members,
      fmt: (n) => formatMoney(n, transfer.trip.currency),
    }),
  );
}
