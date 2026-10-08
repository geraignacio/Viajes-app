"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * "Tiempo real" sin infraestructura extra: refresca los Server Components
 * cada `intervalMs` mientras la pestaña está visible, y al volver a ella.
 * Barato en el plan gratuito: solo 5 consultas agregadas por refresco.
 */
export function AutoRefresh({ intervalMs = 10_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => document.visibilityState === "visible" && router.refresh();
    const id = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, intervalMs]);
  return null;
}
