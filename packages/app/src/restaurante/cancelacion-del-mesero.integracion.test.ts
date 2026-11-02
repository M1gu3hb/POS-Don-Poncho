import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { exigirOk } from '../pruebas/negocio-real.ts';
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
 * DP-12.4 · EL MESERO CANCELA, contra Postgres: el servidor decide por rol. La mesera cancela
 * una cuenta y anula un platillo, con su nombre y su motivo; cocina y almacén reciben
 * SIN_PERMISO. El corte y Registros, en `cancelaciones-del-corte.integracion.test.ts`.
 */

beforeAll(sembrarElSalonQueCancela);

describe('quién puede cancelar (el servidor decide, por rol)', () => {
  it('la mesera cancela una cuenta completa y queda con su nombre y su motivo', async () => {
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

  it('la mesera anula un platillo ya enviado y queda con su nombre', async () => {
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

  it.each(['cocina', 'almacen'] as const)(
    '%s NO cancela ni anula: SIN_PERMISO y la cuenta sigue viva',
    async (rol) => {
      const { ordenId, lineaIds } = await cuenta(rol === 'cocina' ? 3 : 4, ['1']);
      const quien = como(rol === 'cocina' ? cocinero : almacenista, rol);
      const sinCancelar = await cancelar(ordenId, quien);
      const sinAnular = await anular(ordenId, lineaIds[0] ?? '', quien);
      expect(sinCancelar.ok ? null : sinCancelar.error.codigo).toBe('SIN_PERMISO');
      expect(sinAnular.ok ? null : sinAnular.error.codigo).toBe('SIN_PERMISO');
      const orden = await obtenerDb()
        .selectFrom('ordenes')
        .select('estado')
        .where('id', '=', ordenId)
        .executeTakeFirstOrThrow();
      expect(orden.estado).not.toBe('cancelada');
    },
  );
});
