import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/access";
import { GoogleSignIn } from "@/components/google-sign-in";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { JoinForm } from "./join-form";

export const metadata = { title: "Unirse a un viaje" };

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = raw.toUpperCase();
  const trip = await prisma.trip.findUnique({
    where: { inviteCode: code },
    include: { members: { where: { leftAt: null }, orderBy: { joinedAt: "asc" } } },
  });
  const user = await getSessionUser();

  if (trip && user && trip.members.some((m) => m.userId === user.id)) redirect(`/trips/${trip.id}`);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <Card>
        {!trip || trip.archivedAt ? (
          <CardHeader>
            <CardTitle>Invitación no válida</CardTitle>
            <CardDescription>El código no existe, fue regenerado o el viaje ya está cerrado.</CardDescription>
          </CardHeader>
        ) : (
          <>
            <CardHeader>
              <CardDescription>Te invitaron a</CardDescription>
              <CardTitle className="text-2xl">{trip.name}</CardTitle>
              <CardDescription className="flex items-center gap-1">
                <Users className="size-4" /> {trip.members.map((m) => m.displayName).join(", ")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {user ? (
                <JoinForm
                  code={code}
                  guests={trip.members.filter((m) => !m.userId).map((m) => ({ id: m.id, name: m.displayName }))}
                />
              ) : (
                <GoogleSignIn redirectTo={`/join/${code}`} />
              )}
            </CardContent>
          </>
        )}
      </Card>
    </main>
  );
}
