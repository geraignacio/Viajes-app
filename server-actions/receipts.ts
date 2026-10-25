"use server";

import { requireMember } from "@/lib/access";
import { ReceiptScanError, scanReceiptImage, shortDetail, isReceiptScanEnabled, type ScannedReceipt } from "@/lib/receipt-scan";
import { ActionError, fail, ok, type ActionResult } from "@/lib/action-result";

const MAX_BYTES = 4 * 1024 * 1024;

/** Lee una foto de boleta y devuelve los datos para prellenar el formulario de gasto. */
export async function scanReceipt(form: FormData): Promise<ActionResult<ScannedReceipt>> {
  try {
    const tripId = form.get("tripId");
    const file = form.get("image");
    if (typeof tripId !== "string" || !(file instanceof File)) throw new ActionError("Falta la foto");
    await requireMember(tripId);
    if (!isReceiptScanEnabled()) throw new ActionError("El escaneo de boletas aún no está configurado");
    if (!file.type.startsWith("image/")) throw new ActionError("El archivo debe ser una imagen");
    if (file.size > MAX_BYTES) throw new ActionError("La foto es demasiado grande");

    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    let receipt: ScannedReceipt;
    try {
      receipt = await scanReceiptImage(base64, file.type);
    } catch (e) {
      console.error("scanReceipt", e);
      throw new ActionError(
        e instanceof ReceiptScanError
          ? e.userMessage
          : `No se pudo leer la boleta. Intenta con otra foto o anótala a mano. (Detalle: ${shortDetail(e instanceof Error ? `${e.name} ${e.message}` : String(e))})`,
      );
    }
    if (receipt.total <= 0) throw new ActionError("No encontré el total en la foto. Prueba con más luz y la boleta completa.");
    return ok(receipt);
  } catch (e) {
    return fail(e);
  }
}
