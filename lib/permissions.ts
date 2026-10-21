/**
 * Por quién puede registrar pagos alguien: por sí mismo, por personas sin
 * cuenta (nadie más puede hacerlo por ellas) y por sus hijos/as a cargo.
 * Aplica a todos, organizador incluido: nadie anota pagos de otra cuenta.
 */
export function canActFor(
  me: { id: string },
  target: { id: string; userId: string | null; parentMemberId: string | null },
) {
  return target.id === me.id || !target.userId || target.parentMemberId === me.id;
}
