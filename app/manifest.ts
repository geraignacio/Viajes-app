import type { MetadataRoute } from "next";

// Manifiesto PWA: permite "Instalar app" / "Agregar a pantalla de inicio".
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Viajes",
    short_name: "Viajes",
    description: "Gastos compartidos de viaje con saldos y abonos al día.",
    lang: "es",
    start_url: "/trips",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0a",
    theme_color: "#1d4ed8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
