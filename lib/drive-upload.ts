// Subida reanudable a Google Drive desde el navegador, por partes, para que
// un video largo no se pierda entero si la señal se corta un momento.
// La URL de sesión la abre el servidor (startPhotoUpload); no lleva token.

const CHUNK = 8 * 1024 * 1024; // múltiplo de 256 KB, como exige Drive
const RETRIES = 4;

type Sent = { done: true; fileId: string } | { done: false; next: number };

/** Envía una parte. Con `start` = null solo pregunta cuánto recibió Drive (tras un corte). */
function putChunk(url: string, file: Blob, start: number | null, onProgress: (sent: number) => void): Promise<Sent> {
  const end = start === null ? 0 : Math.min(start + CHUNK, file.size);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Range", start === null ? `bytes */${file.size}` : `bytes ${start}-${end - 1}/${file.size}`);
    if (start !== null) xhr.upload.onprogress = (e) => onProgress(start + e.loaded);
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) {
        try {
          resolve({ done: true, fileId: JSON.parse(xhr.responseText).id });
        } catch {
          reject(new Error("Respuesta inválida de Google Drive"));
        }
      } else if (xhr.status === 308) {
        // "Range: bytes=0-N" indica hasta dónde llegó; si no se puede leer, se asume la parte completa.
        const range = xhr.getResponseHeader("Range")?.match(/-(\d+)$/);
        resolve({ done: false, next: range ? Number(range[1]) + 1 : start === null ? -1 : end });
      } else {
        reject(Object.assign(new Error(`Drive respondió ${xhr.status}`), { status: xhr.status }));
      }
    };
    xhr.onerror = () => reject(new Error("Sin conexión"));
    xhr.send(start === null ? null : file.slice(start, end));
  });
}

/** Sube el archivo completo y devuelve el id del archivo en Drive. */
export async function uploadToDrive(url: string, file: File, onProgress: (fraction: number) => void) {
  let offset = 0;
  let failures = 0;
  while (true) {
    try {
      const res = await putChunk(url, file, offset, (sent) => onProgress(sent / file.size));
      if (res.done) {
        onProgress(1);
        return res.fileId;
      }
      offset = res.next;
      failures = 0;
    } catch (e) {
      const status = (e as { status?: number }).status;
      // 4xx (salvo 408/429) no se arregla reintentando.
      if (status && status < 500 && status !== 408 && status !== 429) throw e;
      if (++failures > RETRIES) throw e;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** failures));
      // Retoma desde lo que Drive alcanzó a guardar (si no lo informa, repite la parte).
      const resumed = await putChunk(url, file, null, () => {}).catch(() => null);
      if (resumed?.done) {
        onProgress(1);
        return resumed.fileId;
      }
      if (resumed && resumed.next >= 0) offset = resumed.next;
    }
  }
}

/** Algunos celulares entregan videos sin tipo; se deduce por la extensión. */
export function guessMimeType(file: File) {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    heic: "image/heic",
    heif: "image/heif",
    webp: "image/webp",
    mp4: "video/mp4",
    mov: "video/quicktime",
    "3gp": "video/3gpp",
    webm: "video/webm",
  };
  return map[ext] ?? "";
}
