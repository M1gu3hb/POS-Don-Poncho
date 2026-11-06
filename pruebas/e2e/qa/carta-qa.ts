/**
 * QA-1 · LA CARTA DE LA JORNADA: precios de Don Poncho (centavos) escritos aquí, no leídos de la base: una
 * prueba que compara el cobro contra la tabla de la que sale el cobro no prueba nada. Y los insumos
 * y recetas que la copia no traía, para que el almacén tenga qué bajar.
 */

export const PRECIO = {
  quesadilla: { nombre: 'Quesadilla', centavos: 2_500, estacion: 'Cocina' },
  guacamole: { nombre: 'Guacamole', centavos: 6_000, estacion: 'Cocina' },
  tlacoyo: { nombre: 'Tlacoyo de frijol', centavos: 2_000, estacion: 'Cocina' },
  consome: { nombre: 'Consomé de pollo', centavos: 2_700, estacion: 'Cocina' },
  mole: { nombre: 'Mole con pollo', centavos: 9_500, estacion: 'Barbacoa' },
  tacoSuave: { nombre: 'Taco suave de barbacoa', centavos: 9_500, estacion: 'Barbacoa' },
  mixiote: { nombre: 'Mixiote de carnero', centavos: 17_000, estacion: 'Barbacoa' },
  pastel: { nombre: 'Pastel de la casa', centavos: 3_000, estacion: 'Postres' },
  flan: { nombre: 'Flan napolitano', centavos: 4_000, estacion: 'Postres' },
  corona: { nombre: 'Corona', centavos: 4_700, estacion: 'Bebidas' },
  victoria: { nombre: 'Victoria', centavos: 4_700, estacion: 'Bebidas' },
  modelo: { nombre: 'Modelo especial', centavos: 5_200, estacion: 'Bebidas' },
  coca: { nombre: 'Coca cola', centavos: 3_700, estacion: 'Bebidas' },
  limonada: { nombre: 'Limonada', centavos: 5_800, estacion: 'Bebidas' },
  cafe: { nombre: 'Café de olla', centavos: 2_800, estacion: 'Bebidas' },
} as const;

export type Platillo = keyof typeof PRECIO;

export interface Renglon {
  readonly platillo: Platillo;
  readonly veces: number;
}

/** Lo que vale una lista de platillos, en centavos. */
export const importe = (pedido: readonly Renglon[]): number =>
  pedido.reduce((suma, r) => suma + PRECIO[r.platillo].centavos * r.veces, 0);

/** Para el diálogo de la mesa: el mismo formato que `armarElPedido`. */
export const comoPedido = (pedido: readonly Renglon[]) =>
  pedido.map((r) => ({
    nombre: PRECIO[r.platillo].nombre,
    veces: r.veces,
    // Ronda 2 (QA1-4 arreglado): el mesero ya pide el relleno obligatorio de la quesadilla.
    ...(r.platillo === 'quesadilla' ? { opcion: 'Pollo' } : {}),
  }));

export const diezPorCiento = (centavos: number): number => Math.round(centavos * 0.1);
export const quincePorCiento = (centavos: number): number => Math.round(centavos * 0.15);

export interface InsumoQa {
  readonly nombre: string;
  readonly unidad: 'g' | 'pieza';
  readonly costo: string;
  readonly existencia: string;
}

export const INSUMOS: readonly InsumoQa[] = [
  { nombre: 'Masa de maíz', unidad: 'g', costo: '0.03', existencia: '20000' },
  { nombre: 'Queso Oaxaca', unidad: 'g', costo: '0.14', existencia: '8000' },
  { nombre: 'Aguacate', unidad: 'g', costo: '0.06', existencia: '10000' },
  { nombre: 'Mole poblano', unidad: 'g', costo: '0.18', existencia: '5000' },
  { nombre: 'Pollo', unidad: 'g', costo: '0.09', existencia: '15000' },
  { nombre: 'Cerveza Corona', unidad: 'pieza', costo: '22.00', existencia: '48' },
  { nombre: 'Cerveza Victoria', unidad: 'pieza', costo: '22.00', existencia: '48' },
  { nombre: 'Refresco cola', unidad: 'pieza', costo: '14.00', existencia: '36' },
  { nombre: 'Pastel (rebanada)', unidad: 'pieza', costo: '9.00', existencia: '20' },
];

export interface RecetaQa {
  readonly platillo: string;
  readonly lineas: readonly { readonly insumo: string; readonly cantidad: string }[];
}

/** Lo que gasta UNA unidad de cada platillo con receta. Los demás platillos no llevan receta. */
export const RECETAS: readonly RecetaQa[] = [
  {
    platillo: 'Quesadilla',
    lineas: [
      { insumo: 'Masa de maíz', cantidad: '100' },
      { insumo: 'Queso Oaxaca', cantidad: '80' },
    ],
  },
  { platillo: 'Guacamole', lineas: [{ insumo: 'Aguacate', cantidad: '250' }] },
  {
    platillo: 'Mole con pollo',
    lineas: [
      { insumo: 'Mole poblano', cantidad: '50' },
      { insumo: 'Pollo', cantidad: '300' },
    ],
  },
  { platillo: 'Corona', lineas: [{ insumo: 'Cerveza Corona', cantidad: '1' }] },
  { platillo: 'Victoria', lineas: [{ insumo: 'Cerveza Victoria', cantidad: '1' }] },
  { platillo: 'Coca cola', lineas: [{ insumo: 'Refresco cola', cantidad: '1' }] },
  { platillo: 'Pastel de la casa', lineas: [{ insumo: 'Pastel (rebanada)', cantidad: '1' }] },
];

/** Lo que gastan, por insumo, las unidades de un pedido (sólo lo que tiene receta). */
export function consumoDe(pedido: readonly Renglon[]): Record<string, number> {
  const gastado: Record<string, number> = {};
  for (const { platillo, veces } of pedido) {
    const receta = RECETAS.find((r) => r.platillo === PRECIO[platillo].nombre);
    for (const l of receta?.lineas ?? []) {
      gastado[l.insumo] =
        Math.round(((gastado[l.insumo] ?? 0) + Number(l.cantidad) * veces) * 1e4) / 1e4;
    }
  }
  return gastado;
}

/**
 * Lo que se COBRÓ en la jornada, mesa por mesa (el mismo pedido de cada escena), para calcular lo que
 * tenían que gastar las recetas. Lo cancelado no entra: lo hecho sale como merma (asientos «merma»).
 */
export const COBRADOS: Readonly<Record<string, readonly Renglon[]>> = {
  'mesa 1': [
    { platillo: 'quesadilla', veces: 2 },
    { platillo: 'guacamole', veces: 1 },
    { platillo: 'mole', veces: 1 },
    { platillo: 'corona', veces: 2 },
    { platillo: 'coca', veces: 1 },
    { platillo: 'pastel', veces: 1 },
  ],
  'mesa 7': [
    { platillo: 'tlacoyo', veces: 2 },
    { platillo: 'consome', veces: 1 },
    { platillo: 'victoria', veces: 3 },
    { platillo: 'flan', veces: 1 },
  ],
  'mesa 2': [
    { platillo: 'tlacoyo', veces: 2 },
    { platillo: 'quesadilla', veces: 1 },
    { platillo: 'corona', veces: 2 },
    { platillo: 'coca', veces: 1 },
    { platillo: 'guacamole', veces: 1 },
  ],
  'mesa 8': [
    { platillo: 'mole', veces: 1 },
    { platillo: 'victoria', veces: 2 },
    { platillo: 'consome', veces: 2 },
    { platillo: 'pastel', veces: 1 },
  ],
  'mesas 3 y 4': [
    { platillo: 'quesadilla', veces: 2 },
    { platillo: 'coca', veces: 1 },
    { platillo: 'victoria', veces: 2 },
  ],
  'mesa 12': [
    { platillo: 'guacamole', veces: 2 },
    { platillo: 'mole', veces: 2 },
    { platillo: 'corona', veces: 3 },
    { platillo: 'coca', veces: 1 },
  ],
  'mesa 17': [
    { platillo: 'tlacoyo', veces: 2 },
    { platillo: 'pastel', veces: 1 },
  ],
  'mesa 19': [
    { platillo: 'guacamole', veces: 1 },
    { platillo: 'corona', veces: 1 },
  ],
};

/** Los pedidos de la escena de unir y dividir (qa1-03). */
export const M3: readonly Renglon[] = [
  { platillo: 'quesadilla', veces: 2 },
  { platillo: 'coca', veces: 1 },
];
export const M4: readonly Renglon[] = [{ platillo: 'victoria', veces: 2 }];
export const M12: readonly Renglon[] = [
  { platillo: 'guacamole', veces: 2 },
  { platillo: 'mole', veces: 2 },
  { platillo: 'corona', veces: 3 },
  { platillo: 'coca', veces: 1 },
];
export const PARTE_1: readonly Renglon[] = [
  { platillo: 'guacamole', veces: 1 },
  { platillo: 'mole', veces: 1 },
  { platillo: 'corona', veces: 2 },
];
export const PARTE_2: readonly Renglon[] = [
  { platillo: 'guacamole', veces: 1 },
  { platillo: 'mole', veces: 1 },
  { platillo: 'corona', veces: 1 },
  { platillo: 'coca', veces: 1 },
];

export const unidadesDe = (pedido: readonly Renglon[]) => pedido.reduce((s, r) => s + r.veces, 0);
