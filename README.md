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
5. **Fotos del viaje (Google Drive)**: en el mismo proyecto de Google Cloud activa la *Google Drive API* (*APIs & Services → Library*) y agrega el scope `.../auth/drive.file` en la pantalla de consentimiento. Publica la app (*Publishing status → In production*): en modo *Testing* los permisos de Drive caducan a los 7 días. `drive.file` no es un scope sensible, así que no requiere verificación de Google.
6. **Escanear boletas (opcional)**: crea una clave gratuita en [Google AI Studio](https://aistudio.google.com/apikey) y agrégala en Vercel como `GEMINI_API_KEY` (*Settings → Environment Variables*), luego vuelve a desplegar. Sin la clave, el botón "Escanear boleta" no aparece. En el plan gratuito Google puede usar las fotos para mejorar sus modelos; la app no las guarda.
7. **Pausa por inactividad**: Supabase gratis pausa el proyecto tras ~7 días sin uso y el login falla con "Server error". Un cron diario de Vercel (`vercel.json`) llama a `/api/keep-alive` para evitarlo; si igual se pausa, usa *Restore project* en Supabase y vuelve a desplegar.

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
