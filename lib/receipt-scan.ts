import "server-only";
import { z } from "zod";
import { CATEGORIES } from "@/lib/constants";

// Lectura de boletas con Gemini (Google). Requiere GEMINI_API_KEY, una clave
// gratuita de https://aistudio.google.com/apikey. La foto se manda a Google
// solo para leerla; la app no la guarda.

// Primero el que se configure; si un modelo no existe o no está disponible
// para la clave, se prueba el siguiente.
const MODELS = [
  ...new Set(
    [process.env.GEMINI_MODEL, "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest", "gemini-2.0-flash"].filter(
      Boolean,
    ),
  ),
] as string[];
// Tiempo total para leer una boleta (la función de Vercel tiene maxDuration 60 s).
const DEADLINE_MS = 50_000;
// Por llamada: si un modelo se cuelga, queda tiempo para probar otro.
const CALL_TIMEOUT_MS = 22_000;

export const receiptSchema = z.object({
  title: z.string().max(140).catch(""),
  total: z.coerce.number().nonnegative().catch(0),
  currency: z.string().max(3).catch(""),
  date: z.string().catch(""),
  category: z.preprocess((v) => (typeof v === "string" ? v.toUpperCase() : v), z.enum(CATEGORIES)).catch("OTHER"),
  items: z
    .array(z.object({ name: z.string().max(100).catch("Ítem"), amount: z.coerce.number().catch(0) }))
    .catch([])
    .transform((items) => items.filter((i) => i.amount > 0).slice(0, 60)),
});
export type ScannedReceipt = z.infer<typeof receiptSchema>;

const PROMPT = `Eres un lector de boletas y facturas para una app de gastos compartidos de viaje.
Lee la foto y devuelve:
- title: descripción corta en español del gasto (nombre del local o lo comprado, ej. "Cena en Restaurante Aurora"), máx. 60 caracteres.
- total: el monto TOTAL pagado, como número sin separadores de miles (ej. 25990 o 150.5). Si la boleta suma la propina al total, inclúyela; si la propina aparece solo como "sugerida" aparte, no la sumes.
- currency: código ISO 4217 de la moneda (CLP, BRL, ARS, USD, EUR...). Deduce por el país, el símbolo o el idioma; "" si no se puede saber.
- date: fecha de la compra en formato YYYY-MM-DD, o "" si no aparece.
- category: LODGING (alojamiento), TRANSPORT (vuelos, buses, taxis, combustible, peajes), FOOD (restaurantes, supermercado, bebidas), ACTIVITIES (entradas, tours) u OTHER.
- items: cada línea de producto con su nombre (incluye la cantidad, ej. "4 Stella Artois Schop") y su monto total de la línea (cantidad × precio), como número sin separadores de miles. No incluyas subtotales, impuestos, propinas ni descuentos como ítems. Lista vacía si no se distinguen.
Los montos en pesos chilenos usan punto como separador de miles: "$19.600" es 19600.
Si la imagen no es una boleta, devuelve total 0.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    total: { type: "NUMBER" },
    currency: { type: "STRING" },
    date: { type: "STRING" },
    category: { type: "STRING" },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { name: { type: "STRING" }, amount: { type: "NUMBER" } },
        required: ["name", "amount"],
      },
    },
  },
  required: ["title", "total", "currency", "date", "category", "items"],
};

export function isReceiptScanEnabled() {
  return !!process.env.GEMINI_API_KEY;
}

/** Error de Gemini con un mensaje apto para la persona y el detalle para los logs. */
export class ReceiptScanError extends Error {
  constructor(
    public userMessage: string,
    detail: string,
  ) {
    super(detail);
  }
}

async function callGemini(model: string, key: string, body: unknown, timeoutMs: number) {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
}

/** Motivo breve para mostrar en pantalla (sin datos sensibles: Gemini no repite la clave). */
export function shortDetail(detail: string): string {
  const message = detail.match(/"message":\s*"([^"]+)"/)?.[1];
  const head = detail.split(":")[0];
  return (message ? `${head}: ${message}` : detail).slice(0, 180);
}

/** Texto JSON de la respuesta, tolerando ```json ... ``` alrededor. */
function parseJson(text: string): unknown {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? clean.slice(start, end + 1) : clean);
}

export async function scanReceiptImage(base64: string, mimeType: string): Promise<ScannedReceipt> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new ReceiptScanError("El escaneo de boletas aún no está configurado", "GEMINI_API_KEY vacía");
  const contents = [{ parts: [{ inline_data: { mime_type: mimeType, data: base64 } }, { text: PROMPT }] }];
  // Sin "pensar" (los modelos 2.5 piensan por defecto y tardan mucho más) y con
  // esquema; si el modelo rechaza alguna opción (400), se va quitando.
  const base = { temperature: 0, responseMimeType: "application/json" };
  const configs = [
    { ...base, responseSchema: RESPONSE_SCHEMA, thinkingConfig: { thinkingBudget: 0 } },
    { ...base, responseSchema: RESPONSE_SCHEMA },
    base,
  ];
  const deadline = Date.now() + DEADLINE_MS;

  let last = "";
  models: for (const model of MODELS) {
    for (const generationConfig of configs) {
      const left = deadline - Date.now();
      if (left < 3_000) break models;
      let res: Response;
      try {
        res = await callGemini(model, key, { contents, generationConfig }, Math.min(left, CALL_TIMEOUT_MS));
      } catch (e) {
        // Tiempo agotado o error de red: se prueba con el modelo siguiente.
        last = `${model}: ${e instanceof Error ? `${e.name} ${e.message}` : String(e)}`;
        console.error("Gemini", last);
        continue models;
      }
      const raw = await res.text();
      if (res.ok) {
        const data = JSON.parse(raw) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
        try {
          return receiptSchema.parse(parseJson(text));
        } catch {
          last = `${model}: respuesta no es JSON: ${text.slice(0, 200)}`;
          continue;
        }
      }
      last = `${model} ${res.status}: ${raw.slice(0, 400)}`;
      console.error("Gemini", last);
      if (res.status === 429) {
        throw new ReceiptScanError("Se alcanzó el límite gratis de Gemini. Intenta de nuevo en unos minutos.", last);
      }
      if (/API_KEY_INVALID|API key not valid|PERMISSION_DENIED|SERVICE_DISABLED/i.test(raw) || res.status === 401 || res.status === 403) {
        throw new ReceiptScanError("La clave de Gemini no es válida. Revisa GEMINI_API_KEY en Vercel.", last);
      }
      // 400 (opción no soportada): probar sin ella. 404 u otro: siguiente modelo.
      if (res.status !== 400) continue models;
    }
  }
  throw new ReceiptScanError(`No se pudo leer la boleta. Intenta con otra foto o anótala a mano. (Detalle: ${shortDetail(last)})`, last);
}
