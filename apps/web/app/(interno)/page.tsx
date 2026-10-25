import Dashboard from '@/pages/Dashboard';

import { IrAlInicioDelRol } from '~/cliente/IrAlInicioDelRol';
import { sesionDelServidor } from '~/servidor/http';

/**
 * LA PANTALLA DE INICIO: el tablero del restaurante.
 *
 * `Dashboard` de `heredado/` es el tablero del RESTAURANTE —ventas, costo, utilidad, ticket
 * promedio, métodos de pago, propinas—, y POS Don Poncho sirve sólo a un restaurante (DP-2):
 * los tableros y la agenda de los otros cuatro giros se fueron con ellos.
 *
 * Quién ve el tablero: dirección. A los demás puestos, `/` los lleva a su casa —la cajera a la
 * caja, el mesero a sus mesas, la cocina a la cocina— en vez de pintarles el dinero del día,
 * que su puesto no lee (el servidor ya les niega los datos; la pantalla tampoco se pinta).
 */
export const dynamic = 'force-dynamic';

const VEN_EL_TABLERO: ReadonlySet<string> = new Set(['dueno', 'administrador', 'gerente']);

export default async function Pagina() {
  const sesion = await sesionDelServidor();
  if (sesion !== null && !VEN_EL_TABLERO.has(sesion.rol)) return <IrAlInicioDelRol />;
  return <Dashboard />;
}
