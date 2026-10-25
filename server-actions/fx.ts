"use server";

import { z } from "zod";
import { requireMember } from "@/lib/access";
import { getExchangeRate, type FxQuote } from "@/lib/fx-rates";
import { CURRENCIES } from "@/lib/constants";
import { ActionError, fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { id, isoDate } from "@/lib/validation/common";

const fxQuerySchema = z.object({ tripId: id, currency: z.enum(CURRENCIES), date: isoDate });

/** Tipo de cambio para anotar un gasto en otra moneda (1 currency = rate moneda del viaje). */
export async function fetchExchangeRate(raw: unknown): Promise<ActionResult<FxQuote>> {
  const parsed = fxQuerySchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const { trip } = await requireMember(parsed.data.tripId);
    try {
      return ok(await getExchangeRate(parsed.data.currency, trip.currency, parsed.data.date));
    } catch (e) {
      console.error(e);
      throw new ActionError("No se pudo obtener el tipo de cambio. Escríbelo a mano.");
    }
  } catch (e) {
    return fail(e);
  }
}
