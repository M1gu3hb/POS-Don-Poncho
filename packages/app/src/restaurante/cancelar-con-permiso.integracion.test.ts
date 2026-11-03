import type { Ambito } from '@morphiqpos/contracts';
import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { firmarAutorizacion, type CargaDeAutorizacion } from '../identidad/supervisor.ts';
import { comando } from '../produccion.ts';
import { clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { cancelarOrden } from './cancelacion.ts';
import { solicitarCuenta } from './cuenta.ts';
import { abrirMesa } from './mesas.ts';
import { enviarPedido } from './pedido.ts';
import { separarMesasComando, unirMesasComando } from './union-de-mesas.ts';

import {
  anular,
  arrachera,
  cancelar,
  como,
  cuenta,
  mesero,
  negocio,
  sembrarElSalonQueCancela,
  sucursal,
} from './pruebas/cancelacion-real.ts';

/**
 * DP-13.2 · CANCELAR DESDE EL MESERO, con sus reglas del SERVIDOR, contra Postgres.
 *
 *   · Una cuenta pagada, dividida, reembolsada o absorbida no se cancela.
 *   · El motivo es obligatorio en el servidor, no sólo en la pantalla.
 *   · El mesero cancela (o anula) sólo en las mesas que atiende o que tiene asignadas; gerente,
 *     administrador y dueño, en cualquiera de su sucursal.
 *   · Con la cuenta ya pedida o la precuenta impresa, cancelar o anular pide el PIN de un gerente
 *     o del dueño, en una autorización atada a ESA cuenta y a cancelar (DP-D51; Miguel la puede
 *     apagar con `pin_al_cancelar_cuenta_pedida`). La autorización de un descuento no sirve.
 */

const SECRETO = 'secreto_de_integracion_para_firmar_autorizaciones_2026';
vi.mock('@morphiqpos/contracts', async (original) => ({
  ...(await original<typeof import('@morphiqpos/contracts')>()),
  validarEntorno: () => ({ SESSION_SECRET: SECRETO }),
}));

let pablo = '';
let gema = '';

beforeAll(async () => {
  await sembrarElSalonQueCancela();
  pablo = await sembrarCompanero(negocio, { nombre: 'Pablo', rol: 'mesero' });
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

/** Lo que firma `/api/identidad/supervisor` cuando Gema teclea su PIN para la mesera. */
function autorizacion(cambios: Partial<CargaDeAutorizacion> = {}): string {
  return firmarAutorizacion(
    {
      org: negocio.organizacionId,
      supervisor: gema,
      rol: 'gerente',
      solicita: negocio.empleoId,
      exp: Math.floor(Date.now() / 1000) + 120,
      n: `prueba-${clave().slice(0, 8)}`,
      para: 'cancelacion',
      ...cambios,
    },
    SECRETO,
  );
}

const cancelarCon = (ordenId: string, firmada: string) =>
  comando(cancelarOrden, {
    entrada: { ordenId, motivo: 'Se fueron sin pagar', autorizacion: firmada },
    ambito: mesero(),
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
    expect(codigo(await cancelar(ordenId, mesero(), '   '))).toBe('ENTRADA_INVALIDA');
  });
});

describe('quién cancela qué mesa', () => {
  it('otro mesero que no la atiende ni la tiene asignada, no', async () => {
    const { ordenId } = await cuenta(5, ['1']);
    expect(codigo(await cancelar(ordenId, como(pablo, 'mesero')))).toBe('SIN_PERMISO');
    expect(
      codigo(await anular(ordenId, (await lineas(ordenId))[0] ?? '', como(pablo, 'mesero'))),
    ).toBe('SIN_PERMISO');
  });

  it('el mesero que la tiene ASIGNADA, sí', async () => {
    const { ordenId } = await cuenta(6, ['1']);
    const { mesa_id } = await obtenerDb()
      .selectFrom('ordenes')
      .select('mesa_id')
      .where('id', '=', ordenId)
      .executeTakeFirstOrThrow();
    await conTransaccion((tx) =>
      tx
        .updateTable('mesas')
        .set({ empleado_asignado_id: pablo })
        .where('id', '=', mesa_id ?? '')
        .execute(),
    );
    expect(codigo(await cancelar(ordenId, como(pablo, 'mesero')))).toBe('ok');
  });

  it('la gerente, en cualquiera de su sucursal', async () => {
    const { ordenId } = await cuenta(7, ['1']);
    expect(codigo(await cancelar(ordenId, como(gema, 'gerente')))).toBe('ok');
  });
});

describe('con la cuenta pedida o impresa, el PIN de un gerente atado a ESA cuenta', () => {
  it('pedida: sin PIN no; con la de OTRA cuenta no; con la de un descuento no; con la suya sí', async () => {
    const { ordenId } = await cuenta(8, ['1']);
    const otra = await cuenta(9, ['1']);
    await comando(solicitarCuenta, {
      entrada: { ordenId },
      ambito: mesero(),
      idempotencyKey: clave(),
    });
    expect(codigo(await cancelar(ordenId, mesero()))).toBe('PUESTO_NO_OTORGABLE');
    expect(codigo(await cancelarCon(ordenId, autorizacion({ cuenta: otra.ordenId })))).toBe(
      'PUESTO_NO_OTORGABLE',
    );
    expect(
      codigo(await cancelarCon(ordenId, autorizacion({ cuenta: ordenId, para: 'descuento' }))),
    ).toBe('PUESTO_NO_OTORGABLE');
    expect(codigo(await cancelarCon(ordenId, autorizacion({ cuenta: ordenId })))).toBe('ok');
    exigirCancelada(await cancelar(otra.ordenId, mesero()));
  });

  it('QA2-007 · pedida y REABIERTA (vuelve a confirmada, conserva su código): sigue pidiendo el PIN', async () => {
    const { ordenId } = await cuenta(13, ['1']);
    await comando(solicitarCuenta, {
      entrada: { ordenId },
      ambito: mesero(),
      idempotencyKey: clave(),
    });
    // Lo que deja `reabrir-la-cuenta.ts` (DP-D58): la cuenta otra vez `confirmada`, con su
    // `codigo_caja` (el comensal tiene ese papel en la mano).
    await marcar(ordenId, { estado: 'confirmada' });
    expect(codigo(await cancelar(ordenId, mesero()))).toBe('PUESTO_NO_OTORGABLE');
  });

  it('impresa (la precuenta salió): anular un platillo también pide el PIN', async () => {
    const { ordenId } = await cuenta(10, ['1', '1']);
    await marcar(ordenId, { precuentas_impresas: 1, precuenta_impresa_en: new Date() });
    const [primera] = await lineas(ordenId);
    expect(codigo(await anular(ordenId, primera ?? '', mesero()))).toBe('PUESTO_NO_OTORGABLE');
  });

  it('la gerente no necesita PIN de nadie: ella es quien autoriza', async () => {
    const { ordenId } = await cuenta(11, ['1']);
    await marcar(ordenId, { precuentas_impresas: 2, precuenta_impresa_en: new Date() });
    expect(codigo(await cancelar(ordenId, como(gema, 'gerente')))).toBe('ok');
  });

  it('con la regla apagada por Miguel, la mesera cancela la cuenta pedida sin PIN', async () => {
    const { ordenId } = await cuenta(12, ['1']);
    await marcar(ordenId, { precuentas_impresas: 1, precuenta_impresa_en: new Date() });
    await sql`
      insert into configuracion (organizacion_id, valores)
      values (${negocio.organizacionId}, '{"pin_al_cancelar_cuenta_pedida": false}'::jsonb)
      on conflict (organizacion_id)
      do update set valores = configuracion.valores || excluded.valores
    `.execute(obtenerDb());
    try {
      expect(codigo(await cancelar(ordenId, mesero()))).toBe('ok');
    } finally {
      await sql`
        update configuracion set valores = valores - 'pin_al_cancelar_cuenta_pedida'
         where organizacion_id = ${negocio.organizacionId}
      `.execute(obtenerDb());
    }
  });
});

describe('con mesas unidas, la cuenta que queda carga con lo de las absorbidas', () => {
  let mesasDeMas: readonly string[] = [];

  beforeAll(async () => {
    mesasDeMas = (
      await obtenerDb()
        .insertInto('mesas')
        .values(
          [21, 22, 23, 24, 25, 26].map((numero) => ({
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

  /** Una cuenta con una arrachera en la mesa `numero`, abierta por quien diga `ambito`. */
  async function abrirCon(numero: number, ambito: Ambito): Promise<string> {
    const { ordenId } = exigirOk(
      await comando(abrirMesa, {
        entrada: { mesaId: mesaDeMas(numero), personas: 2 },
        ambito,
        idempotencyKey: clave(),
      }),
      'restaurante.abrir_mesa',
    );
    exigirOk(
      await comando(enviarPedido, {
        entrada: { ordenId, lineas: [{ productoId: arrachera, cantidad: '1' }] },
        ambito,
        idempotencyKey: clave(),
      }),
      'restaurante.enviar_pedido',
    );
    return ordenId;
  }

  const unir = async (principal: number, otra: number) =>
    exigirOk(
      await comando(unirMesasComando, {
        entrada: { mesaPrincipalId: mesaDeMas(principal), mesaIds: [mesaDeMas(otra)] },
        ambito: mesero(),
        idempotencyKey: clave(),
      }),
      'restaurante.unir_mesas',
    );

  it('la absorbida ya PEDIDA: cancelar o anular en la principal sigue pidiendo el PIN', async () => {
    const principal = await abrirCon(21, mesero());
    const pedida = await abrirCon(22, mesero());
    exigirOk(
      await comando(solicitarCuenta, {
        entrada: { ordenId: pedida },
        ambito: mesero(),
        idempotencyKey: clave(),
      }),
      'restaurante.solicitar_cuenta',
    );
    await unir(21, 22);

    expect(codigo(await cancelar(principal, mesero()))).toBe('PUESTO_NO_OTORGABLE');
    const [primera] = await lineas(principal);
    expect(codigo(await anular(principal, primera ?? '', mesero()))).toBe('PUESTO_NO_OTORGABLE');
    expect(codigo(await cancelarCon(principal, autorizacion({ cuenta: principal })))).toBe('ok');
  });

  it('la absorbida con la precuenta IMPRESA, aunque ya se separaron: anular pide el PIN', async () => {
    const principal = await abrirCon(23, mesero());
    const impresa = await abrirCon(24, mesero());
    await marcar(impresa, { precuentas_impresas: 1, precuenta_impresa_en: new Date() });
    const { unionId } = await unir(23, 24);
    exigirOk(
      await comando(separarMesasComando, {
        entrada: { unionId },
        ambito: mesero(),
        idempotencyKey: clave(),
      }),
      'restaurante.separar_mesas',
    );

    // Separar no devuelve el consumo: lo de la 24 sigue en la cuenta de la 23.
    const deLaImpresa = (await lineas(principal))[1] ?? '';
    expect(codigo(await anular(principal, deLaImpresa, mesero()))).toBe('PUESTO_NO_OTORGABLE');
  });

  it('el mesero que une a la suya la mesa de OTRO no se vuelve su dueño: no la cancela', async () => {
    await abrirCon(25, como(pablo, 'mesero'));
    const suya = await abrirCon(26, mesero());
    await unir(26, 25);

    expect(codigo(await cancelar(suya, mesero()))).toBe('SIN_PERMISO');
    const [laDePablo] = await lineas(suya);
    expect(codigo(await anular(suya, laDePablo ?? '', mesero()))).toBe('SIN_PERMISO');
    expect(codigo(await cancelar(suya, como(gema, 'gerente')))).toBe('ok');
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

function exigirCancelada(r: { ok: boolean }): void {
  expect(r.ok).toBe(true);
}
