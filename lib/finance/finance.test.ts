import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSplits, splitEqually } from "./split.ts";
import { buildBalances } from "./balances.ts";
import { minimizeTransfers } from "./settlement.ts";

test("partes iguales: reparte el resto de forma exacta y determinista", () => {
  const r = splitEqually(10_000, ["c", "a", "b"]);
  assert.deepEqual(r.map((x) => x.amount), [3334, 3333, 3333]);
  assert.equal(r.reduce((a, x) => a + x.amount, 0), 10_000);
});

test("montos exactos: rechaza si no suman el total", () => {
  assert.throws(() =>
    computeSplits(100, { type: "EXACT", shares: [{ memberId: "a", amount: 40 }, { memberId: "b", amount: 50 }] }),
  );
});

test("saldo y restante: cuota 100.000, abonó 60.000 → restan 40.000", () => {
  const m = (o: Record<string, number>) => new Map(Object.entries(o));
  const [carla, ana] = buildBalances(["carla", "ana"], {
    paid: m({ ana: 200_000 }),
    share: m({ carla: 100_000, ana: 100_000 }),
    sent: m({ carla: 60_000 }),
    received: m({ ana: 60_000 }),
  });
  assert.equal(carla.contributed, 60_000);
  assert.equal(carla.covered, 60_000);
  assert.equal(ana.covered, 100_000);
  assert.equal(carla.remaining, 40_000);
  assert.equal(carla.balance, -40_000);
  assert.equal(carla.progress, 0.6);
  assert.equal(ana.owedToMe, 40_000);
});

test("liquidación exacta mejora al greedy (3 pagos en vez de 4)", () => {
  const r = minimizeTransfers([
    { memberId: "A", balance: 7 },
    { memberId: "B", balance: -3 },
    { memberId: "C", balance: -4 },
    { memberId: "D", balance: 6 },
    { memberId: "E", balance: -6 },
  ]);
  assert.equal(r.length, 3);
});

test("liquidación: 2.000 casos aleatorios quedan en cero con ≤ k-1 pagos", () => {
  for (let t = 0; t < 2000; t++) {
    const k = 2 + Math.floor(Math.random() * 9);
    const b: { memberId: string; balance: number }[] = [];
    let s = 0;
    for (let i = 0; i < k - 1; i++) {
      const v = Math.floor(Math.random() * 2001) - 1000;
      b.push({ memberId: `m${i}`, balance: v });
      s += v;
    }
    b.push({ memberId: `m${k - 1}`, balance: -s || 0 });
    const r = minimizeTransfers(b);
    const bal = new Map(b.map((x) => [x.memberId, x.balance]));
    for (const x of r) {
      assert.ok(x.amount > 0);
      bal.set(x.from, bal.get(x.from)! + x.amount);
      bal.set(x.to, bal.get(x.to)! - x.amount);
    }
    for (const v of bal.values()) assert.equal(v, 0);
    assert.ok(r.length <= Math.max(0, b.filter((x) => x.balance !== 0).length - 1));
  }
});

test("cuotas: 100.000 en 6 cuotas suma exacto y vence cada mes", async () => {
  const { installmentStatus, splitInstallments, addMonths } = await import("./installments.ts");
  const parts = splitInstallments(100_000, 6);
  assert.equal(parts.reduce((a, b) => a + b, 0), 100_000);
  assert.deepEqual(parts, [16_667, 16_667, 16_667, 16_667, 16_666, 16_666]);
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");

  const plan = { installments: 6, baseAmount: 100_000, baseContributed: 5_000, firstDueDate: "2026-10-15" };
  // Debía 100.000 y desde entonces abonó 40.000 → 2 cuotas pagadas, la 3ª parcial.
  const s = installmentStatus(plan, { remaining: 60_000, contributed: 45_000 });
  assert.equal(s.paidCount, 2);
  assert.equal(s.next?.n, 3);
  assert.equal(s.next?.dueDate, "2026-12-15");
  assert.ok(s.next!.covered > 0.39 && s.next!.covered < 0.41);
  assert.equal(s.outdated, false);
  assert.equal(s.completed, false);

  assert.equal(installmentStatus(plan, { remaining: 0, contributed: 105_000 }).completed, true);
  // Gasto nuevo de 30.000: las 2 cuotas pagadas siguen pagadas, pero el plan queda desactualizado.
  const later = installmentStatus(plan, { remaining: 90_000, contributed: 45_000 });
  assert.equal(later.paidCount, 2);
  assert.equal(later.outdated, true);
});
