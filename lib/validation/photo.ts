import { z } from "zod";
import { id } from "./common";

export const startUploadSchema = z.object({
  tripId: id,
  name: z.string().trim().min(1).max(255),
  mimeType: z
    .string()
    .max(100)
    .regex(/^(image|video)\/[\w.+-]+$/, "Solo se pueden subir fotos y videos"),
  // Drive acepta hasta 5 TB; 10 GB es un tope sano para un video de celular.
  size: z.number().int().positive().max(10 * 1024 ** 3, "El archivo es demasiado grande"),
});

export const finishUploadSchema = z.object({
  tripId: id,
  fileId: z.string().min(1).max(128).regex(/^[\w-]+$/),
});

export const deletePhotoSchema = z.object({ tripId: id, photoId: id });
