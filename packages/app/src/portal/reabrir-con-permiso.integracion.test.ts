import { obtenerDb } from '@morphiqpos/data';
import { describe, expect, it, vi } from 'vitest';

import { firmarAutorizacion } from '../identidad/supervisor.ts';
import { comando } from '../produccion.ts';
import { clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { enviarElCarritoDeLaMesa } from '../restaurante/carrito-del-mesero.ts';
import { solicitarCuenta } from '../restaurante/cuenta.ts';
import { abrirMesa } from '../restaurante/mesas.ts';
import { mesaConPortal, TELEFONO_A, TELEFONO_B } from './pruebas/mesa-con-portal.ts';
import { ambitoDelPersonal, type CasoDeLaMesa } from './pruebas/personal-de-la-mesa.ts';

/**
 * DP-14.6 (medio 6) · QUIÉN REABRE UNA CUENTA PEDIDA (DP-D58, congruente con DP-D51), contra Postgres.
 *
 * El mesero sólo la reabre en sus mesas; a otro mesero le hace falta el PIN de un gerente atado a
 * ESA cuenta; gerente, administrador y dueño no necesitan PIN. Y la reapertura deja su PROPIA
 * entrada en la auditoría (`restaurante.reabrir_cuenta`).
 */

const SECRETO = 'secreto_de_integracion_para_firmar_autorizaciones_2026';
vi.mock('@morphiqpos/contracts', async (original) => ({
  ...(await original<typeof import('@morphiqpos/contracts')>()),
  validarEntorno: () => ({ SESSION_SECRET: SECRETO }),
}));

const codigo = (r: {
  ok: boolean;
  error?: { codigo: string; datos?: Readonly<Record<string, unknown>> | undefined };
}): string => {
  if (r.ok) return 'ok';
  const regla = r.error?.datos?.['regla'];
  return typeof regla === 'string' ? regla : (r.error?.codigo ?? '?');
};

/** Mesa abierta por el mesero de la mesa (Rosa), con un taco armado y la cuenta pedida. */
async function mesaPedida() {
  const caso = await mesaConPortal({ envian: 'mesero' });
  await obtenerDb()
    .insertInto('estaciones_preparacion')
    .values({ organizacion_id: caso.negocio.organizacionId, nombre: 'Cocina', es_general: true })
    .execute();
  const rosa = await ambitoDelPersonal(caso, 'mesero');
  const { ordenId } = exigirOk(
    await comando(abrirMesa, {
      ambito: rosa,
      entrada: { mesaId: caso.mesaId, personas: 2 },
      idempotencyKey: clave(),
    }),
    'abrir',
  );
  exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
  exigirOk(
    await comando(enviarElCarritoDeLaMesa, {
      ambito: rosa,
      entrada: { mesaId: caso.mesaId },
      idempotencyKey: clave(),
    }),
    'enviar la primera ronda',
  );
  exigirOk(await caso.agregar(TELEFONO_B, caso.agua), 'agregar otro');
  exigirOk(
    await comando(solicitarCuenta, { ambito: rosa, entrada: { ordenId }, idempotencyKey: clave() }),
    'pedir la cuenta',
  );
  return { caso, rosa, ordenId };
}

const reabrir = (
  caso: CasoDeLaMesa,
  ambito: Awaited<ReturnType<typeof ambitoDelPersonal>>,
  autorizacion?: string,
) =>
  comando(enviarElCarritoDeLaMesa, {
    ambito,
    entrada: {
      mesaId: caso.mesaId,
      reabrirCuenta: true,
      ...(autorizacion ? { autorizacion } : {}),
    },
    idempotencyKey: clave(),
  });

const laCuenta = (id: string) =>
  obtenerDb().selectFrom('ordenes').select('estado').where('id', '=', id).executeTakeFirstOrThrow();

const entradasDeReapertura = (ordenId: string) =>
  obtenerDb()
    .selectFrom('auditoria')
    .select(['identidad_id', 'payload'])
    .where('accion', '=', 'restaurante.reabrir_cuenta')
    .where('entidad_id', '=', ordenId)
    .execute();

describe('quién reabre la cuenta pedida', () => {
  it('el mesero de la mesa la reabre sin PIN, y queda su propia entrada en la auditoría', async () => {
    const { caso, rosa, ordenId } = await mesaPedida();
    exigirOk(await reabrir(caso, rosa), 'reabrir');
    expect((await laCuenta(ordenId)).estado).not.toBe('cuenta_solicitada');
    const entradas = await entradasDeReapertura(ordenId);
    expect(entradas).toHaveLength(1);
    expect(entradas[0]?.identidad_id).toBe(rosa.identidadId);
    expect(JSON.stringify(entradas[0]?.payload)).toContain(rosa.empleoId);
  });

  it('otro mesero necesita el PIN de un gerente; sin él la cuenta sigue pedida', async () => {
    const { caso, rosa, ordenId } = await mesaPedida();
    // La mesa tiene dueña (Rosa); Pablo es otro mesero.
    await obtenerDb()
      .updateTable('mesas')
      .set({ empleado_atiende_id: rosa.empleoId })
      .where('id', '=', caso.mesaId)
      .execute();
    const pablo = await ambitoDelPersonal(caso, 'mesero');
    expect(codigo(await reabrir(caso, pablo))).toBe('PUESTO_NO_OTORGABLE');
    expect((await laCuenta(ordenId)).estado).toBe('cuenta_solicitada');
    expect(await entradasDeReapertura(ordenId)).toHaveLength(0);

    const gema = await sembrarCompanero(caso.negocio, { nombre: 'Gema', rol: 'gerente' });
    const firmar = (cambios: Record<string, unknown> = {}) =>
      firmarAutorizacion(
        {
          org: caso.negocio.organizacionId,
          supervisor: gema,
          rol: 'gerente',
          solicita: pablo.empleoId,
          exp: Math.floor(Date.now() / 1000) + 120,
          n: `prueba-${clave().slice(0, 8)}`,
          para: 'cancelacion',
          cuenta: ordenId,
          ...cambios,
        },
        SECRETO,
      );
    // Con la de OTRA cuenta no, ni con la de un descuento.
    expect(codigo(await reabrir(caso, pablo, firmar({ cuenta: pablo.empleoId })))).toBe(
      'PUESTO_NO_OTORGABLE',
    );
    expect(codigo(await reabrir(caso, pablo, firmar({ para: 'descuento' })))).toBe(
      'PUESTO_NO_OTORGABLE',
    );
    exigirOk(await reabrir(caso, pablo, firmar()), 'reabrir con el PIN');
    const [entrada] = await entradasDeReapertura(ordenId);
    expect(JSON.stringify(entrada?.payload)).toContain(gema);
  });

  it('la gerente no necesita PIN: ella es quien autoriza', async () => {
    const { caso, rosa, ordenId } = await mesaPedida();
    await obtenerDb()
      .updateTable('mesas')
      .set({ empleado_atiende_id: rosa.empleoId })
      .where('id', '=', caso.mesaId)
      .execute();
    exigirOk(await reabrir(caso, await ambitoDelPersonal(caso, 'gerente')), 'reabrir');
    expect(await entradasDeReapertura(ordenId)).toHaveLength(1);
  });
});
