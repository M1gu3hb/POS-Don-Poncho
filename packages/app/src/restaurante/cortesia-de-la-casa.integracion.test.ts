import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { firmarAutorizacion } from '../identidad/supervisor.ts';
import { comando } from '../produccion.ts';
import { clave, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { anularLineaComando } from './anulacion-linea.ts';

import {
  cajera,
  cuenta,
  deLaCajera,
  delCorte,
  delCorteDe,
  mesero,
  negocio,
  sembrarElSalonQueCancela,
  sesionCajaId,
} from './pruebas/cancelacion-real.ts';

/**
 * DP-22 · CORTESÍA DE LA CASA, contra Postgres real.
 *
 * Quitar un platillo con el motivo «Cortesía de la casa» queda en la auditoría con su motivo y quién
 * autorizó, y sale en Registros (la lectura de la sucursal) y en la hoja del corte de la caja, con
 * las palabras del motivo y el nombre de quien lo dejó pasar.
 *
 * DP-24 · Lo quita la caja SIEMPRE con la clave de un gerente (o la gerencia sin ella); el mesero no.
 */

const SECRETO = 'secreto_de_integracion_para_firmar_autorizaciones_2026';
vi.mock('@morphiqpos/contracts', async (original) => ({
  ...(await original<typeof import('@morphiqpos/contracts')>()),
  validarEntorno: () => ({ SESSION_SECRET: SECRETO }),
}));

let gema = '';

beforeAll(async () => {
  await sembrarElSalonQueCancela();
  gema = await sembrarCompanero(negocio, { nombre: 'Gema', rol: 'gerente' });
});

const autorizacion = (cuentaId: string): string =>
  firmarAutorizacion(
    {
      org: negocio.organizacionId,
      supervisor: gema,
      rol: 'gerente',
      solicita: cajera,
      exp: Math.floor(Date.now() / 1000) + 120,
      n: `cortesia-${clave().slice(0, 8)}`,
      para: 'cancelacion',
      cuenta: cuentaId,
    },
    SECRETO,
  );

const imprimida = (ordenId: string) =>
  conTransaccion((tx) =>
    tx
      .updateTable('ordenes')
      .set({ precuentas_impresas: 1, precuenta_impresa_en: new Date() })
      .where('id', '=', ordenId)
      .execute(),
  );

const auditoriaDe = (ordenId: string) =>
  obtenerDb()
    .selectFrom('auditoria')
    .select('payload')
    .where('organizacion_id', '=', negocio.organizacionId)
    .where('accion', '=', 'restaurante.anular_linea')
    .where('entidad_id', '=', ordenId)
    .execute();

describe('la cortesía de la casa al quitar un platillo', () => {
  it('la caja la quita con la clave de gerencia: queda en la auditoría y sale en Registros con «Gema»', async () => {
    const { ordenId, lineaIds, mesa } = await cuenta(1, ['1', '1']);
    await imprimida(ordenId);
    const hecha = await comando(anularLineaComando, {
      entrada: {
        ordenId,
        lineaId: lineaIds[0] ?? '',
        motivo: 'cortesia',
        autorizacion: autorizacion(ordenId),
      },
      ambito: deLaCajera(),
      idempotencyKey: clave(),
    });
    expect(hecha.ok).toBe(true);

    const [asiento, ...otros] = await auditoriaDe(ordenId);
    expect(otros).toEqual([]);
    expect(asiento?.payload).toMatchObject({ motivo: 'cortesia', autorizadoPor: gema });

    expect(await delCorte(mesa)).toMatchObject([
      { tipo: 'linea', motivo: 'Cortesía de la casa', autorizo: 'Gema', usuario: 'Beatriz' },
    ]);
  });

  it('la caja SIN clave de gerencia no la quita, esté como esté la cuenta', async () => {
    const { ordenId, lineaIds, mesa } = await cuenta(2, ['1', '1']);
    await imprimida(ordenId);
    const hecha = await comando(anularLineaComando, {
      entrada: { ordenId, lineaId: lineaIds[0] ?? '', motivo: 'cortesia' },
      ambito: deLaCajera(),
      idempotencyKey: clave(),
    });
    expect(hecha.ok).toBe(false);
    expect(await delCorte(mesa)).toEqual([]);
    expect(await auditoriaDe(ordenId)).toEqual([]);
  });

  it('el mesero no la quita, ni con la clave de gerencia en la mano', async () => {
    const { ordenId, lineaIds, mesa } = await cuenta(4, ['1', '1']);
    const hecha = await comando(anularLineaComando, {
      entrada: {
        ordenId,
        lineaId: lineaIds[0] ?? '',
        motivo: 'cortesia',
        autorizacion: autorizacion(ordenId),
      },
      ambito: mesero(),
      idempotencyKey: clave(),
    });
    expect(hecha.ok ? null : hecha.error.codigo).toBe('SIN_PERMISO');
    expect(await delCorte(mesa)).toEqual([]);
  });

  it('con la clave de gerencia, sale en la hoja del corte de SU caja con el nombre de la cajera', async () => {
    const { ordenId, lineaIds, mesa } = await cuenta(3, ['1', '1']);
    const hecha = await comando(anularLineaComando, {
      entrada: {
        ordenId,
        lineaId: lineaIds[0] ?? '',
        motivo: 'cortesia',
        autorizacion: autorizacion(ordenId),
      },
      ambito: deLaCajera(),
      idempotencyKey: clave(),
    });
    expect(hecha.ok).toBe(true);
    const hoja = await delCorteDe(sesionCajaId);
    expect(hoja.cancelaciones.filter((c) => c.mesa === mesa)).toMatchObject([
      { tipo: 'linea', motivo: 'Cortesía de la casa', usuario: 'Beatriz' },
    ]);
  });
});
