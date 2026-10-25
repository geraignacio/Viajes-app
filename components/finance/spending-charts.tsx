"use client";

import { useState } from "react";
import { CATEGORIES, CATEGORY_LABEL, type Category } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryIcon } from "./category-icon";

export type SpendingPoint = {
  category: Category;
  /** YYYY-MM-DD */
  date: string;
  amount: number;
  myShare: number;
};

const DAY_MS = 86_400_000;

/** Gráficos de gastos: por categoría y por día, del grupo o solo mi parte. */
export function SpendingCharts({ points, currency }: { points: SpendingPoint[]; currency: string }) {
  const [mine, setMine] = useState(false);
  const [hoverDay, setHoverDay] = useState<string | null>(null);
  if (points.length === 0) return null;

  const fmt = (n: number) => formatMoney(n, currency);
  const value = (p: SpendingPoint) => (mine ? p.myShare : p.amount);
  const total = points.reduce((a, p) => a + value(p), 0);

  const byCategory = CATEGORIES.map((c) => ({
    category: c,
    amount: points.filter((p) => p.category === c).reduce((a, p) => a + value(p), 0),
  }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const maxCategory = Math.max(1, ...byCategory.map((c) => c.amount));

  // Días seguidos entre el primer y el último gasto (hasta 60; si no, solo los días con gastos).
  const perDay = new Map<string, number>();
  for (const p of points) perDay.set(p.date, (perDay.get(p.date) ?? 0) + value(p));
  const sorted = [...perDay.keys()].sort();
  const first = Date.parse(sorted[0]);
  const span = Math.round((Date.parse(sorted.at(-1)!) - first) / DAY_MS) + 1;
  const days =
    span <= 60
      ? Array.from({ length: span }, (_, i) => new Date(first + i * DAY_MS).toISOString().slice(0, 10))
      : sorted;
  const maxDay = Math.max(1, ...days.map((d) => perDay.get(d) ?? 0));
  const shownDay = hoverDay ?? days.reduce((best, d) => ((perDay.get(d) ?? 0) > (perDay.get(best) ?? 0) ? d : best), days[0]);
  const dayLabel = (d: string) => formatDate(d, { year: undefined, month: "short" });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Gastos</CardTitle>
        <div className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1 text-xs" role="group" aria-label="Ver gastos de">
          {[
            { v: false, label: "Grupo" },
            { v: true, label: "Mi parte" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              aria-pressed={mine === o.v}
              onClick={() => setMine(o.v)}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors",
                mine === o.v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-muted-foreground text-sm font-medium">Por categoría</h3>
          {byCategory.length === 0 ? (
            <p className="text-muted-foreground text-sm">Todavía no tienes gastos asignados.</p>
          ) : (
            <ul className="space-y-3">
              {byCategory.map((c) => {
                const pct = total > 0 ? Math.round((c.amount / total) * 100) : 0;
                return (
                  <li key={c.category} className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <CategoryIcon category={c.category} className="text-muted-foreground size-4 shrink-0" />
                      <span className="flex-1 truncate">{CATEGORY_LABEL[c.category]}</span>
                      <span className="font-medium tabular-nums">{fmt(c.amount)}</span>
                      <span className="text-muted-foreground w-10 text-right text-xs tabular-nums">{pct}%</span>
                    </div>
                    <div className="bg-muted h-2 overflow-hidden rounded-full">
                      <div className="bg-primary h-full rounded-full" style={{ width: `${(c.amount / maxCategory) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {days.length > 1 && (
          <section className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-muted-foreground text-sm font-medium">Por día</h3>
              <p className="text-sm tabular-nums" aria-live="polite">
                <span className="text-muted-foreground">{dayLabel(shownDay)}:</span>{" "}
                <span className="font-medium">{fmt(perDay.get(shownDay) ?? 0)}</span>
              </p>
            </div>
            <div className="flex h-28 items-end gap-0.5" onMouseLeave={() => setHoverDay(null)}>
              {days.map((d) => {
                const v = perDay.get(d) ?? 0;
                return (
                  <button
                    key={d}
                    type="button"
                    aria-label={`${dayLabel(d)}: ${fmt(v)}`}
                    onMouseEnter={() => setHoverDay(d)}
                    onFocus={() => setHoverDay(d)}
                    onClick={() => setHoverDay(d)}
                    className="group flex h-full min-w-0 flex-1 items-end"
                  >
                    <span
                      className={cn(
                        "w-full rounded-t-[4px] transition-colors",
                        v > 0 ? (d === shownDay ? "bg-primary" : "bg-primary/55 group-hover:bg-primary") : "bg-muted h-px",
                      )}
                      style={v > 0 ? { height: `${Math.max(4, (v / maxDay) * 100)}%` } : undefined}
                    />
                  </button>
                );
              })}
            </div>
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>{dayLabel(days[0])}</span>
              <span>{dayLabel(days.at(-1)!)}</span>
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
