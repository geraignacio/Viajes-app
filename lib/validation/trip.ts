import { z } from "zod";
import { CURRENCIES } from "@/lib/constants";
import { id, isoDate, optionalText } from "./common";

export const createTripSchema = z
  .object({
    name: z.string().trim().min(1, "Ponle un nombre al viaje").max(120),
    description: optionalText(1000),
    startDate: isoDate.optional().or(z.literal("").transform(() => undefined)),
    endDate: isoDate.optional().or(z.literal("").transform(() => undefined)),
    currency: z.enum(CURRENCIES, { error: "Moneda no soportada" }),
  })
  .refine((t) => !t.startDate || !t.endDate || t.endDate >= t.startDate, {
    path: ["endDate"],
    error: "La fecha de término debe ser posterior al inicio",
  });
export type CreateTripInput = z.input<typeof createTripSchema>;

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
