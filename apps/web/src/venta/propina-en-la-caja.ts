/**
 * LA PROPINA EN LA CAJA, AL DÍA (DP-21 · Bloque 4 · M11 y O8). Puro.
 *
 * La Caja tomaba una foto de la propina al abrir la cuenta y no la volvía a leer: si los
 * comensales elegían después en el portal, nadie se enteraba. Ahora, con el cobro abierto, la
 * Caja relee la cuenta cada pocos segundos y esto decide qué hacer con lo que lee:
 *
 *   · la propina la decidió OTRA pantalla y no es la que la Caja tiene a la vista → aviso que
 *     interrumpe («Los comensales eligieron 10 % de propina ($52.00)») con «Usar ésa» y
 *     «Cambiarla»;
 *   · sólo cambió la versión de la cuenta → se toma la versión nueva, sin molestar.
 *
 * La regla de quién gana vive en el servidor (`propinas/una-sola-verdad.ts`); aquí sólo se
 * decide qué se le enseña a quien cobra.
 */

/** Lo que la Caja sabe de la propina de una cuenta (como lo sirve el puente). */
export interface PropinaALaVista {
  readonly propina_tipo?: string | null | undefined;
  readonly propina_porcentaje?: number | string | null | undefined;
  readonly propina_origen?: string | null | undefined;
  readonly version?: number | null | undefined;
  readonly total?: number | string | null | undefined;
}

/** La propina que decidió otra pantalla, lista para enseñarse. */
export interface PropinaDeOtraPantalla {
  /** Quién la eligió, para el texto del aviso. */
  readonly quien: 'comensales' | 'mesero';
  readonly tipo: string;
  /** 10 = 10 %. */
  readonly porcentaje: number;
  /** En pesos, sobre el total de la cuenta. */
  readonly monto: number;
  readonly origen: string;
  readonly version: number | null;
}

const DECISIONES: readonly string[] = ['sin_propina', 'porcentaje', 'monto_manual'];

function numero(valor: number | string | null | undefined): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function alCentavo(pesos: number): number {
  return Math.round(pesos * 100) / 100;
}

function quienLaEligio(origen: string | null | undefined): 'comensales' | 'mesero' | null {
  if (origen === 'portal_qr') return 'comensales';
  if (origen === 'mesero') return 'mesero';
  return null;
}

/** ¿La propina de esta cuenta ya es una decisión? («Sin propina» también lo es.) */
export function estaDecidida(cuenta: PropinaALaVista | null | undefined): boolean {
  const tipo = cuenta?.propina_tipo;
  return typeof tipo === 'string' && DECISIONES.includes(tipo);
}

/**
 * Lo que la cuenta releída trae de otra pantalla y la Caja todavía no tiene a la vista, o `null`
 * si no hay nada que avisar.
 *
 * No avisa de lo que la propia Caja eligió, ni de una propina que ya es la que está en pantalla
 * (el mismo tipo, el mismo porcentaje y el mismo origen), ni de un «todavía no» (pendiente).
 */
export function propinaDeOtraPantalla(
  aLaVista: PropinaALaVista | null | undefined,
  releida: PropinaALaVista | null | undefined,
): PropinaDeOtraPantalla | null {
  if (!estaDecidida(releida)) return null;
  const quien = quienLaEligio(releida?.propina_origen);
  if (quien === null) return null;
  const porcentaje = numero(releida?.propina_porcentaje);
  const yaLaTiene =
    aLaVista?.propina_tipo === releida?.propina_tipo &&
    numero(aLaVista?.propina_porcentaje) === porcentaje &&
    aLaVista?.propina_origen === releida?.propina_origen;
  if (yaLaTiene) return null;
  const tipo = releida?.propina_tipo ?? 'sin_propina';
  return {
    quien,
    tipo,
    porcentaje,
    monto: tipo === 'sin_propina' ? 0 : alCentavo((numero(releida?.total) * porcentaje) / 100),
    origen: releida?.propina_origen ?? '',
    version: typeof releida?.version === 'number' ? releida.version : null,
  };
}

/** La propina vigente que trae un 409 del servidor (`regla: 'PROPINA_VIGENTE'`), o `null`. */
export function propinaDelConflicto(
  datos: Readonly<Record<string, unknown>> | null | undefined,
  total: number | string | null | undefined,
): PropinaDeOtraPantalla | null {
  if (datos?.['regla'] !== 'PROPINA_VIGENTE') return null;
  const puntosBase = numero(datos['propinaPuntosBase'] as number | null | undefined);
  const version = datos['version'];
  return propinaDeOtraPantalla(null, {
    propina_tipo: typeof datos['propinaTipo'] === 'string' ? datos['propinaTipo'] : null,
    propina_porcentaje: puntosBase / 100,
    propina_origen: typeof datos['propinaOrigen'] === 'string' ? datos['propinaOrigen'] : null,
    version: typeof version === 'number' ? version : null,
    total,
  });
}

function enPesos(monto: number): string {
  return monto.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

/** «Los comensales eligieron 10 % de propina ($52.00)». */
export function textoDelAviso(propina: PropinaDeOtraPantalla): string {
  const sujeto = propina.quien === 'comensales' ? 'Los comensales eligieron' : 'El mesero registró';
  if (propina.tipo === 'sin_propina' || propina.porcentaje === 0) return `${sujeto}: sin propina`;
  const porcentaje = propina.porcentaje.toLocaleString('es-MX', { maximumFractionDigits: 2 });
  return `${sujeto} ${porcentaje} % de propina (${enPesos(propina.monto)})`;
}

/** Lo que cambia en la cuenta que la Caja tiene abierta al tocar «Usar ésa». */
export function alUsarEsa(propina: PropinaDeOtraPantalla): {
  readonly propina_tipo: string;
  readonly propina_porcentaje: number;
  readonly propina_origen: string;
  readonly propina_monto: number;
  readonly version?: number;
} {
  return {
    propina_tipo: propina.tipo,
    propina_porcentaje: propina.porcentaje,
    propina_origen: propina.origen,
    propina_monto: propina.monto,
    ...(propina.version === null ? {} : { version: propina.version }),
  };
}

/** Lo que viaja a `cuenta.fijar_propina` con lo que la Caja eligió en su diálogo. */
export function entradaDeFijarPropina(
  ordenId: string,
  version: number,
  elegida: {
    readonly propina_tipo?: string | null | undefined;
    readonly propina_porcentaje?: number | string | null | undefined;
  },
  cambiar: boolean,
): {
  readonly ordenId: string;
  readonly version: number;
  readonly propinaTipo: 'sin_propina' | 'porcentaje' | 'monto_manual';
  readonly propinaPuntosBase: number;
  readonly cambiar: boolean;
} {
  const puntosBase = Math.min(
    10_000,
    Math.max(0, Math.round(numero(elegida.propina_porcentaje) * 100)),
  );
  const tipo =
    elegida.propina_tipo === 'porcentaje' || elegida.propina_tipo === 'monto_manual'
      ? elegida.propina_tipo
      : 'sin_propina';
  return {
    ordenId,
    version,
    propinaTipo: puntosBase === 0 ? 'sin_propina' : tipo,
    propinaPuntosBase: tipo === 'sin_propina' ? 0 : puntosBase,
    cambiar,
  };
}

/** ¿La Caja elige la propina en este negocio? Sin dato guardado, sí. */
export function laCajaEligeLaPropina(
  config: { readonly propina_la_elige_caja?: unknown } | null | undefined,
): boolean {
  return config?.propina_la_elige_caja !== false;
}

/** ¿El mesero elige la propina en este negocio? Sin dato guardado, no. */
export function elMeseroEligeLaPropina(
  config: { readonly propina_la_elige_mesero?: unknown } | null | undefined,
): boolean {
  return config?.propina_la_elige_mesero === true;
}
