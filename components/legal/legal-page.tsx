import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Páginas públicas (sin login): Google exige enlaces de privacidad y
// condiciones para publicar la app de OAuth.
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-6 py-12">
      <Link href="/" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" /> Viajes
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <div className="text-muted-foreground space-y-4 text-sm leading-relaxed [&_h2]:text-foreground [&_h2]:pt-2 [&_h2]:text-base [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
      <p className="text-muted-foreground text-xs">Última actualización: 22 de octubre de 2026.</p>
    </main>
  );
}
