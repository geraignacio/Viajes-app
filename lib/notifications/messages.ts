// Arma los avisos (quién recibe y qué dice) a partir de un gasto o un abono.
// Funciones puras, sin BD, para poder probarlas.

export type NotifyMember = {
  id: string;
  userId: string | null;
  parentMemberId: string | null;
  displayName: string;
};

export type PushMessage = { userId: string; title: string; body: string; url: string; tag: string };

/**
 * Cuenta que recibe los avisos de un integrante: la suya, o la del padre/madre
 * si es un hijo/a (o acompañante) sin cuenta propia. Sin cuenta → nadie.
 */
export function accountFor(member: NotifyMember, byId: Map<string, NotifyMember>): string | null {
  if (member.userId) return member.userId;
  const parent = member.parentMemberId ? byId.get(member.parentMemberId) : undefined;
  return parent?.userId ?? null;
}

export function expenseMessages(input: {
  trip: { id: string; name: string };
  expense: { id: string; title: string; amount: number };
  authorUserId: string;
  authorName: string;
  members: NotifyMember[];
  payers: { memberId: string; amount: number }[];
  splits: { memberId: string; amount: number }[];
  fmt: (minor: number) => string;
}): PushMessage[] {
  const byId = new Map(input.members.map((m) => [m.id, m]));
  const share = new Map<string, number>(); // lo que le toca a cada cuenta
  const paid = new Map<string, number>();
  const add = (map: Map<string, number>, memberId: string, amount: number) => {
    const m = byId.get(memberId);
    const user = m && accountFor(m, byId);
    if (!user || user === input.authorUserId) return;
    map.set(user, (map.get(user) ?? 0) + amount);
  };
  for (const s of input.splits) if (s.amount > 0) add(share, s.memberId, s.amount);
  for (const p of input.payers) if (p.amount > 0) add(paid, p.memberId, p.amount);

  const users = new Set([...share.keys(), ...paid.keys()]);
  return [...users].map((userId) => {
    const mine = share.get(userId) ?? 0;
    const gave = paid.get(userId) ?? 0;
    const detail =
      gave > 0 && mine > 0
        ? `Pusiste ${input.fmt(gave)} y te toca ${input.fmt(mine)}.`
        : gave > 0
          ? `Pusiste ${input.fmt(gave)}.`
          : `Te toca ${input.fmt(mine)}.`;
    return {
      userId,
      title: input.trip.name,
      body: `${input.authorName} anotó «${input.expense.title}» por ${input.fmt(input.expense.amount)}. ${detail}`,
      url: `/trips/${input.trip.id}`,
      tag: `expense-${input.expense.id}`,
    };
  });
}

export function transferMessages(input: {
  trip: { id: string; name: string };
  transfer: { id: string; amount: number; fromMemberId: string; toMemberId: string; expenseTitle?: string | null };
  authorUserId: string;
  authorName: string;
  members: NotifyMember[];
  fmt: (minor: number) => string;
}): PushMessage[] {
  const byId = new Map(input.members.map((m) => [m.id, m]));
  const from = byId.get(input.transfer.fromMemberId);
  const to = byId.get(input.transfer.toMemberId);
  if (!from || !to) return [];
  const amount = input.fmt(input.transfer.amount);
  const forWhat = input.transfer.expenseTitle ? ` por «${input.transfer.expenseTitle}»` : "";
  const out: PushMessage[] = [];
  const seen = new Set<string>([input.authorUserId]);
  const push = (user: string | null, body: string) => {
    if (!user || seen.has(user)) return;
    seen.add(user);
    out.push({
      userId: user,
      title: input.trip.name,
      body,
      url: `/trips/${input.trip.id}`,
      tag: `transfer-${input.transfer.id}`,
    });
  };
  const toUser = accountFor(to, byId);
  const fromUser = accountFor(from, byId);
  push(
    toUser,
    to.userId === toUser
      ? `${input.authorName} registró que ${from.displayName} te pagó ${amount}${forWhat}.`
      : `${input.authorName} registró que ${from.displayName} le pagó ${amount} a ${to.displayName}${forWhat}.`,
  );
  push(
    fromUser,
    from.userId === fromUser
      ? `${input.authorName} registró que le pagaste ${amount} a ${to.displayName}${forWhat}.`
      : `${input.authorName} registró que ${from.displayName} le pagó ${amount} a ${to.displayName}${forWhat}.`,
  );
  return out;
}
