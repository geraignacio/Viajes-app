# Viajes · Modelo de datos y cálculo de saldos

Archivos de esta etapa:

- `prisma/schema.prisma` (validado con `prisma validate`, Prisma 6)
- `lib/finance/split.ts`: reparto exacto de montos
- `lib/finance/balances.ts`: saldos por integrante (pagado, cuota, abonado, restante)
- `lib/finance/settlement.ts`: liquidación con el mínimo de transferencias

## 1. Decisiones del esquema

| Decisión | Por qué |
|---|---|
| Montos como `Int` en unidades mínimas (CLP = pesos, USD = centavos) | Sin errores de punto flotante; `sum(splits) == amount` se verifica con igualdad exacta. `Int` llega a ~2.147 millones de CLP o ~21 millones de USD por registro, suficiente para un viaje (Zod pone el tope). |
| Una moneda por viaje (`Trip.currency`, ISO 4217) | Simplifica todos los cálculos. Multi-moneda queda como mejora futura (agregar `currency` + `fxRate` en `Expense`). |
| Todo lo financiero apunta a `TripMember`, no a `User` | Los saldos son por viaje, se pueden sumar acompañantes sin cuenta Google (`userId = null`) que luego reclaman su lugar, y alguien puede salir del viaje sin romper el historial. |
| `ExpensePayer` además de `ExpenseSplit` | Cubre el "pago compartido": una cena de 100.000 donde Ana puso 60.000 y Beto 40.000. Un pagador único es simplemente una fila. |
| Los splits se guardan ya calculados, también en partes iguales | El historial no cambia si entra o sale gente después. |
| Saldos **no** se persisten | Se derivan siempre de gastos y transferencias: una sola fuente de verdad, imposible que se desincronicen. |
| Borrado lógico (`deletedAt`) en gastos y transferencias | Auditoría y "deshacer". Los índices `(tripId, deletedAt, date)` cubren el listado. |
| `url` + `directUrl` en el datasource | En Vercel la app usa el Transaction Pooler de Supabase (PgBouncer, 6543, `pgbouncer=true&connection_limit=1`); Prisma CLI migra por `DIRECT_URL` (sesión, 5432). |
| `inviteCode` único y regenerable | URL `/join/{code}`; regenerarlo invalida el enlace anterior. |

Invariantes que se validan con Zod y en la Server Action (las sumas se comparan ya convertidas a enteros); la migración inicial agrega además `CHECK` en Postgres para montos positivos, `from <> to` y orden de fechas:

- `sum(ExpensePayer.amount) == Expense.amount`
- `sum(ExpenseSplit.amount) == Expense.amount`
- `Transfer.from != Transfer.to`, montos > 0, ambos miembros del mismo viaje.

## 2. Cálculo de saldos

Para cada integrante `m` del viaje (ignorando registros borrados):

```
pagado(m)    = Σ ExpensePayer.amount   donde memberId = m      // puso de su bolsillo
cuota(m)     = Σ ExpenseSplit.amount   donde memberId = m      // le corresponde
enviado(m)   = Σ Transfer.amount       donde from = m          // abonos que hizo
recibido(m)  = Σ Transfer.amount       donde to = m            // abonos que recibió

saldo(m)     = pagado − cuota + enviado − recibido
               > 0 → le deben     < 0 → debe     = 0 → al día
```

Invariante global: `Σ saldo(m) = 0` siempre (cada peso pagado se reparte en splits y cada abono sale de alguien y llega a otro). La liquidación lo verifica y falla si no cuadra.

### "Ya pagué X, me queda Y"

```
aportado(m)  = pagado + enviado − recibido     // lo que ya aportó a su cuota
abonado(m)   = min(cuota, max(0, aportado))    // lo que se muestra: nunca supera la cuota
restante(m)  = max(0, −saldo)                  // = max(0, cuota − aportado)
me deben(m)  = max(0,  saldo)                  // el exceso de quien adelantó de más
progreso(m)  = abonado / cuota                 // barra de progreso
```

Ejemplo: Carla tiene cuota 100.000, no pagó ningún gasto y transfirió 60.000 a Ana.
abonado = 0 + 60.000 − 0 = 60.000, saldo = 0 − 100.000 + 60.000 = −40.000.
La tarjeta muestra **Cuota asignada: $100.000 | Abonado: $60.000 | Restante por pagar: $40.000** y una barra al 60 %.

### Eficiencia

`getTripBalances` hace **5 consultas agregadas** (`groupBy` + `SUM` en Postgres) dentro de una transacción de lectura: miembros, pagado, cuota, enviados y recibidos. El costo no depende de cuántos gastos haya en memoria: Postgres suma usando los índices por `memberId` y por `(tripId, deletedAt)`, y a Node llegan solo `O(miembros)` filas. Luego `buildBalances` (función pura, testeable sin BD) arma el resultado.

Tiempo real: cada Server Action que crea, edita o borra un gasto o abono llama `revalidatePath` / `revalidateTag("trip:{id}")`, así quien la ejecuta ve el cambio al instante. Para los demás integrantes, el panel se refresca con un polling liviano (`router.refresh()` cada ~10 s con la pestaña visible), sin infraestructura extra. Si más adelante hace falta push real, se agrega Postgres `LISTEN/NOTIFY` + Server-Sent Events sin tocar el modelo.

## 3. Divisiones de un gasto

`computeSplits(total, input)`:

- **Partes iguales (todos o seleccionados):** `base = floor(total / n)` y el resto `total % n` se reparte de a 1 unidad entre los primeros por id, de forma determinista. 10.000 CLP entre 3 → 3.334 / 3.333 / 3.333. La suma siempre es exacta.
- **Montos exactos:** se exige que la suma sea igual al total; si no, error de validación que el formulario muestra en vivo ("faltan $2.500 por asignar").

## 4. Liquidación con el mínimo de transferencias

Con `k` personas con saldo distinto de cero, el mínimo de transferencias es **`k − g`**, donde `g` es el máximo número de grupos disjuntos cuyos saldos suman 0 (cada grupo se liquida internamente con `tamaño − 1` pagos).

- **Exacto para `k ≤ 20`** (cualquier viaje realista): programación dinámica sobre subconjuntos, `O(2^k · k)`, que encuentra `g` y los grupos. Dentro de cada grupo se empareja mayor deudor con mayor acreedor.
- **Respaldo para `k > 20`:** greedy mayor deudor ↔ mayor acreedor, que garantiza como máximo `k − 1` transferencias.

Por qué importa el exacto: con saldos A +7, B −3, C −4, D +6, E −6, el greedy simple propone 4 pagos; el algoritmo exacto encuentra 3 (E→D 6, C→A 4, B→A 3).

Verificado con 2.000 casos aleatorios: todas las cuentas quedan en cero, sin montos negativos, y nunca con más de `k − 1` transferencias.

Cuando alguien ejecuta un pago sugerido, se registra como `Transfer` normal; los saldos y la liquidación se recalculan solos.
