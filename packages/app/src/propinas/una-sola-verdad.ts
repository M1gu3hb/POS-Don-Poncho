/**
 * LA PROPINA: UNA SOLA VERDAD (DP-21 · Bloque 4 · M11, M12 y O8).
 *
 * Lo que vio Miguel: la propina del portal y la de la Caja se pisaban. La Caja tomaba una foto
 * de la propina al abrir la cuenta y lo que elegía vivía sólo en su pantalla hasta cobrar; si
 * los comensales elegían después, nadie se enteraba, y al cobrar ganaba la última en escribir.
 *
 * La regla, una sola y sin tocar la base (por eso vive aparte de los comandos):
 *
 *   · la propina se decide UNA vez y queda en el servidor en el momento en que se elige;
 *   · la primera que se confirma gana: quien llega después desde OTRA pantalla no la pisa, se
 *     entera de la vigente;
 *   · la única que puede cambiar la que eligió otro es la Caja, y a propósito («Cambiarla»):
 *     queda en la auditoría como un cambio de la Caja;
 *   · quién puede elegirla lo dice el negocio (Configuración → Ventas y cobro → Propinas).
 *
 * En `ordenes` sólo va CÓMO se decidió (tipo, puntos base y origen), nunca un importe: el dinero
 * de la propina vive en `pagos` y no puede inflar el total de la cuenta.
 */

/** Las pantallas que eligen una propina. */
export type QuienElige = 'caja' | 'mesero' | 'portal_qr';

/** Lo que dice la cuenta (`ordenes.propina_*`). */
export interface PropinaDeLaCuenta {
  readonly tipo: string | null;
  readonly puntosBase: number;
  readonly origen: string | null;
}

/** Los tipos que son una DECISIÓN. Los demás son «todavía no» (pendiente, decidir en caja…). */
const DECISIONES: readonly string[] = ['sin_propina', 'porcentaje', 'monto_manual'];

/** ¿Alguien ya decidió la propina de esta cuenta? «Sin propina» también es una decisión. */
export function propinaDecidida(propina: PropinaDeLaCuenta): boolean {
  return propina.tipo !== null && DECISIONES.includes(propina.tipo);
}

/**
 * Quién decidió la propina vigente, o `null` si nadie. El origen «tradicional» (la cuenta que
 * nunca pasó por el mesero ni por el portal) es de la Caja.
 */
export function quienLaDecidio(propina: PropinaDeLaCuenta): QuienElige | null {
  if (!propinaDecidida(propina)) return null;
  if (propina.origen === 'portal_qr') return 'portal_qr';
  if (propina.origen === 'mesero') return 'mesero';
  return 'caja';
}

export type Veredicto =
  | {
      readonly aplicar: true;
      /** `true` si pisa a propósito la que eligió otra pantalla. */ readonly esCambio: boolean;
    }
  | { readonly aplicar: false; readonly vigente: PropinaDeLaCuenta };

/**
 * ¿Se aplica la propina que alguien acaba de elegir?
 *
 * - Nadie había decidido: sí.
 * - La había decidido esa misma pantalla: sí (se arrepintió antes de cobrar).
 * - La había decidido otra: no, y se le dice cuál es la vigente… salvo que sea la Caja y haya
 *   tocado «Cambiarla».
 */
export function decidirPropina(
  vigente: PropinaDeLaCuenta,
  intento: { readonly quien: QuienElige; readonly cambiar: boolean },
): Veredicto {
  const autor = quienLaDecidio(vigente);
  if (autor === null || autor === intento.quien) return { aplicar: true, esCambio: false };
  if (intento.quien === 'caja' && intento.cambiar) return { aplicar: true, esCambio: true };
  return { aplicar: false, vigente };
}

/** Quién puede elegir la propina en este negocio (`configuracion.valores`). */
export interface QuienPuedeElegir {
  readonly comensales: boolean;
  readonly mesero: boolean;
  readonly caja: boolean;
}

export const CLAVE_LA_ELIGE_EL_MESERO = 'propina_la_elige_mesero';
export const CLAVE_LA_ELIGE_LA_CAJA = 'propina_la_elige_caja';
export const CLAVE_LA_ELIGEN_LOS_COMENSALES = 'portal_qr_permitir_propina_cliente';
const CLAVE_PROPINAS_ACTIVAS = 'propinas_activas';

/** Por omisión: los comensales y la Caja, sin el mesero (lo que decidió Miguel para Don Poncho). */
export const QUIEN_ELIGE_POR_OMISION: QuienPuedeElegir = {
  comensales: true,
  mesero: false,
  caja: true,
};

function bandera(
  doc: Readonly<Record<string, unknown>>,
  clave: string,
  porOmision: boolean,
): boolean {
  const valor = doc[clave];
  return typeof valor === 'boolean' ? valor : porOmision;
}

/**
 * Lo que dice el documento. Con las propinas apagadas (`propinas_activas = false`) nadie elige.
 * La casilla de los comensales es la que ya existía en el portal: no se duplica.
 */
export function quienPuedeElegirEn(valores: unknown): QuienPuedeElegir {
  const doc =
    typeof valores === 'object' && valores !== null && !Array.isArray(valores)
      ? (valores as Readonly<Record<string, unknown>>)
      : {};
  if (!bandera(doc, CLAVE_PROPINAS_ACTIVAS, true)) {
    return { comensales: false, mesero: false, caja: false };
  }
  return {
    comensales: bandera(doc, CLAVE_LA_ELIGEN_LOS_COMENSALES, QUIEN_ELIGE_POR_OMISION.comensales),
    mesero: bandera(doc, CLAVE_LA_ELIGE_EL_MESERO, QUIEN_ELIGE_POR_OMISION.mesero),
    caja: bandera(doc, CLAVE_LA_ELIGE_LA_CAJA, QUIEN_ELIGE_POR_OMISION.caja),
  };
}

/** ¿Esta pantalla puede elegir la propina en este negocio? */
export function puedeElegir(quien: QuienElige, permitidos: QuienPuedeElegir): boolean {
  if (quien === 'caja') return permitidos.caja;
  if (quien === 'mesero') return permitidos.mesero;
  return permitidos.comensales;
}

/**
 * ¿Se escribe lo que el mesero mandó al pedir la cuenta?
 *
 * - Si la propina ya la decidió otra pantalla (la Caja, los comensales): no, se queda la suya.
 * - Si lo que manda es una DECISIÓN (un porcentaje, un monto, «sin propina»): sólo si el negocio
 *   deja que el mesero la elija.
 * - Si es un «todavía no» («pendiente», «la eligen los comensales», «se decide en caja»): sí,
 *   siempre. No elige nada: es el aviso que hace que el portal y la Caja la pregunten.
 */
export function laEscribeElMesero(
  tipo: string,
  vigente: PropinaDeLaCuenta,
  permitidos: QuienPuedeElegir,
): boolean {
  const autor = quienLaDecidio(vigente);
  if (autor !== null && autor !== 'mesero') return false;
  if (!DECISIONES.includes(tipo)) return true;
  return permitidos.mesero;
}
