import { obtenerDb } from '@morphiqpos/data';
import { describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { cancelarOrden } from './cancelacion.ts';
import {
  abrirLasCajas,
  ambitoDeCaja,
  mesaPersistida,
  sembrarSalon,
  sentarYPedir,
  type PlatilloPedido,
} from './pruebas/salon-real.ts';
import { unirMesasComando } from './union-de-mesas.ts';

/**
 * DP-18 (A19) · CANCELAR LA CUENTA DE MESAS UNIDAS PREGUNTA POR EL GRUPO.
 *
 * Desde DP-9.6 la unión es del salón, no de la cuenta. Al cobrar, las mesas van a limpieza y al
 * limpiar la principal se pregunta «¿Separar mesas o dejarlas unidas?». Al CANCELAR la pregunta
 * nunca llegaba: las mesas quedaban libres y unidas sin que nadie lo decidiera, y el grupo que se
 * sentó después en la secundaria pidió a la cuenta del grupo anterior.
 */

const PEDIDO_DE_A: readonly PlatilloPedido[] = [{ platillo: 'arrachera', cantidad: '1' }];
const PEDIDO_DE_B: readonly PlatilloPedido[] = [{ platillo: 'cerveza', cantidad: '2' }];
const MOTIVO = 'se levantaron antes de que saliera la comida';

/** Las mesas 1 y 2 piden, se unen, y se cancela la cuenta del grupo con la decisión dada. */
async function cancelarUnGrupo(nombre: string, grupo: 'separar' | 'mantener' | undefined) {
  const salon = await sembrarSalon({ nombre, mesas: 4, terminales: 1 });
  await abrirLasCajas(salon);
  const a = await sentarYPedir(salon, 0, PEDIDO_DE_A);
  const b = await sentarYPedir(salon, 1, PEDIDO_DE_B);
  exigirOk(
    await comando(unirMesasComando, {
      entrada: { mesaPrincipalId: a.mesaId, mesaIds: [b.mesaId] },
      ambito: ambitoDeCaja(salon),
      idempotencyKey: clave(),
    }),
    'restaurante.unir_mesas',
  );
  const resultado = exigirOk(
    await comando(cancelarOrden, {
      entrada: { ordenId: a.ordenId, motivo: MOTIVO, ...(grupo === undefined ? {} : { grupo }) },
      ambito: ambitoDeCaja(salon),
      idempotencyKey: clave(),
    }),
    'restaurante.cancelar_orden (el grupo)',
  );
  const uniones = await obtenerDb()
    .selectFrom('uniones_mesa')
    .select(['id', 'cerrada_en'])
    .where('mesa_principal_id', '=', a.mesaId)
    .execute();
  return {
    resultado,
    uniones,
    principal: await mesaPersistida(a.mesaId),
    miembro: await mesaPersistida(b.mesaId),
    principalId: a.mesaId,
  };
}

describe('DP-18 · cancelar la cuenta de mesas unidas', () => {
  it("con 'separar' cierra la unión y cada mesa vuelve a su lugar, en la misma cancelación", async () => {
    const r = await cancelarUnGrupo('Restaurante del grupo que se separa', 'separar');

    expect(r.resultado.union).toEqual({ unionId: r.uniones[0]?.id, separada: true });
    expect(r.uniones).toHaveLength(1);
    expect(r.uniones[0]?.cerrada_en, 'la unión se cerró').not.toBeNull();
    expect(r.principal.estado).toBe('libre');
    expect(r.miembro.estado).toBe('libre');
    expect(r.miembro.unida_a_mesa_id, 'la secundaria ya no apunta a la principal').toBeNull();
    expect(r.principal.orden_activa_id).toBeNull();
  });

  it.each([
    ["'mantener'", 'mantener' as const],
    ['sin decir nada (DP-9.6)', undefined],
  ])('con %s las mesas quedan libres y la unión sigue abierta', async (_cual, grupo) => {
    const r = await cancelarUnGrupo(`Restaurante del grupo que sigue unido ${_cual}`, grupo);

    expect(r.resultado.union).toEqual({ unionId: r.uniones[0]?.id, separada: false });
    expect(r.uniones[0]?.cerrada_en, 'la unión sigue abierta').toBeNull();
    expect(r.principal.estado).toBe('libre');
    expect(r.miembro.estado).toBe('libre');
    expect(r.miembro.unida_a_mesa_id).toBe(r.principalId);
  });

  it("una cuenta de una mesa sola ignora 'separar' y dice que no había unión", async () => {
    const salon = await sembrarSalon({
      nombre: 'Restaurante de la mesa sola',
      mesas: 2,
      terminales: 1,
    });
    await abrirLasCajas(salon);
    const a = await sentarYPedir(salon, 0, PEDIDO_DE_A);
    const resultado = exigirOk(
      await comando(cancelarOrden, {
        entrada: { ordenId: a.ordenId, motivo: MOTIVO, grupo: 'separar' },
        ambito: ambitoDeCaja(salon),
        idempotencyKey: clave(),
      }),
      'restaurante.cancelar_orden',
    );
    expect(resultado.union).toBeNull();
    expect((await mesaPersistida(a.mesaId)).estado).toBe('libre');
  });
});
