import type { Ambito } from '@morphiqpos/contracts';
import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { firmarAutorizacion, type CargaDeAutorizacion } from '../identidad/supervisor.ts';
import { comando } from '../produccion.ts';
import { clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { anularLineaComando } from './anulacion-linea.ts';
import { cancelarOrden } from './cancelacion.ts';
import { solicitarCuenta } from './cuenta.ts';
import { transicionarPedido } from './preparacion.ts';

import {
  cajera,
  cocinero,
  comandasDe,
  como,
  cuenta,
  mesero,
  negocio,
  sembrarElSalonQueCancela,
} from './pruebas/cancelacion-real.ts';

/**
 * DP-24 · PARTE 2 · QUIÉN QUITA LO YA ENVIADO Y QUIÉN CANCELA, contra Postgres.
 *
 *   · El MESERO no quita lo ya enviado ni cancela la cuenta: el servidor lo rechaza aunque mande el
 *     comando a mano (con o sin una autorización de gerente en la mano), y la base no cambia.
 *   · El CAJERO quita o cancela SIEMPRE con el PIN de un gerente, administrador o dueño, atado a
 *     ESA cuenta y a cancelar: sin él, con la de otra cuenta o con la de un descuento, no.
 *   · Gerente, administrador y dueño: sin PIN.
 *   · El motivo sigue siendo obligatorio y todo queda en la auditoría, con quién autorizó.
 *   · La puerta de al lado (`transicionar_pedido` a «cancelado») tampoco deja anular lo enviado.
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

/** Lo que firma `/api/identidad/supervisor` cuando Gema teclea su PIN para quien lo pide. */
function autorizacion(solicita: string, cambios: Partial<CargaDeAutorizacion> = {}): string {
  return firmarAutorizacion(
    {
      org: negocio.organizacionId,
      supervisor: gema,
      rol: 'gerente',
      solicita,
      exp: Math.floor(Date.now() / 1000) + 120,
      n: `prueba-${clave().slice(0, 8)}`,
      para: 'cancelacion',
      ...cambios,
    },
    SECRETO,
  );
}

/** El código del fallo: la regla de negocio si la hay (`REGLA_DE_NEGOCIO` la lleva en `datos`). */
const codigo = (r: {
  ok: boolean;
  error?: { codigo: string; datos?: Readonly<Record<string, unknown>> | undefined };
}): string => {
  if (r.ok) return 'ok';
  const regla = r.error?.datos?.['regla'];
  return typeof regla === 'string' ? regla : (r.error?.codigo ?? '?');
};

const deCajera = (): Ambito => como(cajera, 'cajero', true);

const cancelarCon = (ordenId: string, ambito: Ambito, firmada?: string) =>
  comando(cancelarOrden, {
    entrada: {
      ordenId,
      motivo: 'Se fueron sin pagar',
      ...(firmada === undefined ? {} : { autorizacion: firmada }),
    },
    ambito,
    idempotencyKey: clave(),
  });

const anularCon = (ordenId: string, lineaId: string, ambito: Ambito, firmada?: string) =>
  comando(anularLineaComando, {
    entrada: {
      ordenId,
      lineaId,
      motivo: 'error_cocina',
      ...(firmada === undefined ? {} : { autorizacion: firmada }),
    },
    ambito,
    idempotencyKey: clave(),
  });

/** Lo que la base guarda de la cuenta: si cambió algo, esta foto cambia. */
async function foto(ordenId: string) {
  const db = obtenerDb();
  const orden = await db
    .selectFrom('ordenes')
    .select(['estado', 'version', 'total_centavos'])
    .where('id', '=', ordenId)
    .executeTakeFirstOrThrow();
  const lineas = await db
    .selectFrom('orden_lineas')
    .select(['id', 'anulada_en', 'estado_preparacion'])
    .where('orden_id', '=', ordenId)
    .orderBy('id')
    .execute();
  const comandas = await db
    .selectFrom('comandas')
    .select(['id', 'estado'])
    .where('orden_id', '=', ordenId)
    .orderBy('id')
    .execute();
  return JSON.stringify({ orden, lineas, comandas }, (_clave, valor: unknown) =>
    typeof valor === 'bigint' ? valor.toString() : valor,
  );
}

describe('el mesero no quita lo enviado ni cancela, aunque mande el comando a mano', () => {
  it('cancelar la cuenta: el servidor lo rechaza (SIN_PERMISO) y la base no cambia', async () => {
    const { ordenId } = await cuenta(1, ['1']);
    const antes = await foto(ordenId);
    expect(codigo(await cancelarCon(ordenId, mesero()))).toBe('SIN_PERMISO');
    expect(await foto(ordenId)).toBe(antes);
  });

  it('quitar un platillo ya enviado: igual', async () => {
    const { ordenId, lineaIds } = await cuenta(2, ['1', '1']);
    const antes = await foto(ordenId);
    expect(codigo(await anularCon(ordenId, lineaIds[0] ?? '', mesero()))).toBe('SIN_PERMISO');
    expect(await foto(ordenId)).toBe(antes);
  });

  it('ni con la autorización de un gerente en la mano: el rol decide, no el PIN ajeno', async () => {
    const { ordenId, lineaIds } = await cuenta(3, ['1', '1']);
    const antes = await foto(ordenId);
    const firmada = autorizacion(negocio.empleoId, { cuenta: ordenId });
    expect(codigo(await cancelarCon(ordenId, mesero(), firmada))).toBe('SIN_PERMISO');
    expect(codigo(await anularCon(ordenId, lineaIds[0] ?? '', mesero(), firmada))).toBe(
      'SIN_PERMISO',
    );
    expect(await foto(ordenId)).toBe(antes);
  });

  it('ni siendo su mesa, ni con la cuenta ya pedida: no hay mesa «suya» que valga', async () => {
    const { ordenId, lineaIds } = await cuenta(4, ['1']);
    exigirOk(
      await comando(solicitarCuenta, {
        entrada: { ordenId, aunConPendientes: true },
        ambito: mesero(),
        idempotencyKey: clave(),
      }),
      'restaurante.solicitar_cuenta',
    );
    const antes = await foto(ordenId);
    expect(codigo(await cancelarCon(ordenId, mesero()))).toBe('SIN_PERMISO');
    expect(codigo(await anularCon(ordenId, lineaIds[0] ?? '', mesero()))).toBe('SIN_PERMISO');
    expect(await foto(ordenId)).toBe(antes);
  });

  it('la otra puerta: marcar la comanda «cancelado» a mano tampoco (mesero, cajero ni cocina)', async () => {
    const { ordenId } = await cuenta(5, ['1']);
    const [comanda] = await comandasDe(ordenId);
    const antes = await foto(ordenId);
    for (const quien of [mesero(), deCajera(), como(cocinero, 'cocina')]) {
      const r = await comando(transicionarPedido, {
        entrada: { comandaId: comanda?.id ?? '', estado: 'cancelado' },
        ambito: quien,
        idempotencyKey: clave(),
      });
      expect(codigo(r), `rol ${quien.rol}`).toBe('SIN_PERMISO');
    }
    expect(await foto(ordenId)).toBe(antes);
  });
});

describe('el cajero siempre con el PIN de un gerente, atado a ESA cuenta', () => {
  it('cancelar sin PIN no se puede, aunque la cuenta ni se haya pedido; la base no cambia', async () => {
    const { ordenId } = await cuenta(6, ['1']);
    const antes = await foto(ordenId);
    expect(codigo(await cancelarCon(ordenId, deCajera()))).toBe('PUESTO_NO_OTORGABLE');
    expect(await foto(ordenId)).toBe(antes);
  });

  it('quitar un platillo sin PIN, tampoco; la base no cambia', async () => {
    const { ordenId, lineaIds } = await cuenta(7, ['1', '1']);
    const antes = await foto(ordenId);
    expect(codigo(await anularCon(ordenId, lineaIds[0] ?? '', deCajera()))).toBe(
      'PUESTO_NO_OTORGABLE',
    );
    expect(await foto(ordenId)).toBe(antes);
  });

  it('el PIN de OTRA cuenta, el de un descuento o el que pidió otra persona, no sirven', async () => {
    const { ordenId } = await cuenta(8, ['1']);
    const otra = await cuenta(9, ['1']);
    const antes = await foto(ordenId);
    const casos = [
      autorizacion(cajera, { cuenta: otra.ordenId }),
      autorizacion(cajera, { cuenta: ordenId, para: 'descuento' }),
      autorizacion(negocio.empleoId, { cuenta: ordenId }),
    ];
    for (const firmada of casos) {
      expect(codigo(await cancelarCon(ordenId, deCajera(), firmada))).toBe('PUESTO_NO_OTORGABLE');
    }
    expect(await foto(ordenId)).toBe(antes);
  });

  it('con el PIN de ESA cuenta cancela, y la auditoría dice quién autorizó', async () => {
    const { ordenId } = await cuenta(10, ['1']);
    const hecha = await cancelarCon(ordenId, deCajera(), autorizacion(cajera, { cuenta: ordenId }));
    expect(codigo(hecha)).toBe('ok');
    const rastro = await obtenerDb()
      .selectFrom('auditoria')
      .select(['payload'])
      .where('entidad_id', '=', ordenId)
      .where('accion', '=', 'restaurante.cancelar_orden')
      .executeTakeFirstOrThrow();
    expect(rastro.payload).toMatchObject({ autorizadoPor: gema, motivo: 'Se fueron sin pagar' });
  });

  it('con el PIN de ESA cuenta quita el platillo, y queda con el nombre de la cajera y quién autorizó', async () => {
    const { ordenId, lineaIds } = await cuenta(11, ['1', '1']);
    const hecha = await anularCon(
      ordenId,
      lineaIds[0] ?? '',
      deCajera(),
      autorizacion(cajera, { cuenta: ordenId }),
    );
    expect(codigo(hecha)).toBe('ok');
    const linea = await obtenerDb()
      .selectFrom('orden_lineas')
      .select(['anulada_en', 'empleado_anula_id', 'motivo_anulacion'])
      .where('id', '=', lineaIds[0] ?? '')
      .executeTakeFirstOrThrow();
    expect(linea.anulada_en).not.toBeNull();
    expect(linea.empleado_anula_id).toBe(cajera);
    expect(linea.motivo_anulacion).toBe('error_cocina');
    const rastro = await obtenerDb()
      .selectFrom('auditoria')
      .select(['payload'])
      .where('entidad_id', '=', ordenId)
      .where('accion', '=', 'restaurante.anular_linea')
      .executeTakeFirstOrThrow();
    expect(rastro.payload).toMatchObject({ autorizadoPor: gema });
  });

  it('el motivo sigue siendo obligatorio, aun con el PIN bueno', async () => {
    const { ordenId } = await cuenta(12, ['1']);
    const antes = await foto(ordenId);
    const r = await comando(cancelarOrden, {
      entrada: { ordenId, motivo: '   ', autorizacion: autorizacion(cajera, { cuenta: ordenId }) },
      ambito: deCajera(),
      idempotencyKey: clave(),
    });
    expect(codigo(r)).toBe('ENTRADA_INVALIDA');
    expect(await foto(ordenId)).toBe(antes);
  });
});

describe('gerente, administrador y dueño, sin PIN', () => {
  it.each(['gerente', 'administrador', 'dueno'] as const)(
    '%s cancela una cuenta y quita un platillo sin autorización; el rastro no lleva «autorizó»',
    async (rol) => {
      const quien = como(gema, rol);
      // La mesa 10 se libera al cancelar: sirve para cada rol, uno tras otro.
      const { ordenId, lineaIds } = await cuenta(10, ['1', '1']);
      expect(codigo(await anularCon(ordenId, lineaIds[0] ?? '', quien))).toBe('ok');
      expect(codigo(await cancelarCon(ordenId, quien))).toBe('ok');
      const rastros = await obtenerDb()
        .selectFrom('auditoria')
        .select(['payload'])
        .where('entidad_id', '=', ordenId)
        .where('accion', 'in', ['restaurante.cancelar_orden', 'restaurante.anular_linea'])
        .execute();
      expect(rastros).toHaveLength(2);
      for (const { payload } of rastros) {
        expect(payload).toMatchObject({ autorizadoPor: null });
      }
    },
  );

  it('la gerencia marca la comanda «cancelado» (es la que sí puede)', async () => {
    const { ordenId } = await cuenta(13, ['1']);
    const [comanda] = await comandasDe(ordenId);
    const r = await comando(transicionarPedido, {
      entrada: { comandaId: comanda?.id ?? '', estado: 'cancelado' },
      ambito: como(gema, 'gerente'),
      idempotencyKey: clave(),
    });
    expect(codigo(r)).toBe('ok');
  });
});

describe('Parte 7 · con la asignación de mesas apagada, quien abre la mesa se queda con ella', () => {
  it('la cuenta que abre el mesero queda a su nombre (de ahí salen la propina y el corte)', async () => {
    const config = await obtenerDb()
      .selectFrom('configuracion')
      .select('valores')
      .where('organizacion_id', '=', negocio.organizacionId)
      .executeTakeFirst();
    const valores = (config?.valores ?? {}) as Record<string, unknown>;
    expect(valores['asignacion_mesas_activa'] ?? false, 'La asignación debía estar apagada.').toBe(
      false,
    );

    const { ordenId } = await cuenta(14, ['1']);
    const orden = await obtenerDb()
      .selectFrom('ordenes')
      .select('empleado_atiende_id')
      .where('id', '=', ordenId)
      .executeTakeFirstOrThrow();
    expect(orden.empleado_atiende_id).toBe(negocio.empleoId);
  });
});
