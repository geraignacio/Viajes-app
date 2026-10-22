/** Datos serializables que los Server Components pasan a los cliente. */
import type { PaymentInfoLite } from "@/lib/payment-info";

export type MemberLite = {
  id: string;
  name: string;
  image?: string | null;
  /** Datos para recibir transferencias (solo de integrantes con cuenta que los cargaron). */
  payment?: PaymentInfoLite | null;
  /** Si quien mira puede registrar pagos a nombre de esta persona (ver lib/permissions). */
  canActFor?: boolean;
  /** Padre/madre que responde por esta persona (hijo/a a cargo). */
  parentId?: string | null;
};
