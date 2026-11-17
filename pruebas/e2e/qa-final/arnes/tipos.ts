/**
 * Lo que comparten las revisiones del arnés: un hallazgo es un DATO (qué, dónde, con qué medidas),
 * no un mensaje. Sirve igual para fallar con claridad (modo estricto), para juntar y seguir (modo de
 * barrido) y para el informe en JSON.
 */

export type TipoDeHallazgo =
  | 'desborde'
  | 'texto-cortado'
  | 'encimado'
  | 'inalcanzable'
  | 'fila-desigual'
  | 'campos-desalineados'
  | 'blanco-chico'
  | 'accesibilidad'
  | 'consola'
  | 'respuesta'
  | 'gesto-seleccion'
  | 'gesto-menu'
  | 'gesto-desplazamiento'
  | 'foco-en-campo'
  | 'campo-tapado'
  | 'teclado-salto'
  | 'pie-inalcanzable'
  | 'captura';

export type Medida = number | string | boolean | null;

export interface Hallazgo {
  readonly tipo: TipoDeHallazgo;
  /** Un selector legible: `button#guardar «Guardar»`, no un XPath. */
  readonly selector: string;
  readonly texto: string;
  readonly medidas: Readonly<Record<string, Medida>>;
  readonly detalle: string;
}

/** Algo que se informa pero no es falla (la elipsis intencional, un blanco con excepción). */
export interface Informativo {
  readonly tipo: 'elipsis-intencional' | 'excepcion-44' | 'explicado';
  readonly selector: string;
  readonly texto: string;
  readonly detalle: string;
}

export type ModoDeRevision = 'estricto' | 'barrido';

export interface ResultadoDeRevision {
  readonly pantalla: string;
  readonly estado: string;
  readonly aparato: string;
  readonly motor: string;
  readonly hallazgos: readonly Hallazgo[];
  readonly informativos: readonly Informativo[];
  /** La captura, relativa a la raíz del repositorio; `null` si no salió (y el porqué va en un hallazgo). */
  readonly captura: string | null;
}

/** Un selector legible de un hallazgo, para el mensaje de error. */
export function describir(h: Hallazgo): string {
  const medidas = Object.entries(h.medidas)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(' ');
  return `[${h.tipo}] ${h.selector}${h.texto === '' ? '' : ` «${h.texto}»`} · ${h.detalle}${medidas === '' ? '' : ` (${medidas})`}`;
}
