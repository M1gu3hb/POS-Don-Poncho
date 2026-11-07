import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { abrirMesa, liberarMesa } from './mesas.ts';
import { cancelar, mesas, mesero, sembrarElSalonQueCancela } from './pruebas/cancelacion-real.ts';

/**
 * DP-14.6 · UNA MESA ABIERTA SIN RENGLONES: el mesero que la abrió la cancela o la libera, contra
 * Postgres (se abrió por error, o la gente se fue antes de pedir).
 */

beforeAll(sembrarElSalonQueCancela);

async function abrirSinPedir(numero: number) {
  const mesaId = mesas[numero - 1] ?? '';
  const { ordenId } = exigirOk(
    await comando(abrirMesa, {
      entrada: { mesaId, personas: 2 },
      ambito: mesero(),
      idempotencyKey: clave(),
    }),
    'restaurante.abrir_mesa',
  );
  return { mesaId, ordenId };
}

const laMesa = (id: string) =>
  obtenerDb()
    .selectFrom('mesas')
    .select(['estado', 'orden_activa_id'])
    .where('id', '=', id)
    .executeTakeFirstOrThrow();

describe('una mesa abierta sin renglones', () => {
  it('el mesero la cancela con su motivo y la mesa queda libre', async () => {
    const { mesaId, ordenId } = await abrirSinPedir(1);
    exigirOk(await cancelar(ordenId, mesero(), 'Se abrió por error'), 'cancelar');
    expect(await laMesa(mesaId)).toEqual({ estado: 'libre', orden_activa_id: null });
  });

  it('el mesero la libera: la cuenta vacía se cancela sola y la mesa queda libre', async () => {
    const { mesaId, ordenId } = await abrirSinPedir(2);
    exigirOk(
      await comando(liberarMesa, {
        entrada: { mesaId },
        ambito: mesero(),
        idempotencyKey: clave(),
      }),
      'liberar',
    );
    expect(await laMesa(mesaId)).toEqual({ estado: 'libre', orden_activa_id: null });
    const orden = await obtenerDb()
      .selectFrom('ordenes')
      .select('estado')
      .where('id', '=', ordenId)
      .executeTakeFirstOrThrow();
    expect(orden.estado).toBe('cancelada');
  });
});
