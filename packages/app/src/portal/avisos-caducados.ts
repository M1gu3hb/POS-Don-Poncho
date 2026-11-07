import 'server-only';

import { conTransaccion, obtenerDb } from '@morphiqpos/data';

import { correlationIdDe, registrar } from '../observabilidad.ts';
import { candadoDelCarrito } from '../restaurante/carrito-del-salon.ts';
import {
  aperturaDeLaCuenta,
  carritoCaducado,
  HORAS_SIN_ACTIVIDAD,
  resolverElAvisoCaducado,
  ultimaDe,
} from './carrito.ts';
import { PREFIJO_DEL_PEDIDO_LISTO } from './quien-envia.ts';

/**
 * DP-14 ronda 2 (medio 9) · EL GLOBO DEL CARRITO CADUCADO, también en el mapa del mesero.
 *
 * «Pedido listo para confirmar» se resolvía cuando un TELÉFONO sondeaba el carrito y lo
 * encontraba caducado (`estadoDelCarrito`). El mapa del mesero no sondea el carrito: lee los
 * avisos (`SolicitudQR`) por el puente, y el globo de un pedido que ya nadie ve seguía ahí. Esta
 * función lo resuelve en la lectura del mapa, con la MISMA regla (`carritoCaducado`): sólo los
 * avisos del carrito de las mesas cuyo carrito ya caducó, y ninguno más.
 *
 * Cada mesa en su transacción y con el candado del carrito (como agregar, enviar y el teléfono):
 * si un comensal agrega algo en ese instante, se espera y se relee, y un carrito que dejó de estar
 * caducado no pierde su aviso. Y un fallo aquí se registra y NO tumba la lectura de los avisos: el
 * mapa del mesero se pinta igual, con el globo de más, en vez de no pintarse.
 */
export async function resolverLosAvisosCaducados(
  organizacionId: string,
  ahora: Date = new Date(),
): Promise<number> {
  // Sólo las mesas cuyo carrito PUDO caducar: tiene líneas y la última es de hace más de
  // `HORAS_SIN_ACTIVIDAD` (con la cuenta abierta se mide hasta su apertura, que es antes de ahora,
  // así que esto es necesario siempre). Las demás —lo normal: el globo de un pedido que se acaba de
  // armar— no abren transacción ni esperan el candado de un comensal que está agregando: el sondeo
  // del mapa, que cada mesero hace cada pocos segundos, cuesta esta consulta y nada más.
  const limite = new Date(ahora.getTime() - HORAS_SIN_ACTIVIDAD * 3_600_000);
  const mesas = await obtenerDb()
    .selectFrom('solicitudes_qr as s')
    .select('s.mesa_id')
    .distinct()
    .where('s.organizacion_id', '=', organizacionId)
    .where('s.mesa_id', 'is not', null)
    .where('s.tipo', '=', 'ordenar')
    .where('s.estado', 'in', ['pendiente', 'atendida'])
    .where('s.notas', 'like', `${PREFIJO_DEL_PEDIDO_LISTO}%`)
    .where((eb) =>
      eb(
        eb
          .selectFrom('carrito_mesa_lineas as l')
          .select((sub) => sub.fn.max('l.created_at').as('ultima'))
          .where('l.organizacion_id', '=', organizacionId)
          .whereRef('l.mesa_id', '=', 's.mesa_id'),
        '<',
        limite,
      ),
    )
    .execute();
  let resueltas = 0;
  for (const { mesa_id: mesaId } of mesas) {
    try {
      const resuelta = await conTransaccion(async (tx) => {
        await candadoDelCarrito(tx, organizacionId, mesaId);
        const ambito = { organizacionId, mesaId, empleadoAsignadoId: null };
        const lineas = await tx
          .selectFrom('carrito_mesa_lineas')
          .select('created_at')
          .where('organizacion_id', '=', organizacionId)
          .where('mesa_id', '=', mesaId)
          .execute();
        const apertura = await aperturaDeLaCuenta(tx, ambito);
        if (!carritoCaducado(ultimaDe(lineas), apertura, ahora)) return false;
        await resolverElAvisoCaducado(tx, ambito, ahora);
        return true;
      });
      if (resuelta) resueltas += 1;
    } catch (error: unknown) {
      registrar({
        nivel: 'alerta',
        modulo: 'portal.avisos_caducados',
        correlationId: correlationIdDe(null),
        organizacionId,
        mensaje:
          error instanceof Error
            ? `No se resolvió el aviso de un carrito caducado: ${error.message}`
            : 'No se resolvió el aviso de un carrito caducado.',
      });
    }
  }
  return resueltas;
}
