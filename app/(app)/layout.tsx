import Link from "next/link";
import { LogOut, Plane } from "lucide-react";
import { signOut } from "@/auth";
import { requireUser } from "@/lib/access";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
          <Link href="/trips" className="flex items-center gap-2 font-semibold">
            <Plane className="text-primary size-5" /> Viajes
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Link href="/profile" aria-label="Mi perfil y datos de transferencia" className="mx-1 rounded-full">
              <Avatar name={user.name ?? user.email ?? "?"} image={user.image} />
            </Link>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <Button variant="ghost" size="icon" aria-label="Cerrar sesión">
                <LogOut />
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
