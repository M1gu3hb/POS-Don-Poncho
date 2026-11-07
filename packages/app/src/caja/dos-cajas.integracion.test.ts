import type { Ambito, Resultado } from '@morphiqpos/contracts';
import { obtenerDb, repoCaja } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { abrirCajaReal, clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import {
  ambitoDeCaja,
  cobrarExacto,
  ordenPersistida,
  pedirLaCuenta,
  sembrarSalon,
  sentarYPedir,
  sumaDeLosPagos,
  type Salon,
} from '../restaurante/pruebas/salon-real.ts';
import { cajasSimultaneas, fijarCajasSimultaneas } from './cajas-a-la-vez.ts';
import { abrirCaja } from './sesion.ts';

/**
 * DOS CAJAS COMO MÁXIMO, contra Postgres (DP-14.2, decisión DP-D60).
 *
 * Lo que decidió Miguel: «Cajas abiertas a la vez», 1 o 2, lo cambian sólo el dueño o el
 * administrador. Las dos cajas cobran lo mismo: ven todas las cuentas pendientes y la cobra quien
 * la tome primero; si las dos la cobran a la vez entra UN cobro, y la otra recibe «Ya se cobró en
 * Caja 1». Una tercera que intente abrir lee «Ya hay 2 cajas abiertas: cierra una». Y el corte de
 * cada caja trae sólo lo suyo: el día suma las dos, cada cobro una vez.
 */

/** Siembra, abre cajas y cobra por los comandos de producción: bajo carga, 30 s no alcanzan. */
const POR_COMANDOS = 120_000;

let salon: Salon;
let duenoId = '';
let gerenteId = '';
let sesiones: string[] = [];

const dueno = (): Ambito => ({ ...ambitoDeCaja(salon), rol: 'dueno', empleoId: duenoId });
const gerente = (): Ambito => ({ ...ambitoDeCaja(salon), rol: 'gerente', empleoId: gerenteId });

function regla<T>(resultado: Resultado<T>): {
  readonly regla: string | null;
  readonly mensaje: string;
} {
  if (resultado.ok) return { regla: null, mensaje: '' };
  const datos = resultado.error.datos as { readonly regla?: unknown } | undefined;
  return {
    regla: typeof datos?.regla === 'string' ? datos.regla : resultado.error.codigo,
    mensaje: resultado.error.mensaje,
  };
}

const fijar = (ambito: Ambito, cajas: number) =>
  comando(fijarCajasSimultaneas, { entrada: { cajas }, ambito, idempotencyKey: clave() });

/** Una cuenta pedida en la mesa dada; devuelve la orden y su total. */
async function cuentaPedida(mesa: number): Promise<{ ordenId: string; total: number }> {
  const { ordenId } = await sentarYPedir(salon, mesa, [{ platillo: 'arrachera', cantidad: '1' }]);
  await pedirLaCuenta(salon, ordenId);
  return { ordenId, total: Number((await ordenPersistida(ordenId)).total_centavos) };
}

beforeAll(async () => {
  // Tres terminales dadas de alta, y el cupo que el negocio decida.
  salon = await sembrarSalon({ nombre: 'Restaurante de dos cajas', mesas: 6, terminales: 3 });
  duenoId = await sembrarCompanero(salon.negocio, { nombre: 'Don Poncho', rol: 'dueno' });
  gerenteId = await sembrarCompanero(salon.negocio, { nombre: 'La Gerente', rol: 'gerente' });
}, POR_COMANDOS);

describe('cuántas cajas abiertas a la vez', () => {
  it(
    'sólo el dueño o el administrador lo cambian, entre 1 y 2',
    { timeout: POR_COMANDOS },
    async () => {
      expect(regla(await fijar(gerente(), 2)).regla).not.toBeNull();
      expect((await fijar(dueno(), 3)).ok).toBe(false);
      expect((await fijar(dueno(), 0)).ok).toBe(false);
      exigirOk(await fijar(dueno(), 2), 'caja.fijar_cajas_simultaneas');
      const leido = exigirOk(
        await comando(cajasSimultaneas, {
          entrada: {},
          ambito: gerente(),
          idempotencyKey: clave(),
        }),
        'caja.cajas_simultaneas',
      );
      expect(leido.cajas).toBe(2);
      const fila = await obtenerDb()
        .selectFrom('sucursales')
        .select('cajas_simultaneas')
        .where('id', '=', salon.sucursal.sucursalId)
        .executeTakeFirstOrThrow();
      expect(fila.cajas_simultaneas).toBe(2);
    },
  );

  it(
    'con dos abiertas, la tercera lee «Ya hay 2 cajas abiertas: cierra una»',
    { timeout: POR_COMANDOS },
    async () => {
      sesiones = [
        await abrirCajaReal(ambitoDeCaja(salon, 0)),
        await abrirCajaReal(ambitoDeCaja(salon, 1)),
      ];
      const tercera = await comando(abrirCaja, {
        entrada: { fondoInicialCentavos: 50_000 },
        ambito: ambitoDeCaja(salon, 2),
        idempotencyKey: clave(),
      });
      expect(tercera.ok).toBe(false);
      expect(regla(tercera).mensaje).toBe('Ya hay 2 cajas abiertas: cierra una.');
    },
  );

  it(
    'con dos abiertas no se baja a una: primero se cierra una',
    { timeout: POR_COMANDOS },
    async () => {
      const bajar = await fijar(dueno(), 1);
      expect(bajar.ok).toBe(false);
      expect(regla(bajar).mensaje).toMatch(/cierra una/i);
    },
  );
});

describe('las dos cajas cobran lo mismo, y jamás dos veces', () => {
  it(
    'dos cobros a la vez de la misma cuenta: entra uno, y la otra caja sabe dónde se cobró',
    { timeout: POR_COMANDOS },
    async () => {
      const { ordenId, total } = await cuentaPedida(0);
      const [uno, otro] = await Promise.all([
        cobrarExacto(ambitoDeCaja(salon, 0), ordenId, total),
        cobrarExacto(ambitoDeCaja(salon, 1), ordenId, total),
      ]);
      const exitos = [uno, otro].filter((r) => r.ok);
      expect(exitos).toHaveLength(1);
      const fallo = regla(uno.ok ? otro : uno);
      expect(fallo.regla).toBe('ORDEN_NO_EDITABLE');
      expect(fallo.mensaje).toMatch(/^Ya se cobró en Caja [12]\.$/);
      expect(await sumaDeLosPagos([ordenId])).toBe(BigInt(total));
    },
  );

  it('la que llega después lee en cuál caja se cobró', { timeout: POR_COMANDOS }, async () => {
    const { ordenId, total } = await cuentaPedida(1);
    exigirOk(await cobrarExacto(ambitoDeCaja(salon, 0), ordenId, total), 'venta.cobrar');
    const tarde = regla(await cobrarExacto(ambitoDeCaja(salon, 1), ordenId, total));
    expect(tarde).toEqual({ regla: 'ORDEN_NO_EDITABLE', mensaje: 'Ya se cobró en Caja 1.' });
  });

  it(
    'el corte de cada caja trae sólo lo suyo, y entre las dos cada cobro una vez',
    { timeout: POR_COMANDOS },
    async () => {
      const [sesionUno, sesionDos] = sesiones;
      if (sesionUno === undefined || sesionDos === undefined) throw new Error('Faltan las cajas.');
      const antesUno = await repoCaja.arqueoDeSesion(
        obtenerDb(),
        salon.negocio.organizacionId,
        sesionUno,
      );
      const antesDos = await repoCaja.arqueoDeSesion(
        obtenerDb(),
        salon.negocio.organizacionId,
        sesionDos,
      );

      const a = await cuentaPedida(2);
      const b = await cuentaPedida(3);
      exigirOk(await cobrarExacto(ambitoDeCaja(salon, 0), a.ordenId, a.total), 'cobro en la 1');
      exigirOk(await cobrarExacto(ambitoDeCaja(salon, 1), b.ordenId, b.total), 'cobro en la 2');

      const uno = await repoCaja.arqueoDeSesion(
        obtenerDb(),
        salon.negocio.organizacionId,
        sesionUno,
      );
      const dos = await repoCaja.arqueoDeSesion(
        obtenerDb(),
        salon.negocio.organizacionId,
        sesionDos,
      );
      expect(uno.ventasCentavos - antesUno.ventasCentavos).toBe(BigInt(a.total));
      expect(dos.ventasCentavos - antesDos.ventasCentavos).toBe(BigInt(b.total));
      expect(uno.numeroVentas - antesUno.numeroVentas).toBe(1);
      expect(dos.numeroVentas - antesDos.numeroVentas).toBe(1);
      expect(await sumaDeLosPagos([a.ordenId, b.ordenId])).toBe(BigInt(a.total + b.total));
    },
  );
});
