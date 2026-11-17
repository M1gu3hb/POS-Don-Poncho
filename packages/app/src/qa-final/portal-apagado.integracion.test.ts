import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';

import { exigirOk } from '../pruebas/negocio-real.ts';
import {
  lineasDeLaCuenta,
  mesaConPortal,
  TELEFONO_A,
  TELEFONO_B,
} from '../portal/pruebas/mesa-con-portal.ts';

/**
 * DP-22 · FASE D · CAMBIO 1 A MEDIA OPERACIÓN: APAGAR EL PORTAL CON CARRITOS ABIERTOS.
 *
 * Lo que se mira: con el portal encendido los comensales arman su carrito; el dueño lo apaga; el
 * carrito que ya estaba armado no se pierde ni se manda a cocina solo; los teléfonos ya no pueden
 * agregar ni enviar; la cuenta que el mesero tenía abierta sigue su camino; y al volver a encenderlo
 * el carrito está donde se dejó.
 */

async function lineasEnElCarrito(mesaId: string): Promise<number> {
  const fila = await obtenerDb()
    .selectFrom('carrito_mesa_lineas')
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where('mesa_id', '=', mesaId)
    .executeTakeFirst();
  return Number(fila?.n ?? 0);
}

async function fijarPortal(organizacionId: string, activo: boolean): Promise<void> {
  await conTransaccion(async (tx) => {
    await sql`
      update configuracion
         set valores = valores || ${JSON.stringify({ portal_qr_activo: activo })}::jsonb
       where organizacion_id = ${organizacionId}
    `.execute(tx);
  });
}

describe('apagar el portal con carritos abiertos', () => {
  it(
    'REGLA: lo armado se conserva, nadie agrega ni envía mientras está apagado, y al encenderlo todo sigue ahí',
    { timeout: 240_000 },
    async () => {
      const caso = await mesaConPortal();
      const org = caso.negocio.organizacionId;
      exigirOk(await caso.agregar(TELEFONO_A, caso.taco, '2'), 'agregar A');
      exigirOk(await caso.agregar(TELEFONO_B, caso.agua), 'agregar B');
      expect(await lineasEnElCarrito(caso.mesaId)).toBe(2);

      await fijarPortal(org, false);
      expect(await lineasEnElCarrito(caso.mesaId)).toBe(2);

      const agregar = await caso.agregar(TELEFONO_A, caso.agua);
      expect(agregar.ok).toBe(false);
      const enviar = await caso.enviar(TELEFONO_A, true);
      expect(enviar.ok).toBe(false);
      expect(await lineasEnElCarrito(caso.mesaId)).toBe(2);
      expect(await lineasDeLaCuenta(caso.mesaId)).toHaveLength(0);

      await fijarPortal(org, true);
      const visto = await caso.mirar(TELEFONO_B);
      expect(visto?.lineas).toHaveLength(2);
      exigirOk(await caso.agregar(TELEFONO_A, caso.agua), 'agregar tras encender');
    },
  );
});
