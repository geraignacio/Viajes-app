import "server-only";
import { z } from "zod";
import { CATEGORIES } from "@/lib/constants";

// Lectura de boletas con Gemini (Google). Requiere GEMINI_API_KEY, una clave
// gratuita de https://aistudio.google.com/apikey. La foto se manda a Google
// solo para leerla; la app no la guarda.

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const TIMEOUT_MS = 30_000;

export const receiptSchema = z.object({
  title: z.string().max(140).catch(""),
  total: z.number().nonnegative().catch(0),
  currency: z.string().max(3).catch(""),
  date: z.string().catch(""),
  category: z.enum(CATEGORIES).catch("OTHER"),
  items: z
    .array(z.object({ name: z.string().max(100), amount: z.number().positive() }))
    .max(60)
    .catch([]),
});
export type ScannedReceipt = z.infer<typeof receiptSchema>;

const PROMPT = `Eres un lector de boletas y facturas para una app de gastos compartidos de viaje.
Lee la foto y devuelve:
- title: descripción corta en español del gasto (nombre del local o lo comprado, ej. "Cena en Restaurante Aurora"), máx. 60 caracteres.
- total: el monto TOTAL pagado, como número sin separadores de miles (ej. 25990 o 150.5). Si la boleta suma la propina al total, inclúyela; si la propina aparece solo como "sugerida" aparte, no la sumes.
- currency: código ISO 4217 de la moneda (CLP, BRL, ARS, USD, EUR...). Deduce por el país, el símbolo o el idioma; "" si no se puede saber.
- date: fecha de la compra en formato YYYY-MM-DD, o "" si no aparece.
- category: LODGING (alojamiento), TRANSPORT (vuelos, buses, taxis, combustible, peajes), FOOD (restaurantes, supermercado, bebidas), ACTIVITIES (entradas, tours) u OTHER.
- items: cada línea de producto con su nombre y su monto total de la línea (cantidad × precio). No incluyas subtotales, impuestos, propinas ni descuentos como ítems. Lista vacía si no se distinguen.
Si la imagen no es una boleta, devuelve total 0.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    total: { type: "NUMBER" },
    currency: { type: "STRING" },
    date: { type: "STRING" },
    category: { type: "STRING", enum: [...CATEGORIES] },
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

export async function scanReceiptImage(base64: string, mimeType: string): Promise<ScannedReceipt> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY no configurada");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: base64 } }, { text: PROMPT }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return receiptSchema.parse(JSON.parse(text));
}
