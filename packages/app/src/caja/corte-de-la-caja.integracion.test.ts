import type { Ambito } from '@morphiqpos/contracts';
import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { abrirCajaReal, clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { guardarConfiguracionParcial, leerConfiguracion } from '../puente/configuracion.ts';
import { ambitoDeCaja, sembrarSalon, type Salon } from '../restaurante/pruebas/salon-real.ts';
import { hojaDelCorte } from './corte/documento.ts';
import { fijarAjustesDelCorte } from './corte-de-la-caja.ts';

/**
 * DP-21 · Bloque 20 · COSTOS AL CAJERO, COMISIÓN DE LA TERMINAL Y RFC, contra Postgres.
 *
 *   · «costos al cajero» y «comisión» los fija sólo el dueño o el administrador, por su comando y
 *     con su auditoría; el camino genérico de la configuración los rechaza (también al gerente);
 *   · cambiar «costos al cajero» cambia lo que el cajero ve en su corte (`verCostos`);
 *   · la comisión llega al corte (`negocio.comisionTerminalBp`) y el RFC también (`negocio.rfc`);
 *   · el RFC se valida al guardar (12 o 13 caracteres, mayúsculas).
 */

const POR_COMANDOS = 120_000;

let salon: Salon;
let cajero: Ambito;
let gerente: Ambito;
let administrador: Ambito;
let dueno: Ambito;
let sesionCajaId = '';

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Fonda del Corte', mesas: 1, terminales: 1 });
  const { negocio } = salon;
  const ids = {
    cajero: await sembrarCompanero(negocio, { nombre: 'La Cajera', rol: 'cajero' }),
    gerente: await sembrarCompanero(negocio, { nombre: 'La Gerente', rol: 'gerente' }),
    admin: await sembrarCompanero(negocio, { nombre: 'El Admin', rol: 'administrador' }),
    dueno: await sembrarCompanero(negocio, { nombre: 'Don Poncho', rol: 'dueno' }),
  };
  cajero = { ...ambitoDeCaja(salon), rol: 'cajero', empleoId: ids.cajero };
  gerente = { ...ambitoDeCaja(salon), rol: 'gerente', empleoId: ids.gerente };
  administrador = { ...ambitoDeCaja(salon), rol: 'administrador', empleoId: ids.admin };
  dueno = { ...ambitoDeCaja(salon), rol: 'dueno', empleoId: ids.dueno };
  sesionCajaId = await abrirCajaReal(cajero, 50_000);
}, POR_COMANDOS);

const fijar = (ambito: Ambito, entrada: unknown) =>
  comando(fijarAjustesDelCorte, {
    entrada: entrada,
    ambito,
    idempotencyKey: clave(),
  });

const hoja = async (ambito: Ambito) =>
  exigirOk(
    await comando(hojaDelCorte, {
      entrada: { sesionCajaId },
      ambito,
      idempotencyKey: clave(),
    }),
    'caja.hoja_del_corte',
  );

const guardado = async () => {
  const fila = await obtenerDb()
    .selectFrom('configuracion')
    .select('valores')
    .where('organizacion_id', '=', salon.negocio.organizacionId)
    .executeTakeFirst();
  return (fila?.valores ?? {}) as Record<string, unknown>;
};

describe('caja.fijar_ajustes_del_corte', () => {
  it('por omisión el cajero NO ve costos y no hay tasa', { timeout: POR_COMANDOS }, async () => {
    const delCajero = await hoja(cajero);
    expect(delCajero.verCostos).toBe(false);
    expect(delCajero.negocio.comisionTerminalBp).toBeNull();
    // El dueño sí los ve, con o sin el interruptor.
    expect((await hoja(dueno)).verCostos).toBe(true);
  });

  it(
    'sólo el dueño o el administrador; la cajera y la gerente no, y no dejan huella',
    { timeout: POR_COMANDOS },
    async () => {
      const entrada = { mostrarCostosACaja: true, comisionTerminalBp: 360 };
      expect((await fijar(cajero, entrada)).ok).toBe(false);
      expect((await fijar(gerente, entrada)).ok).toBe(false);
      expect((await guardado())['mostrar_costos_a_caja']).toBeUndefined();
    },
  );

  it('lo que no es una tasa no se guarda', { timeout: POR_COMANDOS }, async () => {
    for (const mala of [1_001, -1, 3.6, '360']) {
      expect(
        (await fijar(dueno, { mostrarCostosACaja: false, comisionTerminalBp: mala })).ok,
        String(mala),
      ).toBe(false);
    }
    expect((await guardado())['comision_terminal_bp']).toBeUndefined();
  });

  it(
    'el administrador lo enciende: el cajero ve costos y el corte trae la tasa',
    { timeout: POR_COMANDOS },
    async () => {
      const devuelto = exigirOk(
        await fijar(administrador, { mostrarCostosACaja: true, comisionTerminalBp: 360 }),
        'fijar',
      );
      expect(devuelto).toEqual({ mostrarCostosACaja: true, comisionTerminalBp: 360 });
      const delCajero = await hoja(cajero);
      expect(delCajero.verCostos).toBe(true);
      expect(delCajero.insumos).not.toBeNull();
      expect(delCajero.negocio.comisionTerminalBp).toBe(360);
    },
  );

  it('apagarlo vuelve a esconder los costos al cajero', { timeout: POR_COMANDOS }, async () => {
    exigirOk(await fijar(dueno, { mostrarCostosACaja: false, comisionTerminalBp: null }), 'fijar');
    const delCajero = await hoja(cajero);
    expect(delCajero.verCostos).toBe(false);
    expect(delCajero.insumos).toBeNull();
    expect(delCajero.resumen.costoCentavos).toBeNull();
    expect(delCajero.negocio.comisionTerminalBp).toBeNull();
  });

  it('cada cambio queda con su antes y su después', async () => {
    const filas = await obtenerDb()
      .selectFrom('auditoria')
      .select('payload')
      .where('organizacion_id', '=', salon.negocio.organizacionId)
      .where('accion', '=', 'caja.fijar_ajustes_del_corte')
      .orderBy('id')
      .execute();
    const cambios = filas
      .map((f) => f.payload as { antes?: unknown; despues?: unknown })
      .filter((p) => p.despues !== undefined)
      .map(({ antes, despues }) => ({ antes, despues }));
    expect(cambios).toEqual([
      {
        antes: { mostrarCostosACaja: false, comisionTerminalBp: null },
        despues: { mostrarCostosACaja: true, comisionTerminalBp: 360 },
      },
      {
        antes: { mostrarCostosACaja: true, comisionTerminalBp: 360 },
        despues: { mostrarCostosACaja: false, comisionTerminalBp: null },
      },
    ]);
  });

  it('por el camino genérico no se escriben: tienen su comando', async () => {
    for (const parche of [{ mostrar_costos_a_caja: true }, { comision_terminal_bp: 360 }]) {
      const intento = conTransaccion((tx) =>
        guardarConfiguracionParcial(tx, salon.negocio.organizacionId, parche),
      );
      await expect(intento).rejects.toThrow(/tiene su propio comando/);
    }
  });

  it('la Configuración los lee completos', async () => {
    const configuracion = await leerConfiguracion(salon.negocio.organizacionId);
    expect(configuracion['mostrar_costos_a_caja']).toBe(false);
    expect(configuracion['comision_terminal_bp']).toBeNull();
  });
});

describe('el RFC del negocio', () => {
  it(
    'uno con la forma de RFC se guarda y el corte lo imprime',
    { timeout: POR_COMANDOS },
    async () => {
      await conTransaccion((tx) =>
        guardarConfiguracionParcial(tx, salon.negocio.organizacionId, { rfc: 'ABC850101AB1' }),
      );
      expect((await guardado())['rfc']).toBe('ABC850101AB1');
      expect((await hoja(dueno)).negocio.rfc).toBe('ABC850101AB1');
    },
  );

  it('uno con otra forma no se guarda, y no pisa el anterior', async () => {
    for (const malo of ['abc850101ab1', 'ABC850101', 'ABC850101AB1XX']) {
      const intento = conTransaccion((tx) =>
        guardarConfiguracionParcial(tx, salon.negocio.organizacionId, { rfc: malo }),
      );
      await expect(intento).rejects.toThrow(/RFC/);
    }
    expect((await guardado())['rfc']).toBe('ABC850101AB1');
  });
});
