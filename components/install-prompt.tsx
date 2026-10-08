"use client";

import { useEffect, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "install-prompt-dismissed-at";
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000; // vuelve a ofrecer tras 2 semanas

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at > 0 && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

/**
 * Aviso para instalar la app en el celular.
 * - Android/Chrome: usa el diálogo nativo (beforeinstallprompt).
 * - iPhone/Safari: no existe diálogo nativo, así que explica cómo hacerlo.
 * No aparece si ya está instalada, en escritorio o si se descartó hace poco.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<"android" | "ios" | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone || recentlyDismissed()) return;

    const ua = navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
    if (isIOS) {
      // Solo Safari puede agregar a la pantalla de inicio en iOS.
      const isSafari = !/crios|fxios|edgios/i.test(ua);
      if (isSafari) setMode("ios");
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      if (!window.matchMedia("(pointer: coarse)").matches) return; // solo celulares/tablets
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("android");
    };
    const onInstalled = () => setMode(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setMode(null);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "dismissed") dismiss();
    else setMode(null);
    setDeferred(null);
  }

  if (!mode) return null;

  return (
    <div
      role="dialog"
      aria-label="Instalar la app"
      className="bg-card text-card-foreground animate-in slide-in-from-bottom-4 fixed inset-x-3 bottom-3 z-50 flex items-start gap-3 rounded-xl border p-4 shadow-lg sm:inset-x-auto sm:right-4 sm:max-w-sm"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" className="size-10 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-semibold">Instala Viajes</p>
        {mode === "android" ? (
          <>
            <p className="text-muted-foreground text-xs">Ábrela desde tu pantalla de inicio, como cualquier app.</p>
            <Button size="sm" onClick={install}>
              <Download /> Instalar
            </Button>
          </>
        ) : (
          <p className="text-muted-foreground text-xs leading-relaxed">
            Toca <Share className="inline size-3.5 align-text-bottom" /> <b>Compartir</b> abajo y luego{" "}
            <SquarePlus className="inline size-3.5 align-text-bottom" /> <b>Agregar a inicio</b>.
          </p>
        )}
      </div>
      <button onClick={dismiss} aria-label="Ahora no" className="text-muted-foreground hover:text-foreground -m-1 p-1">
        <X className="size-4" />
      </button>
    </div>
  );
}
