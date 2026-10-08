import { z } from "zod";
import { id, isoDate, optionalText, positiveAmount } from "./common";

export const transferInputSchema = z
  .object({
    tripId: id,
    fromMemberId: id,
    toMemberId: id,
    amount: positiveAmount,
    date: isoDate,
    note: optionalText(500),
  })
  .refine((t) => t.fromMemberId !== t.toMemberId, {
    path: ["toMemberId"],
    error: "No puedes registrar un abono a ti mismo",
  });
export type TransferInput = z.input<typeof transferInputSchema>;
