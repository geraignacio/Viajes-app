import { test } from "node:test";
import assert from "node:assert/strict";
import { expenseMessages, transferMessages, type NotifyMember } from "./messages.ts";

const fmt = (n: number) => `$${n}`;
const trip = { id: "t1", name: "Brasil" };
const members: NotifyMember[] = [
  { id: "mA", userId: "uA", parentMemberId: null, displayName: "Ana" },
  { id: "mB", userId: "uB", parentMemberId: null, displayName: "Beto" },
  { id: "mK", userId: null, parentMemberId: "mB", displayName: "Kiara" }, // hija de Beto sin cuenta
  { id: "mG", userId: null, parentMemberId: null, displayName: "Invitado" }, // sin cuenta
];

test("gasto: avisa a los involucrados menos a quien lo anotó; hijos suman al padre", () => {
  const msgs = expenseMessages({
    trip,
    expense: { id: "e1", title: "Cena", amount: 400 },
    authorUserId: "uA",
    authorName: "Ana",
    members,
    payers: [{ memberId: "mA", amount: 400 }],
    splits: [
      { memberId: "mA", amount: 100 },
      { memberId: "mB", amount: 100 },
      { memberId: "mK", amount: 100 },
      { memberId: "mG", amount: 100 },
    ],
    fmt,
  });
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].userId, "uB");
  assert.equal(msgs[0].body, "Ana anotó «Cena» por $400. Te toca $200.");
  assert.equal(msgs[0].url, "/trips/t1");
});

test("gasto: quien pagó (sin ser el autor) ve lo que puso", () => {
  const msgs = expenseMessages({
    trip,
    expense: { id: "e2", title: "Taxi", amount: 300 },
    authorUserId: "uA",
    authorName: "Ana",
    members,
    payers: [{ memberId: "mK", amount: 300 }],
    splits: [{ memberId: "mA", amount: 300 }],
    fmt,
  });
  assert.deepEqual(msgs.map((m) => m.body), ["Ana anotó «Taxi» por $300. Pusiste $300."]);
});

test("abono: avisa a quien recibe y a quien paga, nunca al autor", () => {
  const msgs = transferMessages({
    trip,
    transfer: { id: "x1", amount: 50, fromMemberId: "mK", toMemberId: "mA" },
    authorUserId: "uB",
    authorName: "Beto",
    members,
    fmt,
  });
  assert.deepEqual(
    msgs.map((m) => [m.userId, m.body]),
    [["uA", "Beto registró que Kiara te pagó $50."]],
  );

  const both = transferMessages({
    trip,
    transfer: { id: "x2", amount: 70, fromMemberId: "mA", toMemberId: "mB", expenseTitle: "Cena" },
    authorUserId: "uX",
    authorName: "Admin",
    members,
    fmt,
  });
  assert.deepEqual(both.map((m) => m.body), [
    "Admin registró que Ana te pagó $70 por «Cena».",
    "Admin registró que le pagaste $70 a Beto por «Cena».",
  ]);
});
