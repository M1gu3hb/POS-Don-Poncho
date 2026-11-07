import type { Ambito } from '@morphiqpos/contracts';
import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { cancelacionesDelCorte } from '../caja/corte/cancelaciones.ts';
import { firmarAutorizacion } from '../identidad/supervisor.ts';
import { comando } from '../produccion.ts';
import { clave, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { cancelarOrden } from './cancelacion.ts';
import {
  ARRACHERA_CENTAVOS,
  EXISTENCIA_INICIAL,
  GUACAMOLE_CENTAVOS,
  ambitoDeCaja,
  consumoEsperado,
  dividirEn,
  existenciasDelSalon,
  sembrarSalon,
  sentarYPedir,
  type NombreDeInsumo,
  type PlatilloPedido,
  type Salon,
} from './pruebas/salon-real.ts';

/**
 * DP-14.6-7 · CANCELAR SIN PODER COMPROBAR LA COCINA, contra Postgres.
 *
 * Si la Caja no logra leer lo que la cocina ya preparó (la lectura vence o falla), no sabe qué
 * ya salió. El encargo: se puede cancelar con el PIN de un gerente, TRATANDO TODO COMO YA HECHO.
 * `restaurante.cancelar_orden` con `sinComprobarLaCocina`:
 *
 *   · exige el PIN de un gerente, administrador o dueño firmado para ESA cuenta (aunque no se haya
 *     pedido); quien autoriza por su puesto no lo teclea;
 *   · todo lo vivo de la cuenta es pérdida en el corte y sale del almacén como merma, aunque la
 *     cocina no haya marcado nada;
 *   · sin la marca, lo que la cocina no marcó no es pérdida (como siempre).
 *
 * Y una PARTE cancelada de una cuenta dividida sale en el corte con la mesa de su madre.
 */

const SECRETO = 'secreto_de_integracion_de_la_cocina_sin_lectura_2026';
vi.mock('@morphiqpos/contracts', async (original) => ({
  ...(await original<typeof import('@morphiqpos/contracts')>()),
  validarEntorno: () => ({ SESSION_SECRET: SECRETO }),
}));

const POR_COMANDOS = 120_000;
const PEDIDO: readonly PlatilloPedido[] = [
  { platillo: 'arrachera', cantidad: '1' },
  { platillo: 'guacamole', cantidad: '1' },
];
const TOTAL = String(ARRACHERA_CENTAVOS + GUACAMOLE_CENTAVOS);

let salon: Salon;
let cajera = '';
let gema = '';

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Fonda sin lectura de la cocina', mesas: 8 });
  cajera = await sembrarCompanero(salon.negocio, { nombre: 'Beatriz', rol: 'cajero' });
  gema = await sembrarCompanero(salon.negocio, { nombre: 'Gema', rol: 'gerente' });
}, POR_COMANDOS);

const comoCajera = (): Ambito => ({ ...ambitoDeCaja(salon), empleoId: cajera, rol: 'cajero' });
const comoGema = (): Ambito => ({ ...ambitoDeCaja(salon), empleoId: gema, rol: 'gerente' });

/** Lo que firma `/api/identidad/supervisor` cuando Gema teclea su PIN para la cajera. */
const pinDeGema = (cuenta: string): string =>
  firmarAutorizacion(
    {
      org: salon.negocio.organizacionId,
      supervisor: gema,
      rol: 'gerente',
      solicita: cajera,
      exp: Math.floor(Date.now() / 1000) + 120,
      n: `prueba-${clave().slice(0, 8)}`,
      cuenta,
      para: 'cancelacion',
    },
    SECRETO,
  );

const cancelarSinLaCocina = (ordenId: string, ambito: Ambito, autorizacion?: string) =>
  comando(cancelarOrden, {
    entrada: {
      ordenId,
      motivo: 'Se fueron sin pagar',
      sinComprobarLaCocina: true,
      ...(autorizacion === undefined ? {} : { autorizacion }),
    },
    ambito,
    idempotencyKey: clave(),
  });

const codigo = (r: {
  ok: boolean;
  error?: { codigo: string; datos?: Readonly<Record<string, unknown>> | undefined };
}): string => {
  if (r.ok) return 'ok';
  const regla = r.error?.datos?.['regla'];
  return typeof regla === 'string' ? regla : (r.error?.codigo ?? '?');
};

/** La fila del corte de la cuenta cancelada (o de la parte), en la mesa dada. */
async function delCorte(mesa: string) {
  const filas = await conTransaccion((tx) =>
    cancelacionesDelCorte(tx, salon.negocio.organizacionId, {
      sesionId: '00000000-0000-4000-8000-000000000000',
      sucursalId: salon.sucursal.sucursalId,
      abreId: '00000000-0000-4000-8000-000000000000',
      cierraElDia: true,
      desde: new Date(Date.now() - 3_600_000),
      hasta: new Date(Date.now() + 60_000),
    }),
  );
  return filas.filter((f) => f.tipo === 'orden' && f.mesa === mesa);
}

/** Cuánto bajó cada insumo desde la siembra (positivo: salió del almacén). */
async function loQueSalio(): Promise<Record<NombreDeInsumo, number>> {
  const hay = await existenciasDelSalon(salon);
  const salio = {} as Record<NombreDeInsumo, number>;
  for (const nombre of Object.keys(EXISTENCIA_INICIAL) as NombreDeInsumo[]) {
    salio[nombre] = EXISTENCIA_INICIAL[nombre] - Number(hay[nombre]);
  }
  return salio;
}

const estadoDe = async (ordenId: string) =>
  (
    await obtenerDb()
      .selectFrom('ordenes')
      .select('estado')
      .where('id', '=', ordenId)
      .executeTakeFirstOrThrow()
  ).estado;

describe('cancelar sin poder comprobar la cocina', () => {
  it(
    'la cajera sin el PIN de un gerente: no cancela, y el servidor lo pide',
    { timeout: POR_COMANDOS },
    async () => {
      const { ordenId } = await sentarYPedir(salon, 0, PEDIDO);
      const r = await cancelarSinLaCocina(ordenId, comoCajera());
      expect(codigo(r)).toBe('PUESTO_NO_OTORGABLE');
      expect(await estadoDe(ordenId)).not.toBe('cancelada');
    },
  );

  it(
    'con el PIN de la gerente: cancela, y TODO es pérdida y merma aunque la cocina no marcó nada',
    { timeout: POR_COMANDOS },
    async () => {
      const antes = await loQueSalio();
      const { ordenId } = await sentarYPedir(salon, 1, PEDIDO);
      expect(codigo(await cancelarSinLaCocina(ordenId, comoCajera(), pinDeGema(ordenId)))).toBe(
        'ok',
      );
      const [fila] = await delCorte('Mesa 2');
      expect(fila).toMatchObject({ montoCentavos: TOTAL, perdidaCentavos: TOTAL, perdida: true });

      const despues = await loQueSalio();
      const esperado = consumoEsperado(PEDIDO);
      for (const insumo of Object.keys(esperado) as NombreDeInsumo[]) {
        expect(despues[insumo] - antes[insumo], insumo).toBe(esperado[insumo]);
      }

      const auditoria = await obtenerDb()
        .selectFrom('auditoria')
        .select('payload')
        .where('accion', '=', 'restaurante.cancelar_orden')
        .where('entidad_id', '=', ordenId)
        .executeTakeFirstOrThrow();
      expect(auditoria.payload).toMatchObject({ todoComoHecho: true, autorizadoPor: gema });
    },
  );

  it('la autorización de OTRA cuenta no sirve', { timeout: POR_COMANDOS }, async () => {
    const { ordenId } = await sentarYPedir(salon, 2, PEDIDO);
    const otra = await sentarYPedir(salon, 3, PEDIDO);
    const r = await cancelarSinLaCocina(ordenId, comoCajera(), pinDeGema(otra.ordenId));
    expect(codigo(r)).toBe('PUESTO_NO_OTORGABLE');
    expect(await estadoDe(ordenId)).not.toBe('cancelada');
  });

  it(
    'la gerente con su sesión no teclea PIN, y también es pérdida todo',
    { timeout: POR_COMANDOS },
    async () => {
      const { ordenId } = await sentarYPedir(salon, 4, PEDIDO);
      expect(codigo(await cancelarSinLaCocina(ordenId, comoGema()))).toBe('ok');
      const [fila] = await delCorte('Mesa 5');
      expect(fila).toMatchObject({ perdidaCentavos: TOTAL });
    },
  );

  it(
    'sin la marca, lo que la cocina no marcó NO es pérdida ni merma (como siempre)',
    { timeout: POR_COMANDOS },
    async () => {
      const antes = await loQueSalio();
      const { ordenId } = await sentarYPedir(salon, 5, PEDIDO);
      const r = await comando(cancelarOrden, {
        entrada: { ordenId, motivo: 'Capturé mal la mesa' },
        ambito: comoCajera(),
        idempotencyKey: clave(),
      });
      expect(codigo(r)).toBe('ok');
      const filas = await delCorte('Mesa 6');
      expect(filas.find((f) => f.montoCentavos === TOTAL)).toMatchObject({
        perdidaCentavos: '0',
      });
      expect(await loQueSalio()).toEqual(antes);
    },
  );
});

describe('la parte cancelada de una cuenta dividida, en el corte', () => {
  it('sale con la mesa de su madre, no sin mesa', { timeout: POR_COMANDOS }, async () => {
    const { ordenId } = await sentarYPedir(salon, 6, PEDIDO);
    const division = await dividirEn(salon, ordenId, [
      [{ platillo: 'arrachera', cantidad: 1 }],
      [{ platillo: 'guacamole', cantidad: 1 }],
    ]);
    const parte = division.hijas[1]?.ordenId ?? '';
    const r = await comando(cancelarOrden, {
      entrada: { ordenId: parte, motivo: 'El guacamole no lo quisieron' },
      ambito: comoGema(),
      idempotencyKey: clave(),
    });
    expect(codigo(r)).toBe('ok');
    const filas = await delCorte('Mesa 7');
    expect(filas.map((f) => f.montoCentavos)).toContain(String(GUACAMOLE_CENTAVOS));
  });
});
