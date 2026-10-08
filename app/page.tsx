import { redirect } from "next/navigation";
import { Plane, Receipt, Scale } from "lucide-react";
import { getSessionUser } from "@/lib/access";
import { GoogleSignIn } from "@/components/google-sign-in";
import { ThemeToggle } from "@/components/theme-toggle";

// Solo se aceptan rutas internas como destino post-login.
const safeCallback = (v?: string) => (v && v.startsWith("/") && !v.startsWith("//") ? v : "/trips");

export default async function Home({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams;
  const target = safeCallback(callbackUrl);
  if (await getSessionUser()) redirect(target);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-12">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="space-y-3">
        <div className="bg-primary/10 text-primary inline-flex size-12 items-center justify-center rounded-xl">
          <Plane className="size-6" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Viajes</h1>
        <p className="text-muted-foreground">
          Registra los gastos del grupo, anota los abonos y sabe en todo momento cuánto pagaste y cuánto te queda.
        </p>
      </div>
      <ul className="text-muted-foreground space-y-3 text-sm">
        <li className="flex gap-3">
          <Receipt className="text-primary size-5 shrink-0" /> Gastos divididos en partes iguales o montos exactos.
        </li>
        <li className="flex gap-3">
          <Scale className="text-primary size-5 shrink-0" /> Saldos al día y cierre de cuentas con el mínimo de transferencias.
        </li>
      </ul>
      <GoogleSignIn redirectTo={target} />
    </main>
  );
}
