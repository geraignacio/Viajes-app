"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { CATEGORIES, CATEGORY_LABEL, type Category } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

export type ActivityEntry = {
  key: string;
  /** Texto en el que se busca (título, notas, referencia, nombres). */
  text: string;
  kind: Category | "TRANSFER";
  /** Integrantes involucrados: pagadores, divisiones o los dos lados del abono. */
  memberIds: string[];
  /** Monto del gasto (0 en abonos), para el total filtrado. */
  amount: number;
  node: React.ReactNode;
};

// Sin tildes ni mayúsculas: "cafe" encuentra "Café".
const normalize = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Buscador y filtros de la lista de movimientos (todo en el navegador, sin recargar). */
export function ActivityFilters({
  entries,
  members,
  currency,
}: {
  entries: ActivityEntry[];
  members: { id: string; name: string }[];
  currency: string;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"" | ActivityEntry["kind"]>("");
  const [memberId, setMemberId] = useState("");
  const active = query.trim() !== "" || kind !== "" || memberId !== "";

  const indexed = useMemo(() => entries.map((e) => ({ ...e, haystack: normalize(e.text) })), [entries]);
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const shown = indexed.filter(
    (e) =>
      (!kind || e.kind === kind) &&
      (!memberId || e.memberIds.includes(memberId)) &&
      words.every((w) => e.haystack.includes(w)),
  );
  const expenseCount = shown.filter((e) => e.kind !== "TRANSFER").length;
  const total = shown.reduce((a, e) => a + e.amount, 0);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            type="search"
            placeholder="Buscar gasto, nota o persona"
            aria-label="Buscar movimientos"
            className="pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <NativeSelect aria-label="Filtrar por categoría" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="">Todo</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
            <option value="TRANSFER">Abonos</option>
          </NativeSelect>
          <NativeSelect aria-label="Filtrar por persona" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            <option value="">Todos</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {active && (
        <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
          <span>
            {shown.length === 0
              ? "Sin resultados"
              : `${shown.length} ${shown.length === 1 ? "movimiento" : "movimientos"}` +
                (expenseCount > 0 ? ` · gastos por ${formatMoney(total, currency)}` : "")}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => {
              setQuery("");
              setKind("");
              setMemberId("");
            }}
          >
            <X /> Limpiar
          </Button>
        </div>
      )}

      <ul className="divide-y">{shown.map((e) => e.node)}</ul>
    </div>
  );
}
