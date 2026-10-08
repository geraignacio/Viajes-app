import { z } from "zod";
import { CATEGORIES } from "@/lib/constants";
import { id, isoDate, nonNegativeAmount, optionalText, positiveAmount } from "./common";

const memberAmount = z.object({ memberId: id, amount: nonNegativeAmount });

const uniqueMembers = (rows: { memberId: string }[]) =>
  new Set(rows.map((r) => r.memberId)).size === rows.length;

export const paidBySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("single"), memberId: id }),
  z.object({
    mode: z.literal("multiple"),
    payers: z
      .array(memberAmount)
      .min(1, "Indica quién pagó")
      .refine(uniqueMembers, "Integrante repetido"),
  }),
]);

export const splitSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("EQUAL_ALL") }),
  z.object({
    type: z.literal("EQUAL_SELECTED"),
    memberIds: z
      .array(id)
      .min(1, "Selecciona al menos una persona")
      .refine((ids) => new Set(ids).size === ids.length, "Integrante repetido"),
  }),
  z.object({
    type: z.literal("EXACT"),
    shares: z
      .array(memberAmount)
      .min(1, "Asigna al menos un monto")
      .refine(uniqueMembers, "Integrante repetido"),
  }),
]);

// Las sumas (pagadores y montos exactos == total) se validan en el servidor
// DESPUÉS de convertir a unidades mínimas, para comparar enteros exactos.
export const expenseInputSchema = z.object({
  tripId: id,
  title: z.string().trim().min(1, "Ingresa un título").max(140),
  notes: optionalText(1000),
  amount: positiveAmount,
  category: z.enum(CATEGORIES),
  date: isoDate,
  paidBy: paidBySchema,
  split: splitSchema,
  receiptUrl: z
    .union([z.url({ protocol: /^https?$/, error: "URL inválida" }).max(2048), z.literal("")])
    .optional()
    .transform((v) => (v ? v : undefined)),
  receiptNote: optionalText(500),
});
export type ExpenseInput = z.input<typeof expenseInputSchema>;

export const deleteByIdSchema = z.object({ id });
