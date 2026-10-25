import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSplits, splitByItems, splitEqually } from "./split.ts";
import { buildBalances } from "./balances.ts";
import { minimizeTransfers } from "./settlement.ts";
import { allocateProportional, convertMinor } from "./fx.ts";

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

test("RUT: valida dígito verificador y formatea", async () => {
  const { isValidRut, formatRut } = await import("../rut.ts");
  assert.equal(isValidRut("11.111.111-1"), true);
  assert.equal(isValidRut("12345678-5"), true);
  assert.equal(isValidRut("12345678-6"), false);
  assert.equal(isValidRut("7654321-6"), true);
  assert.equal(formatRut("123456785"), "12.345.678-5");
});

test("Hijos/as: su saldo se suma al del padre/madre en el cierre", async () => {
  const { familyHeads, familyBalances } = await import("./families.ts");
  const m = (id: string, paid: number, share: number) => ({ id, paid, share });
  // Cena 90.000 pagada por Ana, 30.000 c/u entre Gerald, su hija Sofi y Ana.
  const people = [m("ana", 90_000, 30_000), m("ger", 0, 30_000), m("sofi", 0, 30_000)];
  const zero = new Map<string, number>();
  const balances = buildBalances(
    people.map((p) => p.id),
    {
      paid: new Map(people.map((p) => [p.id, p.paid])),
      share: new Map(people.map((p) => [p.id, p.share])),
      sent: zero,
      received: zero,
    },
  );
  const heads = familyHeads([
    { id: "ana", parentMemberId: null },
    { id: "ger", parentMemberId: null },
    { id: "sofi", parentMemberId: "ger" },
  ]);
  const fam = familyBalances(balances, heads);
  assert.deepEqual(
    fam.map((b) => [b.memberId, b.balance, b.share, b.remaining]),
    [
      ["ana", 60_000, 30_000, 0],
      ["ger", -60_000, 60_000, 60_000],
    ],
  );
  assert.deepEqual(minimizeTransfers(fam), [{ from: "ger", to: "ana", amount: 60_000 }]);
  // Padre/madre que no está en el viaje: responde por sí mismo.
  assert.equal(familyHeads([{ id: "x", parentMemberId: "nadie" }]).get("x"), "x");
});

test("moneda extranjera: 150 BRL a 172,35 CLP = 25.853 CLP", () => {
  assert.equal(convertMinor(15_000, 172.35, 2, 0), 25_853);
  assert.equal(convertMinor(25_853, 1 / 172.35, 0, 2), 15_000);
});

test("moneda extranjera: el reparto proporcional suma exacto", () => {
  assert.deepEqual(allocateProportional(25_853, [10_000, 5_000]), [17_235, 8_618]);
  assert.deepEqual(allocateProportional(100, [1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(allocateProportional(5_000, [5_000, 0]), [5_000, 0]);
  for (let i = 0; i < 2_000; i++) {
    const weights = Array.from({ length: 1 + (i % 7) }, () => Math.floor(Math.random() * 50_000));
    if (!weights.some((w) => w > 0)) weights[0] = 1;
    const total = Math.floor(Math.random() * 10_000_000);
    const r = allocateProportional(total, weights);
    assert.equal(r.reduce((a, n) => a + n, 0), total);
    r.forEach((n, j) => assert.ok(n >= 0 && (weights[j] > 0 || n === 0)));
  }
});

test("por ítem: cada uno paga lo suyo y la propina en proporción", () => {
  const r = splitByItems(17_600, [
    { amount: 10_000, memberIds: ["ana", "beto"] },
    { amount: 6_000, memberIds: ["ana"] },
  ]);
  assert.deepEqual(r, [
    { memberId: "ana", amount: 12_100 },
    { memberId: "beto", amount: 5_500 },
  ]);
  // Sin propina, la suma de los ítems es el total.
  assert.equal(splitByItems(1_000, [{ amount: 1_000, memberIds: ["a", "b", "c"] }]).reduce((a, s) => a + s.amount, 0), 1_000);
  // Los ítems no pueden sumar más que el gasto.
  assert.throws(() => splitByItems(100, [{ amount: 150, memberIds: ["a"] }]));
});
