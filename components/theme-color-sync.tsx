"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

const COLORS = { light: "#ffffff", dark: "#0a0a0a" } as const;

// Mantiene las barras del sistema (Android) del mismo color que el fondo,
// también cuando el tema se cambia a mano y no coincide con el del celular.
export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (resolvedTheme !== "light" && resolvedTheme !== "dark") return;
    const color = COLORS[resolvedTheme];
    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    metas.forEach((meta) => {
      meta.content = color;
      meta.removeAttribute("media");
    });
  }, [resolvedTheme]);

  return null;
}
