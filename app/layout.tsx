import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { InstallPrompt } from "@/components/install-prompt";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Los Endeudados", template: "%s · Los Endeudados" },
  description: "Gastos compartidos de viaje con saldos y abonos al día.",
  applicationName: "Los Endeudados",
  appleWebApp: { capable: true, title: "Endeudados", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-dvh font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster richColors position="top-center" />
          <InstallPrompt />
        </ThemeProvider>
      </body>
    </html>
  );
}
