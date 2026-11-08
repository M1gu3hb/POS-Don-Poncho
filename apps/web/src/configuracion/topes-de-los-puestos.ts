import { porcentajeEnTexto } from '~/venta/tope-de-quien-autoriza';

/**
 * Los topes de descuento de los puestos que autorizan con su PIN, como los aplica el servidor
 * (`venta.topes_de_los_puestos`: la fila del negocio o, si no la escribió, la del sistema). DP-14 ·
 * ronda 2 (menor): Configuración → Descuentos los decía escritos a mano.
 */

export interface TopeDelPuestoLeido {
  readonly rol: 'gerente' | 'administrador' | 'dueno';
  /** Puntos base: 3000 = 30 %. */
  readonly topeBp: number;
  /** En centavos y en texto (un `bigint` no viaja en JSON). */
  readonly topeCentavos: string;
}

export interface TopeEnPantalla {
  readonly rol: TopeDelPuestoLeido['rol'];
  readonly puesto: string;
  readonly porcentaje: string;
  readonly centavos: number;
}

const NOMBRE_DEL_PUESTO: Readonly<Record<TopeDelPuestoLeido['rol'], string>> = {
  gerente: 'gerente',
  administrador: 'administrador',
  dueno: 'dueño',
};

/** Lo que pinta la pantalla de cada puesto: su nombre, el porcentaje y el monto (sin formatear). */
export function topesEnPantalla(topes: readonly TopeDelPuestoLeido[]): readonly TopeEnPantalla[] {
  return topes.map((t) => ({
    rol: t.rol,
    puesto: NOMBRE_DEL_PUESTO[t.rol],
    porcentaje: porcentajeEnTexto(t.topeBp),
    centavos: Number(t.topeCentavos),
  }));
}
