import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel no lo necesita; la imagen Docker de producción sí (BUILD_STANDALONE=1).
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  // jsPDF trae dependencias opcionales de navegador; se carga tal cual en Node.
  serverExternalPackages: ["jspdf", "jspdf-autotable"],
  // Fotos de boletas (se achican en el navegador, pero por si acaso).
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
};

export default nextConfig;
