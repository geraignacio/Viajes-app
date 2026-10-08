import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

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
    async signIn({ user, profile, isNewUser }) {
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
