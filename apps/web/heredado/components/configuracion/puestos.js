// Los puestos REALES del negocio y quién puede dar cuál (DP-14, ronda 2).
//
// El puente de usuarios sirve el puesto de la base (`dueno`, `administrador`, `gerente`, `cajero`,
// `mesero`, `cocina`, `almacen`), no el de su vocabulario de cuatro roles. Esta tabla es el ESPEJO
// de `PUEDE_OTORGAR` de `identidad/empleados.ts`: sólo decide qué se OFRECE en el diálogo. Quien
// decide de verdad es el servidor, que comprueba el puesto de la sesión en cada guardado; una
// prueba (`puestos-de-la-pantalla.test.ts`) vigila que las dos tablas no se separen.

export const PUESTOS = [
  { valor: 'dueno', etiqueta: 'Dueño' },
  { valor: 'administrador', etiqueta: 'Administrador' },
  { valor: 'gerente', etiqueta: 'Gerente' },
  { valor: 'cajero', etiqueta: 'Cajero' },
  { valor: 'mesero', etiqueta: 'Mesero' },
  { valor: 'cocina', etiqueta: 'Cocina' },
  { valor: 'almacen', etiqueta: 'Almacén' },
];

export const PUEDE_OTORGAR = {
  dueno: ['dueno', 'administrador', 'gerente', 'cajero', 'mesero', 'cocina', 'almacen'],
  administrador: ['gerente', 'cajero', 'mesero', 'cocina', 'almacen'],
};

/** Quienes administran: editan la plantilla y cambian Caja y Descuentos. */
export const PUESTOS_DE_MANDO = ['dueno', 'administrador'];

/**
 * DP-21 · Bloque 20 · Quien puede ELIMINAR un corte (`caja.eliminar_corte`): sólo el dueño. Es el
 * espejo del comando para no enseñar un botón que el servidor niega; la matriz de permisos
 * (`pruebas/e2e/matriz-de-permisos.json`) y `botones-segun-el-puesto.contrato.test.ts` vigilan que no se separen.
 */
export const PUESTOS_QUE_ELIMINAN_CORTES = ['dueno'];

export function puedeEliminarCortes(puesto) {
  return PUESTOS_QUE_ELIMINAN_CORTES.includes(puesto);
}

/**
 * DP-21 · Bloque 13 · Quien puede leer «¿Cómo va tu semana?» (`tablero.serie`): dueño, administrador y
 * gerente. Espejo del comando; la matriz de permisos lo ata en `botones-segun-el-puesto.contrato.test.ts`.
 */
export const PUESTOS_QUE_VEN_LA_SERIE_DEL_TABLERO = ['dueno', 'administrador', 'gerente'];

export function puedeVerLaSerieDelTablero(puesto) {
  return PUESTOS_QUE_VEN_LA_SERIE_DEL_TABLERO.includes(puesto);
}

/**
 * A5 · Quien registra compras (`compras.registrar`, `compras.usar_plantilla` y `compras.guardar_plantilla`): la
 * gerencia y el almacén, que es quien recibe la mercancía. Espejo del servidor; la matriz de permisos lo ata en
 * `compras-del-almacen.contrato.test.ts`.
 */
export const PUESTOS_QUE_REGISTRAN_COMPRAS = ['dueno', 'administrador', 'gerente', 'almacen'];

export function puedeRegistrarCompras(puesto) {
  return PUESTOS_QUE_REGISTRAN_COMPRAS.includes(puesto);
}

/**
 * A5 · Una compra en efectivo SALE DEL CAJÓN (DP-D115): sólo quien lleva la caja la paga así. El almacén la
 * registra por transferencia o tarjeta. Espejo de `quien-paga-del-cajon.ts`.
 */
export const PUESTOS_QUE_PAGAN_COMPRAS_DEL_CAJON = ['dueno', 'administrador', 'gerente'];

export function puedePagarComprasDelCajon(puesto) {
  return PUESTOS_QUE_PAGAN_COMPRAS_DEL_CAJON.includes(puesto);
}

/**
 * A5 · La forma de pago con la que arranca (y la que vale) una compra: la que se eligió, salvo que sea efectivo y
 * el puesto no pague del cajón; sin elección, efectivo para quien lleva la caja y transferencia para el almacén.
 * Mientras el puesto no llega (`null`) nadie arranca en efectivo: se corrige solo al llegar.
 */
export function metodoDeCompraPermitido(elegido, puesto) {
  const paga = puedePagarComprasDelCajon(puesto);
  if (elegido && (elegido !== 'efectivo' || paga)) return elegido;
  return paga ? 'efectivo' : 'transferencia';
}

/** Quienes reparten las mesas entre los meseros. */
export const PUESTOS_QUE_REPARTEN = ['dueno', 'administrador', 'gerente'];

export function etiquetaDelPuesto(valor) {
  return PUESTOS.find((p) => p.valor === valor)?.etiqueta ?? String(valor ?? '');
}

export function esDeMando(puesto) {
  return PUESTOS_DE_MANDO.includes(puesto);
}

export function puedeRepartirMesas(puesto) {
  return PUESTOS_QUE_REPARTEN.includes(puesto);
}

/** Los puestos que `miPuesto` puede dar, con su nombre. */
export function puestosQueOtorga(miPuesto) {
  const mios = PUEDE_OTORGAR[miPuesto] ?? [];
  return PUESTOS.filter((p) => mios.includes(p.valor));
}

/** ¿Puede `miPuesto` editar (o desactivar) a quien tiene `puestoDelOtro`? Uno mismo, sólo editarse. */
export function puedeEditarA(miPuesto, puestoDelOtro, esUnoMismo) {
  if (esUnoMismo) return esDeMando(miPuesto);
  return (PUEDE_OTORGAR[miPuesto] ?? []).includes(puestoDelOtro);
}
