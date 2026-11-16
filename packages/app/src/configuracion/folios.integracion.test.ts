import type { Ambito } from '@morphiqpos/contracts';
import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { cerrarCaja } from '../caja/sesion.ts';
import { activarOperacion } from '../mantenimiento/operacion-real.ts';
import { dueñoDePlataforma } from '../mantenimiento/pruebas/dia-completo.ts';
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
import { ventaParaDevolver } from '../venta/devolucion-de-venta.ts';
import { fijarFolios } from './folios.ts';

/**
 * DP-21 · Bloque 6 · «PREFIJO DEL FOLIO» y «PRIMER FOLIO», contra Postgres.
 *
 *   · sólo el dueño; un prefijo de 2 a 4 letras A–Z (se guarda en mayúsculas) o ninguno;
 *   · el prefijo se cambia siempre (es de pantalla); el primer folio sólo con los folios en cero,
 *     y al guardarlo el contador queda listo: la PRIMERA cuenta cobrada después sale con ese folio;
 *   · el primer corte cerrado sale con el folio de los cortes, y el consecutivo sigue sin huecos;
 *   · un negocio que ya opera (H1) no cambia su primer folio, aunque no haya cobrado nada todavía;
 *   · cada cambio queda en la auditoría con su antes y su después.
 */

const POR_COMANDOS = 120_000;

let salon: Salon;
let cajera: Ambito;
let gerente: Ambito;
let administrador: Ambito;
let dueno: Ambito;
let plataforma: Ambito;

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Fonda de los Folios', mesas: 4, terminales: 2 });
  const { negocio } = salon;
  const cajeraId = await sembrarCompanero(negocio, { nombre: 'La Cajera', rol: 'cajero' });
  const gerenteId = await sembrarCompanero(negocio, { nombre: 'La Gerente', rol: 'gerente' });
  const adminId = await sembrarCompanero(negocio, { nombre: 'El Admin', rol: 'administrador' });
  const duenoId = await sembrarCompanero(negocio, { nombre: 'Don Poncho', rol: 'dueno' });
  cajera = { ...ambitoDeCaja(salon), rol: 'cajero', empleoId: cajeraId };
  gerente = { ...ambitoDeCaja(salon), rol: 'gerente', empleoId: gerenteId };
  administrador = { ...ambitoDeCaja(salon), rol: 'administrador', empleoId: adminId };
  dueno = { ...ambitoDeCaja(salon), rol: 'dueno', empleoId: duenoId };
  plataforma = await dueñoDePlataforma(salon);
  await abrirLasCajas(salon);
}, POR_COMANDOS);

const org = () => salon.negocio.organizacionId;
const entradaNormal = { prefijo: 'DP', primerFolioDeCuentas: 1001, primerFolioDeCortes: 101 };

const fijar = (
  ambito: Ambito,
  entrada: { prefijo: string | null; primerFolioDeCuentas: number; primerFolioDeCortes: number },
) => comando(fijarFolios, { entrada, ambito, idempotencyKey: clave() });

const contador = async (serie: string) =>
  (
    await obtenerDb()
      .selectFrom('folios')
      .select(['siguiente', 'sucursal_id'])
      .where('organizacion_id', '=', org())
      .where('serie', '=', serie)
      .execute()
  ).map((f) => f.siguiente);

/** Sienta, pide y cobra una arrachera: devuelve la serie y el folio que quedaron en la cuenta. */
async function cobrarUnaCuenta(mesa: number) {
  const { ordenId } = await sentarYPedir(salon, mesa, [{ platillo: 'arrachera', cantidad: '1' }]);
  exigirOk(await cobrarExacto(ambitoDeCaja(salon), ordenId, ARRACHERA_CENTAVOS), 'cobrar');
  return obtenerDb()
    .selectFrom('ordenes')
    .select(['serie', 'folio'])
    .where('id', '=', ordenId)
    .executeTakeFirstOrThrow();
}

describe('configuracion.fijar_folios · quién y qué', () => {
  it('sólo el dueño: la cajera, la gerente y el administrador no', async () => {
    for (const quien of [cajera, gerente, administrador]) {
      expect((await fijar(quien, entradaNormal)).ok).toBe(false);
    }
    expect(await contador('A')).toEqual([]);
  });

  it('un prefijo que no es de 2 a 4 letras A–Z se rechaza, y un primer folio fuera de rango también', async () => {
    for (const prefijo of ['D', 'DPPPP', 'D1', 'DÑ', 'DÁ', 'D P']) {
      expect((await fijar(dueno, { ...entradaNormal, prefijo })).ok, prefijo).toBe(false);
    }
    for (const primero of [0, -1, 1.5, 100_000_000]) {
      expect((await fijar(dueno, { ...entradaNormal, primerFolioDeCuentas: primero })).ok).toBe(
        false,
      );
    }
    const fila = await obtenerDb()
      .selectFrom('configuracion')
      .select('valores')
      .where('organizacion_id', '=', org())
      .executeTakeFirst();
    expect((fila?.valores as { folios?: unknown } | undefined)?.folios).toBeUndefined();
  });

  it('un negocio que nunca lo tocó lee sus folios como siempre: sin prefijo y desde 1', async () => {
    const configuracion = await leerConfiguracion(org());
    expect(configuracion['folios']).toEqual({
      prefijo: null,
      primerFolioDeCuentas: 1,
      primerFolioDeCortes: 1,
    });
  });

  it('el camino genérico de la Configuración no lo escribe: tiene su comando', async () => {
    const intento = conTransaccion((tx) =>
      guardarConfiguracionParcial(tx, org(), { folios: { prefijo: 'XX' } }),
    );
    await expect(intento).rejects.toThrow(/tiene su propio comando/);
    const otro = conTransaccion((tx) =>
      guardarConfiguracionParcial(tx, org(), { operacion_desde: '2026-01-01T00:00:00.000Z' }),
    );
    await expect(otro).rejects.toThrow(/tiene su propio comando/);
  });
});

describe('el primer folio, con los folios en cero', () => {
  it(
    'el contador queda listo: la primera cuenta es la 1001 y el primer corte el 101, sin huecos',
    { timeout: POR_COMANDOS },
    async () => {
      const guardado = exigirOk(await fijar(dueno, { ...entradaNormal, prefijo: 'dp' }), 'fijar');
      expect(guardado).toEqual(entradaNormal);
      expect(await contador('A')).toEqual([1001n]);
      expect(await contador('CC')).toEqual([101n]);

      const primera = await cobrarUnaCuenta(0);
      const segunda = await cobrarUnaCuenta(1);
      expect([primera.serie, primera.folio]).toEqual(['A', 1001n]);
      expect([segunda.serie, segunda.folio]).toEqual(['A', 1002n]);

      // La segunda terminal no vendió nada: se cierra con el fondo y recibe el primer corte.
      const cierre = exigirOk(
        await comando(cerrarCaja, {
          entrada: { efectivoContadoCentavos: 50_000 },
          ambito: ambitoDeCaja(salon, 1),
          idempotencyKey: clave(),
        }),
        'cerrar caja',
      );
      expect(`${cierre.serie}-${cierre.folio}`).toBe('CC-101');
    },
  );

  it('lo que ve la Configuración: el prefijo en mayúsculas y los dos primeros folios', async () => {
    expect((await leerConfiguracion(org()))['folios']).toEqual(entradaNormal);
  });

  it('con folios ya dados, el primer folio ya no se cambia y el contador no se mueve', async () => {
    const antes = await contador('A');
    for (const cambio of [
      { ...entradaNormal, primerFolioDeCuentas: 5001 },
      { ...entradaNormal, primerFolioDeCortes: 201 },
    ]) {
      const r = await fijar(dueno, cambio);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.mensaje).toMatch(/folios en cero/);
    }
    expect(await contador('A')).toEqual(antes);
    expect(await contador('CC')).toEqual([102n]);
  });

  it('el prefijo se cambia aunque haya folios, y quitarlo devuelve el folio de siempre', async () => {
    exigirOk(await fijar(dueno, { ...entradaNormal, prefijo: 'DPON' }), 'prefijo nuevo');
    exigirOk(await fijar(dueno, { ...entradaNormal, prefijo: null }), 'sin prefijo');
    expect((await leerConfiguracion(org()))['folios']).toEqual({ ...entradaNormal, prefijo: null });
    exigirOk(await fijar(dueno, entradaNormal), 'otra vez DP');
    // El consecutivo ni se enteró.
    expect(await contador('A')).toEqual([1003n]);
  });

  it('cada cambio queda en la auditoría con su antes y su después', async () => {
    const filas = await obtenerDb()
      .selectFrom('auditoria')
      .select('payload')
      .where('organizacion_id', '=', org())
      .where('accion', '=', 'configuracion.fijar_folios')
      .orderBy('id')
      .execute();
    const cambios = filas
      .map((f) => f.payload as { antes?: unknown; despues?: unknown })
      .filter((p) => p.despues !== undefined)
      .map(({ antes, despues }) => ({ antes, despues }));
    expect(cambios[0]).toEqual({
      antes: { prefijo: null, primerFolioDeCuentas: 1, primerFolioDeCortes: 1 },
      despues: entradaNormal,
    });
    expect(cambios.at(-1)).toEqual({
      antes: { ...entradaNormal, prefijo: null },
      despues: entradaNormal,
    });
  });
});

describe('buscar la cuenta por lo que dice el ticket', () => {
  it('«1001», «01001», «DP-01001» y «A-1001» devuelven la misma cuenta; otro prefijo, no', async () => {
    const ver = (folio: string) =>
      comando(ventaParaDevolver, {
        entrada: { folio },
        ambito: gerente,
        idempotencyKey: clave(),
      });
    for (const texto of ['1001', '01001', 'DP-01001', 'dp01001', 'A-1001']) {
      const r = exigirOk(await ver(texto), texto);
      expect([r.serie, r.folio]).toEqual(['A', '1001']);
    }
    expect((await ver('XX-01001')).ok).toBe(false);
    expect((await ver('DP-09999')).ok).toBe(false);
  });
});

describe('H1 · el negocio que ya opera no cambia su primer folio', () => {
  it(
    'con una sola cuenta posterior al arranque, aunque no tenga folio, se niega; el prefijo no',
    { timeout: POR_COMANDOS },
    async () => {
      exigirOk(
        await comando(activarOperacion, {
          entrada: {},
          ambito: plataforma,
          idempotencyKey: clave(),
        }),
        'activar',
      );
      await sentarYPedir(salon, 2, [{ platillo: 'arrachera', cantidad: '1' }]);
      const r = await fijar(dueno, { ...entradaNormal, primerFolioDeCuentas: 5001 });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.mensaje).toMatch(/ya opera desde el .*1 cuenta real.*ya no se borra/);
      }
      exigirOk(await fijar(dueno, { ...entradaNormal, prefijo: 'DPC' }), 'prefijo con H1');
    },
  );
});
