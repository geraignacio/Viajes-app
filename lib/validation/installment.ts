import { z } from "zod";
import { id, isoDate } from "./common";

export const INSTALLMENT_OPTIONS = [2, 3, 4, 5, 6, 8, 10, 12, 18, 24] as const;

export const installmentPlanSchema = z.object({
  tripId: id,
  memberId: id,
  installments: z
    .number({ error: "Elige el número de cuotas" })
    .int()
    .min(2, "Mínimo 2 cuotas")
    .max(24, "Máximo 24 cuotas"),
  firstDueDate: isoDate,
});

export const deleteInstallmentPlanSchema = z.object({ tripId: id, memberId: id });
