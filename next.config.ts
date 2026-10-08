import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel no lo necesita; la imagen Docker de producción sí (BUILD_STANDALONE=1).
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  // jsPDF trae dependencias opcionales de navegador; se carga tal cual en Node.
  serverExternalPackages: ["jspdf", "jspdf-autotable"],
};

export default nextConfig;
