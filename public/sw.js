// Service worker mínimo: habilita la instalación como app.
// No cachea nada a propósito: los saldos siempre deben venir frescos del servidor.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
