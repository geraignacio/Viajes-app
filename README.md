# Viajes

Gastos compartidos de viaje con saldos, abonos ("ya pagué X, me queda Y") y cierre de cuentas con el mínimo de transferencias.

Next.js 16 (App Router, React 19) · Prisma 6 + PostgreSQL (Supabase) · Auth.js v5 con Google · Tailwind 4 + componentes shadcn/ui · Vercel.

## Estructura

```
app/
  page.tsx                       Login con Google
  (app)/layout.tsx               Protege todo lo de adentro (requireUser)
  (app)/trips/page.tsx           Viajes activos y pasados, crear y unirse
  (app)/trips/[tripId]/page.tsx  Panel del viaje
  join/[code]/                   Unirse por enlace o código
  api/auth/[...nextauth]/        Handlers de Auth.js
  api/trips/[tripId]/export/     Exportación ?format=csv|pdf
components/
  ui/                            Primitivas shadcn (button, card, dialog, tabs…)
  finance/                       Métricas, saldos, liquidación, movimientos, modal gasto/abono
  trips/                         Crear viaje, invitar, agregar acompañante, exportar
lib/
  finance/                       split, balances, settlement (+ tests)
  validation/                    Esquemas Zod compartidos cliente/servidor
  access.ts  trips.ts  money.ts  export.ts  db.ts
server-actions/                  trips, expenses, transfers, balances
prisma/                          schema.prisma y migraciones
auth.ts                          Configuración de Auth.js
```

## Despliegue en Vercel + Supabase (plan gratuito)

1. **Supabase**: crea el proyecto y copia en *Project Settings → Database → Connection string*:
   - *Transaction pooler* (puerto 6543) → `DATABASE_URL`, agregando `?pgbouncer=true&connection_limit=1`.
   - *Session pooler* (puerto 5432) → `DIRECT_URL`. Se usa la de sesión del pooler porque la conexión directa del plan gratuito es solo IPv6 y los builds de Vercel salen por IPv4.
2. **Google OAuth**: en Google Cloud Console crea un *OAuth client ID* tipo Web con el redirect `https://<tu-app>.vercel.app/api/auth/callback/google` (y el de localhost para desarrollo).
3. **Vercel**: importa el repo y define `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` (`npx auth secret`), `AUTH_GOOGLE_ID` y `AUTH_GOOGLE_SECRET`.
4. Deploy. `postinstall` ejecuta `prisma generate` y Vercel usa el script `vercel-build`, que aplica las migraciones pendientes (`prisma migrate deploy`, vía `DIRECT_URL`) antes de `next build`. Si prefieres migrar a mano, cambia el *Build Command* a `next build` y corre `npm run db:deploy` desde tu equipo.

## Desarrollo local

Con Docker:

```bash
cp .env.example .env   # AUTH_SECRET y credenciales de Google
docker compose up      # Postgres + app en http://localhost:3000
```

Sin Docker (contra Supabase o un Postgres propio):

```bash
npm install            # postinstall genera el cliente de Prisma
npm run db:migrate
npm run dev
```

Tests de la lógica financiera: `npm test`.
