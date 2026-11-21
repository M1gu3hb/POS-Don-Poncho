import type { Ambito } from '@morphiqpos/contracts';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { firmarAutorizacion } from '../identidad/supervisor.ts';
import { comando } from '../produccion.ts';
import { clave, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { anularLineaComando } from './anulacion-linea.ts';
import { cancelarOrden } from './cancelacion.ts';
import {
  cajera,
  como,
  cuenta,
  negocio,
  sembrarElSalonQueCancela,
} from './pruebas/cancelacion-real.ts';

/**
 * DP-25 · EL PIN DE QUITAR Y DE CANCELAR ES DE UN SOLO USO, contra Postgres.
 *
 * La falla: la autorización que firma el PIN de un gerente para la caja quedaba atada a la cuenta
 * y a «cancelación», pero `anular_linea` y `cancelar_orden` no la gastaban: con un solo PIN, mandando
 * el comando a mano, la caja quitaba varios platillos de esa cuenta mientras la firma viviera (dos
 * minutos). Ahora cada autorización vale para UNA acción, de UNA cuenta, por pocos minutos, igual que
 * la de un descuento (`venta/autorizacion-de-un-uso.ts`).
 */

const SECRETO = 'secreto_de_integracion_del_pin_de_un_uso_2026';
vi.mock('@morphiqpos/contracts', async (original) => ({
  ...(await original<typeof import('@morphiqpos/contracts')>()),
  validarEntorno: () => ({ SESSION_SECRET: SECRETO }),
}));

let gema = '';

beforeAll(async () => {
  await sembrarElSalonQueCancela();
  gema = await sembrarCompanero(negocio, { nombre: 'Gema', rol: 'gerente' });
});

const codigo = (r: {
  ok: boolean;
  error?: { codigo: string; datos?: Readonly<Record<string, unknown>> | undefined };
}): string => {
  if (r.ok) return 'ok';
  const regla = r.error?.datos?.['regla'];
  return typeof regla === 'string' ? regla : (r.error?.codigo ?? '?');
};

const deLaCajera = (): Ambito => como(cajera, 'cajero', true);

/** Lo que firma `/api/identidad/supervisor` cuando Gema teclea su PIN para la cajera, en ESA cuenta. */
const pinDeGema = (cuentaId: string): string =>
  firmarAutorizacion(
    {
      org: negocio.organizacionId,
      supervisor: gema,
      rol: 'gerente',
      solicita: cajera,
      exp: Math.floor(Date.now() / 1000) + 120,
      n: `un-uso-${clave().slice(0, 8)}`,
      para: 'cancelacion',
      cuenta: cuentaId,
    },
    SECRETO,
  );

const quitar = (ordenId: string, lineaId: string, ambito: Ambito, autorizacion?: string) =>
  comando(anularLineaComando, {
    entrada: {
      ordenId,
      lineaId,
      motivo: 'error_mesero',
      ...(autorizacion === undefined ? {} : { autorizacion }),
    },
    ambito,
    idempotencyKey: clave(),
  });

const cancelarCon = (ordenId: string, ambito: Ambito, autorizacion?: string) =>
  comando(cancelarOrden, {
    entrada: {
      ordenId,
      motivo: 'Se fueron sin pagar',
      ...(autorizacion === undefined ? {} : { autorizacion }),
    },
    ambito,
    idempotencyKey: clave(),
  });

describe('la autorización de quitar y de cancelar es de un solo uso', () => {
  it('un PIN quita UN platillo: el segundo, con la misma firma, se rechaza', async () => {
    const { ordenId, lineaIds } = await cuenta(3, ['1', '1', '1']);
    const [primero = '', segundo = ''] = lineaIds;
    const firma = pinDeGema(ordenId);
    expect(codigo(await quitar(ordenId, primero, deLaCajera(), firma))).toBe('ok');
    expect(codigo(await quitar(ordenId, segundo, deLaCajera(), firma))).toBe('AUTORIZACION_USADA');
    // Con otro PIN, sí.
    expect(codigo(await quitar(ordenId, segundo, deLaCajera(), pinDeGema(ordenId)))).toBe('ok');
  });

  it('la firma que ya quitó un platillo no cancela después la cuenta', async () => {
    const { ordenId, lineaIds } = await cuenta(4, ['1', '1']);
    const firma = pinDeGema(ordenId);
    expect(codigo(await quitar(ordenId, lineaIds[0] ?? '', deLaCajera(), firma))).toBe('ok');
    expect(codigo(await cancelarCon(ordenId, deLaCajera(), firma))).toBe('AUTORIZACION_USADA');
  });

  it('dos a la vez con la misma firma: sólo una pasa', async () => {
    const { ordenId, lineaIds } = await cuenta(5, ['1', '1']);
    const firma = pinDeGema(ordenId);
    const resultados = await Promise.all(
      lineaIds.map((lineaId) => quitar(ordenId, lineaId, deLaCajera(), firma)),
    );
    expect(resultados.map(codigo).sort()).toEqual(['AUTORIZACION_USADA', 'ok']);
  });

  it('la firma de OTRA cuenta no sirve', async () => {
    const { ordenId, lineaIds } = await cuenta(7, ['1']);
    const otra = await cuenta(10, ['1']);
    expect(
      codigo(await quitar(ordenId, lineaIds[0] ?? '', deLaCajera(), pinDeGema(otra.ordenId))),
    ).toBe('PUESTO_NO_OTORGABLE');
  });

  it('la gerente y el dueño, sin PIN, quitan y cancelan cuantas veces haga falta', async () => {
    const { ordenId, lineaIds } = await cuenta(2, ['1', '1', '1']);
    expect(codigo(await quitar(ordenId, lineaIds[0] ?? '', como(gema, 'gerente')))).toBe('ok');
    expect(codigo(await quitar(ordenId, lineaIds[1] ?? '', como(gema, 'gerente')))).toBe('ok');
    expect(codigo(await quitar(ordenId, lineaIds[2] ?? '', como(negocio.empleoId, 'dueno')))).toBe(
      'ok',
    );
    const otra = await cuenta(1, ['1']);
    expect(codigo(await cancelarCon(otra.ordenId, como(negocio.empleoId, 'dueno')))).toBe('ok');
  });
});
