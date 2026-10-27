import { prisma } from "@/lib/db";

// Supabase (plan gratis) pausa el proyecto tras ~7 días sin actividad en la
// BD; con la BD pausada el login falla con "Server error". Un cron diario de
// Vercel (vercel.json) llama a esta ruta. Un `SELECT 1` no bastó (Supabase
// avisó igual que iba a pausar), así que se hace una lectura de una tabla real
// y una escritura en KeepAlive, que sí cuentan como uso.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const now = new Date();
    const [ping] = await prisma.$transaction([
      prisma.keepAlive.upsert({
        where: { id: 1 },
        create: { id: 1, pingedAt: now, count: 1 },
        update: { pingedAt: now, count: { increment: 1 } },
      }),
      prisma.user.count(),
    ]);
    return Response.json({ ok: true, pings: ping.count });
  } catch (e) {
    console.error("keep-alive: la base de datos no responde", e);
    return Response.json({ ok: false }, { status: 503 });
  }
}
