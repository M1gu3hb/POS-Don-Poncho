import { conTransaccion } from '@morphiqpos/data';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { firmarAutorizacion, type CargaDeAutorizacion } from '../identidad/supervisor.ts';
import { comando } from '../produccion.ts';
import { clave, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { cancelarOrden } from './cancelacion.ts';
import { anularLineaComando } from './anulacion-linea.ts';

import {
  cancelar,
  cuenta,
  delCorte,
  mesero,
  negocio,
  sembrarElSalonQueCancela,
} from './pruebas/cancelacion-real.ts';

/**
 * DP-D179 · QUIÉN AUTORIZÓ UNA CANCELACIÓN SALE EN EL CORTE Y EN REGISTROS, contra Postgres.
 *
 * Con la cuenta ya pedida (o su precuenta impresa) cancelar o quitar un platillo lleva el PIN de un
 * gerente, y la auditoría guardaba quién (`autorizadoPor`); la lectura que arma el corte y
 * Registros no lo traía, así que el papel decía quién canceló y por qué pero no quién lo dejó.
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

function autorizacion(cuentaId: string, para: CargaDeAutorizacion['para'] = 'cancelacion'): string {
  return firmarAutorizacion(
    {
      org: negocio.organizacionId,
      supervisor: gema,
      rol: 'gerente',
      solicita: negocio.empleoId,
      exp: Math.floor(Date.now() / 1000) + 120,
      n: `prueba-${clave().slice(0, 8)}`,
      para,
      cuenta: cuentaId,
    },
    SECRETO,
  );
}

const imprimida = (ordenId: string) =>
  conTransaccion((tx) =>
    tx
      .updateTable('ordenes')
      .set({ precuentas_impresas: 1, precuenta_impresa_en: new Date() })
      .where('id', '=', ordenId)
      .execute(),
  );

describe('la cancelación dice quién la autorizó', () => {
  it('una cuenta con la precuenta impresa, cancelada con el PIN de Gema: sale «Gema»', async () => {
    const { ordenId, mesa } = await cuenta(1, ['1']);
    await imprimida(ordenId);
    const hecha = await comando(cancelarOrden, {
      entrada: { ordenId, motivo: 'Se fueron sin pagar', autorizacion: autorizacion(ordenId) },
      ambito: mesero(),
      idempotencyKey: clave(),
    });
    expect(hecha.ok).toBe(true);
    expect(await delCorte(mesa)).toMatchObject([{ tipo: 'orden', autorizo: 'Gema' }]);
  });

  it('un platillo quitado con la precuenta impresa y el PIN de Gema: sale «Gema»', async () => {
    const { ordenId, lineaIds, mesa } = await cuenta(2, ['1', '1']);
    await imprimida(ordenId);
    const hecha = await comando(anularLineaComando, {
      entrada: {
        ordenId,
        lineaId: lineaIds[0] ?? '',
        motivo: 'error_mesero',
        autorizacion: autorizacion(ordenId),
      },
      ambito: mesero(),
      idempotencyKey: clave(),
    });
    expect(hecha.ok).toBe(true);
    expect(await delCorte(mesa)).toMatchObject([{ tipo: 'linea', autorizo: 'Gema' }]);
  });

  it('lo que no necesitó autorización (cuenta sin pedir) sale sin autorizó, no con otro nombre', async () => {
    const { ordenId, mesa } = await cuenta(3, ['1']);
    expect((await cancelar(ordenId, mesero(), 'Capturé mal')).ok).toBe(true);
    const [fila] = await delCorte(mesa);
    expect(fila?.autorizo).toBeNull();
  });
});
