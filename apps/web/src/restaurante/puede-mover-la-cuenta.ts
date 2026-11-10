/**
 * QUIÉN VE «CAMBIAR DE MESA» EN EL PANEL DE LA MESA DEL MAPA (DP-15.1), sin pantalla.
 *
 * El enlace lleva a «Mesa activa» (`/restaurante/mesa-activa`), donde está «Pasarse a otra mesa».
 * Era sólo de dueño, administrador y gerente; la mesera, que es quien dice «nos pasamos a la
 * terraza» y quien ya podía hacerlo (`restaurante.cambiar_mesa` es de mesero, `cambio-de-mesa.ts`:
 * mover una cuenta no hace desaparecer dinero), tenía que llamar a un gerente o teclear la dirección.
 *
 * ── Sólo SUS mesas ───────────────────────────────────────────────────────
 * El mesero ve el enlace en la mesa que él atiende (la asignada a él, o la que abrió cuando no hay
 * asignación): no se le ofrece mover la cuenta de un compañero. Es una regla de la pantalla; el
 * servidor deja mover cualquier cuenta al mesero, y por eso ESTA función no es la que protege el
 * dinero —nada aquí lo toca—, sólo la que evita el toque equivocado.
 *
 * ── Y «dividir» sigue donde estaba ───────────────────────────────────────
 * Dividir hace desaparecer importes: es de caja y dirección (`ajustes-de-la-cuenta-por-rol.ts`) y
 * «Mesa activa» no se lo enseña al mesero. Unir se hace arrastrando en el mapa. Por eso al mesero
 * el enlace le promete sólo lo que puede hacer.
 *
 * Falla CERRADO: sin saber el puesto o quién es, no se ofrece.
 */
const DIRECCION = ['dueno', 'administrador', 'gerente'] as const;

export function puedeMoverLaCuenta(datos: {
  /** El puesto REAL de la sesión (`usePuesto`), no el rol de cuatro de la pantalla. */
  readonly puesto: string | null;
  readonly yoId: string | null | undefined;
  /** Quién atiende esta mesa (`resolverMeseroResponsable`); `null` si nadie. */
  readonly atiendeId: string | null | undefined;
  /**
   * DP-16 · La mesa es parte de un grupo UNIDO (principal o absorbida): el servidor no la mueve
   * («sepáralas antes»), así que el enlace no se ofrece. Sin decir: se ofrece (el servidor decide).
   */
  readonly unida?: boolean;
}): boolean {
  const { puesto, yoId, atiendeId } = datos;
  if (puesto === null) return false;
  if (datos.unida === true) return false;
  if ((DIRECCION as readonly string[]).includes(puesto)) return true;
  if (puesto !== 'mesero') return false;
  return yoId != null && atiendeId != null && yoId === atiendeId;
}

/** Lo que dice el enlace: a cada quien, lo que puede hacer desde ahí. */
export function textoDelEnlaceParaMoverLaCuenta(puesto: string | null): string {
  return puesto === 'mesero' ? 'Cambiar de mesa' : 'Cambiar de mesa, unir o dividir';
}
