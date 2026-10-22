import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { hasDriveScope } from "@/lib/google-drive";

// Google es el único proveedor. La primera vez que alguien entra, el
// PrismaAdapter crea User + Account con el nombre, correo y avatar de Google.
// Sesiones en base de datos (tabla Session): revocables y sin JWT en el cliente.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Google],
  session: { strategy: "database" },
  pages: { signIn: "/" },
  trustHost: true,
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  events: {
    // Mantiene nombre y avatar al día si cambian en Google.
    async signIn({ user, account, profile, isNewUser }) {
      // El adapter no actualiza los tokens de una cuenta ya vinculada. Al dar
      // permiso de Drive (fotos del viaje) se guardan los nuevos; un login
      // normal no los toca para no perder ese permiso.
      if (!isNewUser && account?.provider === "google" && hasDriveScope(account.scope)) {
        await prisma.account.update({
          where: { provider_providerAccountId: { provider: "google", providerAccountId: account.providerAccountId } },
          data: {
            access_token: account.access_token,
            expires_at: account.expires_at,
            refresh_token: account.refresh_token ?? undefined,
            scope: account.scope,
            id_token: account.id_token,
          },
        });
      }
      if (isNewUser || !user.id || !profile) return;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          name: profile.name ?? undefined,
          image: typeof profile.picture === "string" ? profile.picture : undefined,
        },
      });
    },
  },
});
