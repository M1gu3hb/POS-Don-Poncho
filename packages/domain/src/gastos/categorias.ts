/**
 * EL CATÁLOGO DE CATEGORÍAS DE GASTO (DP-21 · Bloque 11 · M22). Una sola fuente.
 *
 * La Caja ofrecía 5 categorías y Compras y gastos 7, cada pantalla con su lista. El servidor
 * (`gastos.registrar`), las plantillas, el diálogo de la Caja, el de Compras y la importación leen
 * ESTA lista: una categoría nueva se agrega aquí y en ningún otro sitio. Un contrato
 * (`apps/web/src/venta/categorias-de-gasto.contrato.test.ts`) falla si una pantalla trae la suya.
 */

export const CLAVES_DE_CATEGORIA_DE_GASTO = [
  'servicios',
  'limpieza',
  'transporte',
  'reparacion',
  'pago_extraordinario',
  'marketing',
  'otro',
] as const;

export type ClaveDeCategoriaDeGasto = (typeof CLAVES_DE_CATEGORIA_DE_GASTO)[number];

export interface CategoriaDeGasto {
  readonly clave: ClaveDeCategoriaDeGasto;
  /** Lo corto: botones y listas. */
  readonly nombre: string;
  /** Lo completo, con ejemplos: el selector de Compras y gastos. */
  readonly completo: string;
}

const TEXTOS: Readonly<Record<ClaveDeCategoriaDeGasto, { nombre: string; completo: string }>> = {
  servicios: { nombre: 'Servicios', completo: 'Servicios (luz, agua, gas, internet)' },
  limpieza: { nombre: 'Limpieza', completo: 'Limpieza' },
  transporte: { nombre: 'Transporte', completo: 'Transporte' },
  reparacion: { nombre: 'Reparación', completo: 'Reparación / mantenimiento' },
  pago_extraordinario: { nombre: 'Pago extraordinario', completo: 'Pago extraordinario' },
  marketing: { nombre: 'Marketing', completo: 'Marketing / publicidad' },
  otro: { nombre: 'Otro', completo: 'Otro' },
};

export const CATEGORIAS_DE_GASTO: readonly CategoriaDeGasto[] = CLAVES_DE_CATEGORIA_DE_GASTO.map(
  (clave) => ({ clave, ...TEXTOS[clave] }),
);

export function esCategoriaDeGasto(valor: unknown): valor is ClaveDeCategoriaDeGasto {
  return (CLAVES_DE_CATEGORIA_DE_GASTO as readonly unknown[]).includes(valor);
}

/** El nombre corto de una categoría guardada; lo que no está en el catálogo se dice tal cual. */
export function nombreDeLaCategoria(clave: string): string {
  return esCategoriaDeGasto(clave) ? TEXTOS[clave].nombre : clave;
}
