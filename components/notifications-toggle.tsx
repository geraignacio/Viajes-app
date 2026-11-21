"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deletePushSubscription, savePushSubscription } from "@/server-actions/push";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type State = "loading" | "unsupported" | "ios-install" | "off" | "on" | "blocked";

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (!existing) await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

/** Botón de campana: activa/desactiva los avisos de gastos y abonos en este dispositivo. */
export function NotificationsToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!PUBLIC_KEY) return setState("unsupported");
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) {
        const ua = navigator.userAgent;
        const isIOS = /iphone|ipad|ipod/i.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
        // En iPhone los avisos solo existen con la app agregada a la pantalla de inicio.
        return setState(isIOS ? "ios-install" : "unsupported");
      }
      if (Notification.permission === "denied") return setState("blocked");
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      if (sub && Notification.permission === "granted") {
        // Re-sincroniza por si cambió la cuenta en este navegador.
        await savePushSubscription(sub.toJSON());
        setState("on");
      } else setState("off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        if (permission === "denied") toast.error("Bloqueaste los avisos. Puedes permitirlos en los ajustes del navegador.");
        return;
      }
      const reg = await registration();
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY!),
        }));
      const res = await savePushSubscription(sub.toJSON());
      if (!res.ok) throw new Error(res.error);
      setState("on");
      toast.success("Listo: te avisaremos cuando anoten un gasto o un pago que te incluya");
    } catch {
      toast.error("No se pudieron activar los avisos en este dispositivo");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      toast.success("Avisos desactivados en este dispositivo");
    } catch {
      toast.error("No se pudieron desactivar los avisos");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading" || state === "unsupported") return null;

  const label =
    state === "on"
      ? "Avisos activados (toca para desactivar)"
      : state === "blocked"
        ? "Avisos bloqueados en este navegador"
        : "Activar avisos de gastos y pagos";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      disabled={busy}
      onClick={() => {
        if (state === "on") return disable();
        if (state === "off") return enable();
        if (state === "blocked")
          return toast.info("Los avisos están bloqueados. Permítelos en los ajustes del navegador para este sitio.");
        toast.info(
          "En iPhone, primero agrega Viajes a la pantalla de inicio (Compartir → Agregar a inicio) y ábrela desde ahí.",
        );
      }}
    >
      {state === "on" ? <BellRing className="text-primary" /> : state === "blocked" ? <BellOff /> : <Bell />}
    </Button>
  );
}
