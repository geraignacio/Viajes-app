import { z } from "zod";
import { CATEGORIES, CURRENCIES } from "@/lib/constants";
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
  z.object({
    type: z.literal("ITEMIZED"),
    items: z
      .array(
        z.object({
          name: z.string().trim().min(1, "Ponle nombre al ítem").max(100),
          amount: positiveAmount,
          memberIds: z
            .array(id)
            .min(1, "Marca quién consumió cada ítem")
            .refine((ids) => new Set(ids).size === ids.length, "Integrante repetido"),
        }),
      )
      .min(1, "Agrega al menos un ítem")
      .max(60, "Máximo 60 ítems"),
  }),
]);

// Las sumas (pagadores y montos exactos == total) se validan en el servidor
// DESPUÉS de convertir a unidades mínimas, para comparar enteros exactos.
// Todos los montos vienen en `currency`; el servidor los pasa a la del viaje.
export const expenseInputSchema = z.object({
  tripId: id,
  title: z.string().trim().min(1, "Ingresa un título").max(140),
  notes: optionalText(1000),
  amount: positiveAmount,
  // Moneda en que se anotaron los montos (si no se indica, la del viaje). Si es
  // otra, `fxRate` dice cuánto vale 1 unidad de ella en la moneda del viaje.
  currency: z.enum(CURRENCIES).optional(),
  fxRate: z
    .number({ error: "Tipo de cambio inválido" })
    .finite()
    .positive("El tipo de cambio debe ser mayor a 0")
    .max(10_000_000, "Tipo de cambio demasiado alto")
    .optional(),
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
