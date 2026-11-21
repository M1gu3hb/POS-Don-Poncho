import type { Ambito } from '@morphiqpos/contracts';
import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { firmarAutorizacion, type CargaDeAutorizacion } from '../identidad/supervisor.ts';
import { comando } from '../produccion.ts';
import { clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { anularLineaComando } from './anulacion-linea.ts';
import { cancelarOrden } from './cancelacion.ts';
import { solicitarCuenta } from './cuenta.ts';
import { abrirMesa } from './mesas.ts';
import { enviarPedido } from './pedido.ts';
import { unirMesasComando } from './union-de-mesas.ts';

import {
  arrachera,
  cajera,
  cancelar,
  como,
  cuenta,
  mesero,
  negocio,
  sembrarElSalonQueCancela,
  sucursal,
} from './pruebas/cancelacion-real.ts';

/**
 * DP-13.2 · CANCELAR CON LAS REGLAS DEL SERVIDOR, contra Postgres; puesto al día en DP-24 · Parte 2.
 *
 *   · Una cuenta pagada, dividida, reembolsada o absorbida no se cancela.
 *   · El motivo es obligatorio en el servidor, no sólo en la pantalla.
 *   · Cancelar o quitar un platillo ya enviado: el MESERO no; la CAJA, siempre con el PIN de un
 *     gerente, administrador o dueño (una autorización atada a ESA cuenta y a cancelar, DP-D51);
 *     la gerencia, sin PIN. Estén o no pedidas o impresas las cuentas, y diga lo que diga la
 *     configuración vieja `pin_al_cancelar_cuenta_pedida`.
 *
 * El detalle del rechazo al mesero, a mano y sin cambios en la base, está en
 * `quien-quita-y-cancela.integracion.test.ts`.
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

/** El código del fallo: la regla de negocio si la hay (`REGLA_DE_NEGOCIO` la lleva en `datos`). */
const codigo = (r: {
  ok: boolean;
  error?: { codigo: string; datos?: Readonly<Record<string, unknown>> | undefined };
}): string => {
  if (r.ok) return 'ok';
  const regla = r.error?.datos?.['regla'];
  return typeof regla === 'string' ? regla : (r.error?.codigo ?? '?');
};

const deLaCajera = (): Ambito => como(cajera, 'cajero', true);

/** Lo que firma `/api/identidad/supervisor` cuando Gema teclea su PIN para la cajera. */
function autorizacion(cambios: Partial<CargaDeAutorizacion> = {}): string {
  return firmarAutorizacion(
    {
      org: negocio.organizacionId,
      supervisor: gema,
      rol: 'gerente',
      solicita: cajera,
      exp: Math.floor(Date.now() / 1000) + 120,
      n: `prueba-${clave().slice(0, 8)}`,
      para: 'cancelacion',
      ...cambios,
    },
    SECRETO,
  );
}

/** La cajera cancela con lo que le den: sin PIN (`firmada` ausente) o con la autorización dada. */
const cancelarLaCajera = (ordenId: string, firmada?: string) =>
  comando(cancelarOrden, {
    entrada: {
      ordenId,
      motivo: 'Se fueron sin pagar',
      ...(firmada === undefined ? {} : { autorizacion: firmada }),
    },
    ambito: deLaCajera(),
    idempotencyKey: clave(),
  });

const marcar = (
  ordenId: string,
  cambios: { estado?: string; precuentas_impresas?: number; precuenta_impresa_en?: Date },
) =>
  conTransaccion((tx) =>
    tx.updateTable('ordenes').set(cambios).where('id', '=', ordenId).execute(),
  );

describe('lo que no se cancela', () => {
  it.each(['dividida', 'reembolsada', 'absorbida'])('una cuenta %s, no', async (estado) => {
    const { ordenId } = await cuenta(1 + ['dividida', 'reembolsada', 'absorbida'].indexOf(estado), [
      '1',
    ]);
    await marcar(ordenId, { estado });
    expect(codigo(await cancelar(ordenId, como(gema, 'gerente')))).toBe('ORDEN_NO_EDITABLE');
  });

  it('sin motivo (o sólo espacios), el servidor no la cancela', async () => {
    const { ordenId } = await cuenta(4, ['1']);
    expect(codigo(await cancelar(ordenId, como(gema, 'gerente'), '   '))).toBe('ENTRADA_INVALIDA');
  });
});

describe('quién cancela', () => {
  it('la gerente, en cualquiera de su sucursal y sin PIN', async () => {
    const { ordenId } = await cuenta(7, ['1']);
    expect(codigo(await cancelar(ordenId, como(gema, 'gerente')))).toBe('ok');
  });

  it('el mesero, no: ni siendo su mesa (el detalle, en quien-quita-y-cancela)', async () => {
    const { ordenId } = await cuenta(5, ['1']);
    const [primera] = await lineas(ordenId);
    const a = await comando(cancelarOrden, {
      entrada: { ordenId, motivo: 'Se fueron sin pagar' },
      ambito: mesero(),
      idempotencyKey: clave(),
    });
    expect(codigo(a)).toBe('SIN_PERMISO');
    expect(codigo(await anularComoMesero(ordenId, primera ?? ''))).toBe('SIN_PERMISO');
  });
});

describe('la cajera, siempre con el PIN de un gerente atado a ESA cuenta', () => {
  it('cuenta sin pedir: sin PIN no; con la de OTRA cuenta no; con la de un descuento no; con la suya sí', async () => {
    const { ordenId } = await cuenta(8, ['1']);
    const otra = await cuenta(9, ['1']);
    expect(codigo(await cancelarLaCajera(ordenId))).toBe('PUESTO_NO_OTORGABLE');
    expect(codigo(await cancelarLaCajera(ordenId, autorizacion({ cuenta: otra.ordenId })))).toBe(
      'PUESTO_NO_OTORGABLE',
    );
    expect(
      codigo(await cancelarLaCajera(ordenId, autorizacion({ cuenta: ordenId, para: 'descuento' }))),
    ).toBe('PUESTO_NO_OTORGABLE');
    expect(codigo(await cancelarLaCajera(ordenId, autorizacion({ cuenta: ordenId })))).toBe('ok');
  });

  it('pedida: lo mismo (el PIN ya no depende de que se haya pedido)', async () => {
    const { ordenId } = await cuenta(10, ['1']);
    exigirOk(
      await comando(solicitarCuenta, {
        entrada: { ordenId },
        ambito: mesero(),
        idempotencyKey: clave(),
      }),
      'restaurante.solicitar_cuenta',
    );
    expect(codigo(await cancelarLaCajera(ordenId))).toBe('PUESTO_NO_OTORGABLE');
    expect(codigo(await cancelarLaCajera(ordenId, autorizacion({ cuenta: ordenId })))).toBe('ok');
  });

  it('QA2-007 · pedida y REABIERTA (vuelve a confirmada, conserva su código): sigue pidiendo el PIN', async () => {
    const { ordenId } = await cuenta(13, ['1']);
    exigirOk(
      await comando(solicitarCuenta, {
        entrada: { ordenId },
        ambito: mesero(),
        idempotencyKey: clave(),
      }),
      'restaurante.solicitar_cuenta',
    );
    await marcar(ordenId, { estado: 'confirmada' });
    expect(codigo(await cancelarLaCajera(ordenId))).toBe('PUESTO_NO_OTORGABLE');
  });

  it('impresa (la precuenta salió): quitar un platillo pide el PIN, y con el PIN se quita', async () => {
    const { ordenId, lineaIds } = await cuenta(11, ['1', '1']);
    await marcar(ordenId, { precuentas_impresas: 1, precuenta_impresa_en: new Date() });
    const primera = lineaIds[0] ?? '';
    const sinPin = await comando(anularLineaComando, {
      entrada: { ordenId, lineaId: primera, motivo: 'error_mesero' },
      ambito: deLaCajera(),
      idempotencyKey: clave(),
    });
    expect(codigo(sinPin)).toBe('PUESTO_NO_OTORGABLE');
    const conPin = await comando(anularLineaComando, {
      entrada: {
        ordenId,
        lineaId: primera,
        motivo: 'error_mesero',
        autorizacion: autorizacion({ cuenta: ordenId }),
      },
      ambito: deLaCajera(),
      idempotencyKey: clave(),
    });
    expect(codigo(conPin)).toBe('ok');
  });

  it('la gerente no necesita PIN de nadie: ella es quien autoriza, esté como esté la cuenta', async () => {
    const { ordenId } = await cuenta(12, ['1']);
    await marcar(ordenId, { precuentas_impresas: 2, precuenta_impresa_en: new Date() });
    expect(codigo(await cancelar(ordenId, como(gema, 'gerente')))).toBe('ok');
  });

  it('la configuración vieja «pin_al_cancelar_cuenta_pedida = false» ya no apaga el PIN de la caja', async () => {
    const { ordenId } = await cuenta(6, ['1']);
    await marcar(ordenId, { precuentas_impresas: 1, precuenta_impresa_en: new Date() });
    await sql`
      insert into configuracion (organizacion_id, valores)
      values (${negocio.organizacionId}, '{"pin_al_cancelar_cuenta_pedida": false}'::jsonb)
      on conflict (organizacion_id)
      do update set valores = configuracion.valores || excluded.valores
    `.execute(obtenerDb());
    try {
      expect(codigo(await cancelarLaCajera(ordenId))).toBe('PUESTO_NO_OTORGABLE');
    } finally {
      await sql`
        update configuracion set valores = valores - 'pin_al_cancelar_cuenta_pedida'
         where organizacion_id = ${negocio.organizacionId}
      `.execute(obtenerDb());
    }
  });
});

describe('con mesas unidas, la cuenta que queda se cancela igual: la caja con PIN', () => {
  let mesasDeMas: readonly string[] = [];

  beforeAll(async () => {
    mesasDeMas = (
      await obtenerDb()
        .insertInto('mesas')
        .values(
          [21, 22].map((numero) => ({
            organizacion_id: negocio.organizacionId,
            sucursal_id: sucursal.sucursalId,
            numero,
          })),
        )
        .returning('id')
        .execute()
    ).map((m) => m.id);
  });

  const mesaDeMas = (numero: number): string => mesasDeMas[numero - 21] ?? '';

  async function abrirCon(numero: number): Promise<string> {
    const { ordenId } = exigirOk(
      await comando(abrirMesa, {
        entrada: { mesaId: mesaDeMas(numero), personas: 2 },
        ambito: mesero(),
        idempotencyKey: clave(),
      }),
      'restaurante.abrir_mesa',
    );
    exigirOk(
      await comando(enviarPedido, {
        entrada: { ordenId, lineas: [{ productoId: arrachera, cantidad: '1' }] },
        ambito: mesero(),
        idempotencyKey: clave(),
      }),
      'restaurante.enviar_pedido',
    );
    return ordenId;
  }

  it('unir sigue siendo del mesero; cancelar la principal, de la caja con PIN', async () => {
    const principal = await abrirCon(21);
    await abrirCon(22);
    exigirOk(
      await comando(unirMesasComando, {
        entrada: { mesaPrincipalId: mesaDeMas(21), mesaIds: [mesaDeMas(22)] },
        ambito: mesero(),
        idempotencyKey: clave(),
      }),
      'restaurante.unir_mesas',
    );
    expect(codigo(await cancelarLaCajera(principal))).toBe('PUESTO_NO_OTORGABLE');
    expect(codigo(await cancelarLaCajera(principal, autorizacion({ cuenta: principal })))).toBe(
      'ok',
    );
  });
});

async function lineas(ordenId: string): Promise<string[]> {
  return (
    await obtenerDb()
      .selectFrom('orden_lineas')
      .select('id')
      .where('orden_id', '=', ordenId)
      .orderBy('created_at')
      .execute()
  ).map((l) => l.id);
}

/** `anular` sube el puesto a gerente (miran otra cosa); aquí se prueba el permiso, con el ámbito de verdad. */
const anularComoMesero = (ordenId: string, lineaId: string) =>
  comando(anularLineaComando, {
    entrada: { ordenId, lineaId, motivo: 'error_mesero' },
    ambito: mesero(),
    idempotencyKey: clave(),
  });
