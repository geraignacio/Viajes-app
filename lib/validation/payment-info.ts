import { z } from "zod";
import { optionalText } from "./common";
import { formatRut, isValidRut } from "@/lib/rut";

export const paymentInfoSchema = z
  .object({
    holderName: optionalText(100),
    rut: optionalText(12).refine((v) => !v || isValidRut(v), "RUT inválido").transform((v) => (v ? formatRut(v) : v)),
    bank: optionalText(60),
    accountType: optionalText(40),
    accountNumber: optionalText(30).refine((v) => !v || /^[\d\s-]+$/.test(v), "Solo números y guiones"),
    email: z
      .union([z.email({ error: "Correo inválido" }).max(120), z.literal("")])
      .optional()
      .transform((v) => (v ? v : undefined)),
    notes: optionalText(300),
  })
  .refine((d) => Object.values(d).some(Boolean), { error: "Completa al menos un dato" });
export type PaymentInfoInput = z.input<typeof paymentInfoSchema>;
