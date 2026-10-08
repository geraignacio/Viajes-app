// Constantes compartidas entre cliente y servidor (sin importar @prisma/client
// en componentes cliente). Deben coincidir con los enums del schema.

export const CURRENCIES = ["CLP", "USD", "EUR", "ARS", "PEN", "BRL", "MXN", "COP"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CATEGORIES = ["LODGING", "TRANSPORT", "FOOD", "ACTIVITIES", "OTHER"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  LODGING: "Alojamiento",
  TRANSPORT: "Vuelos / Transporte",
  FOOD: "Comida",
  ACTIVITIES: "Actividades",
  OTHER: "Otros",
};

export const SPLIT_TYPES = ["EQUAL_ALL", "EQUAL_SELECTED", "EXACT"] as const;
export type SplitTypeValue = (typeof SPLIT_TYPES)[number];

export const SPLIT_LABEL: Record<SplitTypeValue, string> = {
  EQUAL_ALL: "Partes iguales entre todos",
  EQUAL_SELECTED: "Partes iguales entre seleccionados",
  EXACT: "Montos exactos por persona",
};
