import { prisma } from "@/lib/db";

// Supabase (plan gratis) pausa el proyecto tras ~7 días sin actividad en la
// BD; con la BD pausada el login falla con "Server error". Un cron diario de
// Vercel (vercel.json) llama a esta ruta y hace una consulta mínima.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true });
  } catch (e) {
    console.error("keep-alive: la base de datos no responde", e);
    return Response.json({ ok: false }, { status: 503 });
  }
}
