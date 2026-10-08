import { z } from "zod";

export type FieldErrors = Record<string, string[] | undefined>;

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

/** Error de negocio con mensaje apto para mostrar al usuario. */
export class ActionError extends Error {
  constructor(
    message: string,
    public fieldErrors?: FieldErrors,
  ) {
    super(message);
  }
}

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function invalid(error: z.ZodError): ActionResult<never> {
  const flat = z.flattenError(error);
  // Aplana rutas anidadas (paidBy.payers.0.amount → "paidBy") para la UI.
  const fieldErrors: FieldErrors = { ...flat.fieldErrors };
  return {
    ok: false,
    error: flat.formErrors[0] ?? error.issues[0]?.message ?? "Datos inválidos",
    fieldErrors,
  };
}

export function fail(e: unknown): ActionResult<never> {
  if (e instanceof ActionError) return { ok: false, error: e.message, fieldErrors: e.fieldErrors };
  console.error(e);
  return { ok: false, error: "Algo salió mal. Intenta de nuevo." };
}
