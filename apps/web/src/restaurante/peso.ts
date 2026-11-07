/**
 * EL PESO DE UNA LÍNEA, DICHO COMO SE DICE EN LA COCINA (DP-14).
 *
 * La barbacoa se vende por kilo: su `cantidad` es 0.5, no 1 pieza. Pintada tal cual, la comanda
 * decía «0.5» o «1 ×» y el cocinero no sabía si eran medio kilo o una porción. Aquí vive el único
 * formato: «¼ kg», «½ kg», «¾ kg», «1 kg», «1.5 kg»; cualquier otro peso, con sus decimales
 * (hasta tres) sin ceros de sobra.
 */

const FRACCIONES: readonly (readonly [number, string])[] = [
  [0.25, '¼'],
  [0.5, '½'],
  [0.75, '¾'],
];

const TOLERANCIA = 1e-6;

/** Lo que `etiquetaDePeso` necesita saber de una línea de venta o de un item de comanda. */
export interface LineaConPeso {
  readonly cantidad?: number | string | null | undefined;
  readonly tipo_venta?: string | null | undefined;
  readonly tipo_venta_snapshot?: string | null | undefined;
  readonly cantidad_variable?: number | string | null | undefined;
  readonly cantidad_variable_snapshot?: number | string | null | undefined;
  readonly unidad_variable?: string | null | undefined;
  readonly unidad_variable_snapshot?: string | null | undefined;
}

function aNumero(valor: number | string | null | undefined): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

/** Un número con hasta tres decimales y sin ceros sobrantes: 1.5, 0.125, 2. */
function sinCerosDeMas(valor: number): string {
  return String(Math.round(valor * 1000) / 1000);
}

/**
 * «½ kg» para 0.5 kg, «1 kg», «1.5 kg», «300 g». Vacío si no hay un peso positivo: quien llama
 * decide qué pintar entonces.
 */
export function etiquetaDePeso(
  cantidad: number | string | null | undefined,
  unidad = 'kg',
): string {
  const kilos = aNumero(cantidad);
  if (kilos <= 0) return '';
  const fraccion = FRACCIONES.find(([valor]) => Math.abs(kilos - valor) < TOLERANCIA);
  const texto = fraccion === undefined ? sinCerosDeMas(kilos) : fraccion[1];
  return `${texto} ${unidad}`;
}

/** De una línea del puente a lo que el diálogo de dividir reparte. */
export function paraDividir(
  linea: LineaConPeso & { readonly id: string; readonly nombre: string },
): {
  readonly id: string;
  readonly nombre: string;
  readonly cantidad: number;
  readonly porPeso: boolean;
  readonly unidad: string;
} {
  const porPeso = esPorPeso(linea);
  const peso = linea.cantidad_variable ?? linea.cantidad_variable_snapshot ?? linea.cantidad;
  const unidad = linea.unidad_variable ?? linea.unidad_variable_snapshot ?? 'kg';
  return {
    id: linea.id,
    nombre: linea.nombre,
    cantidad: aNumero(porPeso ? peso : linea.cantidad),
    porPeso,
    unidad: unidad === '' ? 'kg' : unidad,
  };
}

/**
 * Cuántas piezas reparte la pantalla de dividir de una línea: una por peso, o con una cantidad que
 * no es entera, es UNA (se mueve completa). El servidor cuenta igual (`unidadesRepartibles`).
 */
export function piezasDe(linea: {
  readonly cantidad: number;
  readonly porPeso?: boolean | undefined;
}): number {
  return linea.porPeso === true || !Number.isInteger(linea.cantidad) ? 1 : linea.cantidad;
}

/** ¿La línea se vende por peso? Acepta los nombres del item de comanda y los del detalle de venta. */
export function esPorPeso(linea: LineaConPeso): boolean {
  return (linea.tipo_venta ?? linea.tipo_venta_snapshot ?? null) === 'variable_medida';
}

/**
 * La cantidad de una línea para la comanda, el ticket o la lista: el peso con su unidad si se
 * vende por peso («½ kg»); si no, la cantidad de siempre (enteros sin decimales).
 */
export function cantidadParaMostrar(linea: LineaConPeso): string {
  if (esPorPeso(linea)) {
    const peso = linea.cantidad_variable ?? linea.cantidad_variable_snapshot ?? linea.cantidad;
    const unidad = linea.unidad_variable ?? linea.unidad_variable_snapshot ?? 'kg';
    const etiqueta = etiquetaDePeso(peso, unidad === '' ? 'kg' : unidad);
    if (etiqueta !== '') return etiqueta;
  }
  const n = aNumero(linea.cantidad);
  return Number.isInteger(n) ? String(n) : sinCerosDeMas(n);
}

/**
 * DP-14 · ronda 2, medio 4 · La cantidad en una lista de renglones (Ventas, y su «Quitado»): el peso
 * con su fracción («½ kg») si se vende por peso; si no, «x» y la cantidad («x2»), como siempre.
 */
export function cantidadEnLaLista(linea: LineaConPeso): string {
  const cantidad = cantidadParaMostrar(linea);
  return esPorPeso(linea) ? cantidad : `x${cantidad}`;
}
