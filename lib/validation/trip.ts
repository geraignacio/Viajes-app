import { z } from "zod";
import { CURRENCIES } from "@/lib/constants";
import { id, isoDate, optionalText } from "./common";

const tripFields = z.object({
  name: z.string().trim().min(1, "Ponle un nombre al viaje").max(120),
  description: optionalText(1000),
  startDate: isoDate.optional().or(z.literal("").transform(() => undefined)),
  endDate: isoDate.optional().or(z.literal("").transform(() => undefined)),
});

const datesInOrder = (t: { startDate?: string; endDate?: string }) =>
  !t.startDate || !t.endDate || t.endDate >= t.startDate;
const datesError = { path: ["endDate"], error: "La fecha de término debe ser posterior al inicio" };

export const createTripSchema = tripFields
  .extend({ currency: z.enum(CURRENCIES, { error: "Moneda no soportada" }) })
  .refine(datesInOrder, datesError);
export type CreateTripInput = z.input<typeof createTripSchema>;

/** La moneda no se edita: todos los montos del viaje están guardados en ella. */
export const updateTripSchema = tripFields.extend({ tripId: id }).refine(datesInOrder, datesError);

export const joinTripSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6,16}$/, "Código inválido"),
  claimMemberId: id.optional(),
});

export const addGuestSchema = z.object({
  tripId: id,
  displayName: z.string().trim().min(1, "Ingresa un nombre").max(80),
});

export const removeMemberSchema = z.object({ tripId: id, memberId: id });

export const setParentSchema = z.object({
  tripId: id,
  memberId: id,
  /** null = deja de estar a cargo de alguien. */
  parentMemberId: id.nullable(),
});
