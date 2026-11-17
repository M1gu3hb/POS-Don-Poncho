/**
 * DP-21 · Bloque 8 · «ESTA PANTALLA ANUNCIA LAS COMANDAS», DE ESTE APARATO.
 *
 * Si dos aparatos enseñan la misma estación y los dos hablan, la cocina oye cada comanda dos veces
 * («lo repite 3 o 4 veces»). Un interruptor por aparato, como el modo espera: vive en el aparato
 * y no en el negocio.
 *
 * DP-22 · QUIÉN ANUNCIA SIN HABER ELEGIDO. Antes estaba encendido en todos los aparatos, y si el
 * dueño abría «Cocina» en el suyo, cada comanda se oía doble. Ahora, mientras el aparato no haya
 * elegido, lo decide el puesto de quien lo usa:
 *   · quien entra con el puesto de COCINA anuncia (una cocina que hoy habla no se queda muda) y se
 *     le pregunta una sola vez, sin estorbar, si de verdad es la pantalla que anuncia;
 *   · cualquier otro puesto (dueño, administrador, gerente, cajero…) NO anuncia ni se le pregunta;
 *     lo enciende a mano en Configuración → Este aparato;
 *   · el teléfono de cocina (sin sesión de puesto) anuncia, como siempre.
 * Lo ya elegido en un aparato, encendido o apagado, se respeta tal cual. Si el navegador niega el
 * almacén no hay elección guardada: vale lo del puesto, sin callar a la cocina.
 */
export const CLAVE_DEL_ANUNCIO = 'morphiqpos.cocina-anuncia';

/** El puesto real (`usePuesto`) de quien cocina. No es el rol de cuatro de `posUser.rol`. */
export const PUESTO_DE_COCINA = 'cocina';

/** Quien mira desde el teléfono de cocina (`/cocina-telefono/[token]`): sin sesión de puesto. */
export const TELEFONO_DE_COCINA = 'telefono-de-cocina';

/** El puesto real de quien mira, `TELEFONO_DE_COCINA`, o `null` si todavía no se conoce. */
export type QuienMira = string | null;

interface Eleccion {
  readonly puesto: QuienMira;
  /** Lo que este aparato eligió; `null` si nunca eligió. */
  readonly elegido: boolean | null;
}

interface Lector {
  getItem(clave: string): string | null;
}
interface Escritor {
  setItem(clave: string, valor: string): void;
}

/** Lo que este aparato eligió: `true`, `false`, o `null` si nunca eligió (o lo guardado no sirve). */
export function leerEleccionDelAparato(almacen: Lector | null): boolean | null {
  try {
    const texto = almacen?.getItem(CLAVE_DEL_ANUNCIO) ?? null;
    if (texto === null) return null;
    const leido: unknown = JSON.parse(texto);
    if (typeof leido !== 'object' || leido === null) return null;
    const { anuncia } = leido as { anuncia?: unknown };
    return typeof anuncia === 'boolean' ? anuncia : null;
  } catch {
    // Ventana privada, datos bloqueados o un valor roto: como si no hubiera elegido.
    return null;
  }
}

/** Lo que vale cuando nadie ha elegido: sólo cocina y su teléfono anuncian. */
function anunciaPorOmision(puesto: QuienMira): boolean {
  // `null` es «todavía no se sabe» (la lista de personas no ha llegado, o la red falló): ahí se
  // anuncia. Callar a una cocina es peor que oírse doble un instante en el aparato del dueño.
  return puesto === null || puesto === PUESTO_DE_COCINA || puesto === TELEFONO_DE_COCINA;
}

/** ¿Este aparato dice las comandas en voz alta? Lo elegido manda; sin elegir, el puesto. */
export function anunciaEsteAparato({ puesto, elegido }: Eleccion): boolean {
  return elegido ?? anunciaPorOmision(puesto);
}

/** ¿Hay que preguntarle (una vez) si anuncia? Sólo a la cocina que aún no ha elegido. */
export function hayQuePreguntar({ puesto, elegido }: Eleccion): boolean {
  return puesto === PUESTO_DE_COCINA && elegido === null;
}

/** Una línea que dice por qué este aparato anuncia o no (para la tarjeta de Este aparato). */
export function reglaDeEsteAparato({ puesto, elegido }: Eleccion): string {
  if (elegido !== null) return 'Esto lo elegiste tú en este aparato.';
  if (anunciaPorOmision(puesto)) {
    return 'Aún no eliges: por su puesto, esta pantalla anuncia las comandas.';
  }
  return 'Aún no eliges: por su puesto, esta pantalla no anuncia. Sólo las de Cocina lo hacen sin que lo elijas.';
}

/** Guarda el interruptor; `false` si el navegador no dejó (la pantalla lo dice). */
export function guardarAnuncioDelAparato(almacen: Escritor | null, anuncia: boolean): boolean {
  if (almacen === null) return false;
  try {
    almacen.setItem(CLAVE_DEL_ANUNCIO, JSON.stringify({ anuncia }));
    return true;
  } catch {
    return false;
  }
}
