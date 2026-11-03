/**
 * LOS TOPES DE DESCUENTO DEL SISTEMA, por puesto (DP-13.5, decisión DP-D59).
 *
 * Son los que la migración 078 sembró para todo negocio que existía. Un negocio que se dio de alta
 * después sin sembrarlos (Don Poncho) no tenía NINGUNO, y con «sin fila es cero» nadie podía dar
 * un descuento, ni el dueño. Ahora un negocio sin topes escritos usa éstos (`venta/descuento.ts`,
 * `topeDe`); el reseteo de las pruebas los vuelve a escribir.
 */
export const TOPES_DE_DESCUENTO: readonly {
  readonly rol: string;
  readonly topeCentavos: bigint;
  readonly topeBp: number;
}[] = [
  { rol: 'dueno', topeCentavos: 100_000_000n, topeBp: 10_000 },
  { rol: 'administrador', topeCentavos: 500_000n, topeBp: 5_000 },
  { rol: 'gerente', topeCentavos: 200_000n, topeBp: 3_000 },
  { rol: 'cajero', topeCentavos: 5_000n, topeBp: 1_000 },
  { rol: 'mesero', topeCentavos: 0n, topeBp: 0 },
  { rol: 'cocina', topeCentavos: 0n, topeBp: 0 },
  { rol: 'almacen', topeCentavos: 0n, topeBp: 0 },
];
