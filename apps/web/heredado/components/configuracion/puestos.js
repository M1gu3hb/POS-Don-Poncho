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
