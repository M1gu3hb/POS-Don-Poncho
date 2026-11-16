import type { Ambito } from '@morphiqpos/contracts';
import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { guardarConfiguracionParcial, leerConfiguracion } from '../puente/configuracion.ts';
import {
  ARRACHERA_CENTAVOS,
  abrirLasCajas,
  ambitoDeCaja,
  cobrarExacto,
  sembrarSalon,
  sentarYPedir,
  type Salon,
} from '../restaurante/pruebas/salon-real.ts';
import { fijarImpuesto } from './impuesto.ts';

/**
 * DP-21 · Bloque 1 · EL IVA, contra Postgres.
 *
 * Lo que vio Miguel: con el IVA «en cero» en la pantalla, los tickets decían «IVA incluido». La
 * pantalla guardaba `iva_porcentaje`, que nadie leía, y el servidor cobraba con la tasa por
 * omisión (16 % incluido). Aquí se afirma, con cuentas cobradas de verdad:
 *
 *   · un negocio nuevo sigue en 16 % incluido (no cambia nada en los demás negocios);
 *   · «Sin IVA» deja `impuestos_centavos = 0` y el total igual a los renglones;
 *   · 16 % que se suma engorda el total; 16 % incluido, no;
 *   · lo guardan sólo el dueño y el administrador, por SU comando y con antes y después;
 *   · `iva_porcentaje` ya no sale ni entra, ni siquiera por el portal.
 */

const POR_COMANDOS = 120_000;
/** 32,990 × 1600 / 11600 = 4,550.34… → el IVA que YA va dentro del precio. */
const IVA_INCLUIDO_DE_LA_ARRACHERA = 4_550;
/** 32,990 × 16 % = 5,278.4 → el IVA que se suma encima. */
const IVA_SUMADO_DE_LA_ARRACHERA = 5_278;

let salon: Salon;
let cajera: Ambito;
let gerente: Ambito;
let administrador: Ambito;
let dueno: Ambito;

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Fonda del IVA', mesas: 4, terminales: 1 });
  const { negocio } = salon;
  const cajeraId = await sembrarCompanero(negocio, { nombre: 'La Cajera', rol: 'cajero' });
  const gerenteId = await sembrarCompanero(negocio, { nombre: 'La Gerente', rol: 'gerente' });
  const adminId = await sembrarCompanero(negocio, { nombre: 'El Admin', rol: 'administrador' });
  const duenoId = await sembrarCompanero(negocio, { nombre: 'Don Poncho', rol: 'dueno' });
  cajera = { ...ambitoDeCaja(salon), rol: 'cajero', empleoId: cajeraId };
  gerente = { ...ambitoDeCaja(salon), rol: 'gerente', empleoId: gerenteId };
  administrador = { ...ambitoDeCaja(salon), rol: 'administrador', empleoId: adminId };
  dueno = { ...ambitoDeCaja(salon), rol: 'dueno', empleoId: duenoId };
  await abrirLasCajas(salon);
}, POR_COMANDOS);

const fijar = (ambito: Ambito, entrada: { puntosBase: number; incluidoEnPrecio: boolean }) =>
  comando(fijarImpuesto, { entrada, ambito, idempotencyKey: clave() });

/** Sienta la mesa, pide una arrachera, la cobra por `totalCentavos` y devuelve lo que quedó. */
async function cobrarUnaArrachera(mesa: number, totalCentavos: number) {
  const { ordenId } = await sentarYPedir(salon, mesa, [{ platillo: 'arrachera', cantidad: '1' }]);
  exigirOk(await cobrarExacto(ambitoDeCaja(salon), ordenId, totalCentavos), 'cobrar');
  return obtenerDb()
    .selectFrom('ordenes')
    .select(['estado', 'subtotal_centavos', 'impuestos_centavos', 'total_centavos'])
    .where('id', '=', ordenId)
    .executeTakeFirstOrThrow();
}

describe('configuracion.fijar_impuesto', () => {
  it(
    'un negocio que nunca lo tocó cobra 16 % incluido: el total no cambia y el IVA va dentro',
    { timeout: POR_COMANDOS },
    async () => {
      const cuenta = await cobrarUnaArrachera(0, ARRACHERA_CENTAVOS);
      expect(cuenta.estado).toBe('pagada');
      expect(Number(cuenta.total_centavos)).toBe(ARRACHERA_CENTAVOS);
      expect(Number(cuenta.impuestos_centavos)).toBe(IVA_INCLUIDO_DE_LA_ARRACHERA);
    },
  );

  it(
    'sólo el dueño o el administrador, y sólo sin IVA, 8 % o 16 %',
    { timeout: POR_COMANDOS },
    async () => {
      const sinIva = { puntosBase: 0, incluidoEnPrecio: true };
      expect((await fijar(cajera, sinIva)).ok).toBe(false);
      expect((await fijar(gerente, sinIva)).ok).toBe(false);
      expect((await fijar(dueno, { puntosBase: 1500, incluidoEnPrecio: true })).ok).toBe(false);
      expect((await fijar(dueno, { puntosBase: 16, incluidoEnPrecio: true })).ok).toBe(false);
      // Nada de lo negado dejó huella: sigue sin impuesto guardado (un negocio nuevo ni siquiera
      // tiene documento de configuración).
      const fila = await obtenerDb()
        .selectFrom('configuracion')
        .select('valores')
        .where('organizacion_id', '=', salon.negocio.organizacionId)
        .executeTakeFirst();
      expect((fila?.valores as { impuesto?: unknown } | undefined)?.impuesto).toBeUndefined();
    },
  );

  it(
    '«Sin IVA»: la cuenta queda con impuestos en 0 y el total son los renglones',
    { timeout: POR_COMANDOS },
    async () => {
      const guardado = exigirOk(
        await fijar(administrador, { puntosBase: 0, incluidoEnPrecio: false }),
        'fijar sin IVA',
      );
      // Sin IVA no hay nada que incluir ni que sumar: se guarda siempre como «incluido».
      expect(guardado).toEqual({ puntosBase: 0, incluidoEnPrecio: true });

      const cuenta = await cobrarUnaArrachera(1, ARRACHERA_CENTAVOS);
      expect(Number(cuenta.impuestos_centavos)).toBe(0);
      expect(Number(cuenta.total_centavos)).toBe(ARRACHERA_CENTAVOS);
      expect(Number(cuenta.subtotal_centavos)).toBe(ARRACHERA_CENTAVOS);
    },
  );

  it(
    '16 % que se suma: el total crece el 16 %; con «ya incluido», vuelve al precio de la carta',
    { timeout: POR_COMANDOS },
    async () => {
      exigirOk(await fijar(dueno, { puntosBase: 1600, incluidoEnPrecio: false }), 'fijar sumado');
      const sumado = await cobrarUnaArrachera(2, ARRACHERA_CENTAVOS + IVA_SUMADO_DE_LA_ARRACHERA);
      expect(Number(sumado.impuestos_centavos)).toBe(IVA_SUMADO_DE_LA_ARRACHERA);
      expect(Number(sumado.total_centavos)).toBe(ARRACHERA_CENTAVOS + IVA_SUMADO_DE_LA_ARRACHERA);

      exigirOk(await fijar(dueno, { puntosBase: 1600, incluidoEnPrecio: true }), 'fijar incluido');
      const incluido = await cobrarUnaArrachera(3, ARRACHERA_CENTAVOS);
      expect(Number(incluido.impuestos_centavos)).toBe(IVA_INCLUIDO_DE_LA_ARRACHERA);
      expect(Number(incluido.total_centavos)).toBe(ARRACHERA_CENTAVOS);
    },
  );

  it('cada cambio queda en la auditoría con su antes y su después', async () => {
    const filas = await obtenerDb()
      .selectFrom('auditoria')
      .select('payload')
      .where('organizacion_id', '=', salon.negocio.organizacionId)
      .where('accion', '=', 'configuracion.fijar_impuesto')
      .orderBy('id')
      .execute();
    // El rastro lleva más cosas (versión, quién, cuándo): aquí importan el antes y el después.
    const cambios = filas
      .map((f) => f.payload as { antes?: unknown; despues?: unknown })
      .filter((p) => p.despues !== undefined)
      .map(({ antes, despues }) => ({ antes, despues }));
    expect(cambios).toEqual([
      {
        antes: { puntosBase: 1600, incluidoEnPrecio: true },
        despues: { puntosBase: 0, incluidoEnPrecio: true },
      },
      {
        antes: { puntosBase: 0, incluidoEnPrecio: true },
        despues: { puntosBase: 1600, incluidoEnPrecio: false },
      },
      {
        antes: { puntosBase: 1600, incluidoEnPrecio: false },
        despues: { puntosBase: 1600, incluidoEnPrecio: true },
      },
    ]);
  });
});

describe('lo que ven las pantallas', () => {
  it('la Configuración lee `impuesto`, ya completo; `iva_porcentaje` no sale', async () => {
    const configuracion = await leerConfiguracion(salon.negocio.organizacionId);
    expect(configuracion['impuesto']).toEqual({ puntosBase: 1600, incluidoEnPrecio: true });
    expect('iva_porcentaje' in configuracion).toBe(false);
  });

  it('el portal del comensal no recibe ni `iva_porcentaje` ni la regla del impuesto', async () => {
    const publica = await leerConfiguracion(salon.negocio.organizacionId, { publica: true });
    expect('iva_porcentaje' in publica).toBe(false);
    expect('impuesto' in publica).toBe(false);
  });

  it('por el camino genérico el impuesto no se escribe: tiene su comando', async () => {
    const intento = conTransaccion((tx) =>
      guardarConfiguracionParcial(tx, salon.negocio.organizacionId, {
        impuesto: { puntosBase: 0, incluidoEnPrecio: true },
      }),
    );
    await expect(intento).rejects.toThrow(/tiene su propio comando/);
  });

  it('un `iva_porcentaje` que llega de una pantalla vieja se ignora: ni falla ni se guarda', async () => {
    await conTransaccion((tx) =>
      guardarConfiguracionParcial(tx, salon.negocio.organizacionId, {
        iva_porcentaje: 0,
        mensaje_ticket: 'Gracias por venir',
      }),
    );
    const { valores } = await obtenerDb()
      .selectFrom('configuracion')
      .select('valores')
      .where('organizacion_id', '=', salon.negocio.organizacionId)
      .executeTakeFirstOrThrow();
    const guardados = valores as Record<string, unknown>;
    expect(guardados['mensaje_ticket']).toBe('Gracias por venir');
    expect('iva_porcentaje' in guardados).toBe(false);
    // Y el impuesto sigue siendo el que dejó el dueño.
    expect(guardados['impuesto']).toEqual({ puntosBase: 1600, incluidoEnPrecio: true });
  });
});
