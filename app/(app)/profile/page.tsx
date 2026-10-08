import { ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/access";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentInfoForm } from "./payment-info-form";

export const metadata = { title: "Mi perfil" };

export default async function ProfilePage() {
  const user = await requireUser("/profile");
  const info = await prisma.paymentInfo.findUnique({ where: { userId: user.id } });

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Avatar name={user.name ?? user.email ?? "?"} image={user.image} className="size-12" />
        <div>
          <h1 className="text-xl font-bold">{user.name}</h1>
          <p className="text-muted-foreground text-sm">{user.email}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mis datos de transferencia</CardTitle>
          <CardDescription>
            Se muestran a tus compañeros de viaje cuando registran un abono para ti, con un botón para copiarlos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
            <ShieldCheck className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <p>
              Solo pide datos para <b>recibir</b> dinero. Nunca escribas claves, PIN, números de tarjeta ni
              coordenadas. Solo los ven personas que comparten un viaje contigo.
            </p>
          </div>
          <PaymentInfoForm
            initial={{
              holderName: info?.holderName ?? user.name ?? "",
              rut: info?.rut ?? "",
              bank: info?.bank ?? "",
              accountType: info?.accountType ?? "",
              accountNumber: info?.accountNumber ?? "",
              email: info?.email ?? user.email ?? "",
              notes: info?.notes ?? "",
            }}
            hasSaved={!!info}
          />
        </CardContent>
      </Card>
    </div>
  );
}
