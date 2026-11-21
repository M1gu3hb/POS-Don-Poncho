import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { anularLineaComando } from './anulacion-linea.ts';
import { cancelarOrden } from './cancelacion.ts';
import {
  almacenista,
  anular,
  cancelar,
  cocinero,
  como,
  cuenta,
  mesero,
  negocio,
  sembrarElSalonQueCancela,
} from './pruebas/cancelacion-real.ts';

/**
 * QUIÉN CANCELA, contra Postgres: el servidor decide por rol. DP-12.4 dejó entrar al mesero; DP-24
 * (Parte 2) lo sacó: ahora cancela una cuenta y quita un platillo ya enviado la gerencia (con su
 * nombre y su motivo), y la caja con el PIN de un gerente (`quien-quita-y-cancela`). El mesero,
 * cocina y almacén reciben SIN_PERMISO aunque manden el comando a mano. El corte y Registros, en
 * `cancelaciones-del-corte.integracion.test.ts`.
 */

beforeAll(sembrarElSalonQueCancela);

const codigoDe = (r: { ok: boolean; error?: { codigo: string } }): string | null =>
  r.ok ? null : (r.error?.codigo ?? null);

describe('quién puede cancelar (el servidor decide, por rol)', () => {
  it('la gerencia cancela una cuenta completa y queda con su nombre y su motivo', async () => {
    const { ordenId } = await cuenta(1, ['2']);
    exigirOk(await cancelar(ordenId, mesero()), 'restaurante.cancelar_orden');
    const orden = await obtenerDb()
      .selectFrom('ordenes')
      .select(['estado', 'cancelada_por', 'motivo_cancelacion'])
      .where('id', '=', ordenId)
      .executeTakeFirstOrThrow();
    expect(orden).toEqual({
      estado: 'cancelada',
      cancelada_por: negocio.empleoId,
      motivo_cancelacion: 'Se fueron sin pagar',
    });
  });

  it('la gerencia quita un platillo ya enviado y queda con su nombre', async () => {
    const { ordenId, lineaIds } = await cuenta(2, ['1', '1']);
    exigirOk(await anular(ordenId, lineaIds[0] ?? '', mesero()), 'restaurante.anular_linea');
    const linea = await obtenerDb()
      .selectFrom('orden_lineas')
      .select(['empleado_anula_id', 'motivo_anulacion'])
      .where('id', '=', lineaIds[0] ?? '')
      .executeTakeFirstOrThrow();
    expect(linea).toEqual({
      empleado_anula_id: negocio.empleoId,
      motivo_anulacion: 'error_mesero',
    });
  });

  it.each(['mesero', 'cocina', 'almacen'] as const)(
    '%s NO cancela ni quita lo enviado: SIN_PERMISO y la cuenta sigue viva',
    async (rol) => {
      const { ordenId, lineaIds } = await cuenta(rol === 'mesero' ? 3 : rol === 'cocina' ? 4 : 5, [
        '1',
      ]);
      const quien =
        rol === 'mesero' ? mesero() : como(rol === 'cocina' ? cocinero : almacenista, rol);
      const sinCancelar = await comando(cancelarOrden, {
        entrada: { ordenId, motivo: 'Se fueron sin pagar' },
        ambito: quien,
        idempotencyKey: clave(),
      });
      const sinAnular = await comando(anularLineaComando, {
        entrada: { ordenId, lineaId: lineaIds[0] ?? '', motivo: 'error_mesero' },
        ambito: quien,
        idempotencyKey: clave(),
      });
      expect(codigoDe(sinCancelar)).toBe('SIN_PERMISO');
      expect(codigoDe(sinAnular)).toBe('SIN_PERMISO');
      const orden = await obtenerDb()
        .selectFrom('ordenes')
        .select('estado')
        .where('id', '=', ordenId)
        .executeTakeFirstOrThrow();
      expect(orden.estado).not.toBe('cancelada');
    },
  );
});
