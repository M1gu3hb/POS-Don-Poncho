import type { Ambito, Rol } from '@morphiqpos/contracts';
import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import {
  abrirLasCajas,
  ambitoDeCaja,
  sembrarSalon,
  type Salon,
} from '../restaurante/pruebas/salon-real.ts';
import { guardarPlantillaCompra, registrarCompra, usarPlantillaCompra } from './index.ts';

/**
 * A5 · EL PUESTO DE ALMACÉN REGISTRA COMPRAS, contra Postgres.
 *
 * El permiso se revisa en el servidor, por puesto:
 *   · el almacén registra una compra con proveedor que entra al almacén, con su costo;
 *   · pagarla del cajón (efectivo) sigue siendo de quien lleva la caja: el almacén la registra por
 *     transferencia o tarjeta, y en efectivo se le dice qué hacer, sin escribir nada;
 *   · mesero, cocina y cajero no registran compras (ni repiten ni guardan plantillas).
 */

const POR_COMANDOS = 120_000;
const COSTO = '300.00';
const SIN_PERMISO = ['mesero', 'cocina', 'cajero'] as const;

let salon: Salon;
let almacen: Ambito;
let dueno: Ambito;
const ambitoDe = new Map<Rol, Ambito>();
let insumoId = '';

const linea = (nombre: string) => ({
  nuevo: { nombre, unidadBase: 'pieza' as const },
  cantidadCapturada: '100',
  unidadCapturada: 'pieza',
  equivalencia: '1',
  costoTotal: COSTO,
});

type Metodo = 'efectivo' | 'tarjeta' | 'transferencia';

const comprar = (ambito: Ambito, metodoPago: Metodo, nombre = 'Servilletas') =>
  comando(registrarCompra, {
    entrada: { proveedorNombre: 'Don Beto', metodoPago, lineas: [linea(nombre)] },
    ambito,
    idempotencyKey: clave(),
  });

const contarCompras = async (): Promise<number> => {
  const filas = await obtenerDb()
    .selectFrom('compras')
    .select('id')
    .where('organizacion_id', '=', salon.negocio.organizacionId)
    .execute();
  return filas.length;
};

const salidasDelCajon = async (): Promise<number> => {
  const filas = await obtenerDb()
    .selectFrom('movimientos_caja')
    .select('id')
    .where('organizacion_id', '=', salon.negocio.organizacionId)
    .where('tipo', '=', 'gasto')
    .execute();
  return filas.length;
};

const ambitoDelPuesto = (puesto: Rol): Ambito => {
  const ambito = ambitoDe.get(puesto);
  if (ambito === undefined) throw new Error(`Falta el puesto ${puesto}.`);
  return ambito;
};

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Fonda del Almacén', mesas: 1, terminales: 1 });
  const base = ambitoDeCaja(salon);
  const empleo = async (nombre: string, rol: Rol): Promise<Ambito> => ({
    ...base,
    rol,
    empleoId: await sembrarCompanero(salon.negocio, { nombre, rol }),
  });
  almacen = await empleo('Nacho', 'almacen');
  dueno = await empleo('Don Poncho', 'dueno');
  for (const rol of SIN_PERMISO) ambitoDe.set(rol, await empleo(`Alguien ${rol}`, rol));
  await abrirLasCajas(salon);
}, POR_COMANDOS);

describe('compras.registrar por puesto', () => {
  it(
    'el almacén registra una compra con proveedor: entra al almacén, con su costo y su nombre',
    { timeout: POR_COMANDOS },
    async () => {
      const compra = exigirOk(await comprar(almacen, 'transferencia'), 'compras.registrar');
      expect(compra).toMatchObject({ totalCentavos: '30000', lineas: 1 });

      const db = obtenerDb();
      const fila = await db
        .selectFrom('compras')
        .select(['proveedor_nombre', 'metodo_pago', 'empleado_id'])
        .where('id', '=', compra.compraId)
        .executeTakeFirstOrThrow();
      expect(fila).toMatchObject({
        proveedor_nombre: 'Don Beto',
        metodo_pago: 'transferencia',
        empleado_id: almacen.empleoId,
      });

      const entrada = await db
        .selectFrom('movimientos_stock')
        .select(['insumo_id', 'cantidad', 'tipo', 'costo_unitario_centavos'])
        .where('referencia_id', '=', compra.compraId)
        .executeTakeFirstOrThrow();
      expect(entrada.tipo).toBe('entrada_compra');
      expect(Number(entrada.cantidad)).toBe(100);
      expect(Number(entrada.costo_unitario_centavos)).toBe(300);
      insumoId = entrada.insumo_id;

      const existencia = await db
        .selectFrom('existencias')
        .select('cantidad')
        .where('insumo_id', '=', insumoId)
        .executeTakeFirstOrThrow();
      expect(Number(existencia.cantidad)).toBe(100);
    },
  );

  it('el almacén también puede pagar con tarjeta', { timeout: POR_COMANDOS }, async () => {
    exigirOk(await comprar(almacen, 'tarjeta', 'Popotes'), 'compras.registrar');
  });

  it(
    'pagar del cajón es de quien lleva la caja: en efectivo el almacén no registra nada, y se le dice qué hacer',
    { timeout: POR_COMANDOS },
    async () => {
      const antes = { compras: await contarCompras(), cajon: await salidasDelCajon() };
      const salida = await comprar(almacen, 'efectivo', 'Vasos');
      expect(salida.ok).toBe(false);
      if (salida.ok) return;
      expect(salida.error.mensaje).toContain('efectivo');
      expect(salida.error.mensaje).toContain('transferencia o tarjeta');
      expect({ compras: await contarCompras(), cajon: await salidasDelCajon() }).toEqual(antes);
    },
  );

  it(
    'quien tiene caja (el dueño) sigue pagando en efectivo y sale del cajón',
    { timeout: POR_COMANDOS },
    async () => {
      const antes = await salidasDelCajon();
      exigirOk(await comprar(dueno, 'efectivo', 'Mantequilla'), 'compras.registrar');
      expect(await salidasDelCajon()).toBe(antes + 1);
    },
  );

  it.each(SIN_PERMISO)(
    'el %s no registra compras: SIN_PERMISO y no se escribe nada',
    { timeout: POR_COMANDOS },
    async (puesto) => {
      const antes = await contarCompras();
      const salida = await comprar(ambitoDelPuesto(puesto), 'transferencia', `Nada ${puesto}`);
      expect(salida.ok).toBe(false);
      if (salida.ok) return;
      expect(salida.error.codigo).toBe('SIN_PERMISO');
      expect(await contarCompras()).toBe(antes);
    },
  );
});

describe('las plantillas de compra', () => {
  const plantilla = (nombre: string) => ({
    nombre,
    proveedorNombre: 'Don Beto',
    lineas: [
      { insumoId, cantidad: '100', unidadCompra: 'pieza', equivalencia: '1', costoTotal: COSTO },
    ],
  });
  let plantillaId = '';

  it('el almacén guarda una plantilla de lo que compra', { timeout: POR_COMANDOS }, async () => {
    const guardada = exigirOk(
      await comando(guardarPlantillaCompra, {
        entrada: plantilla('Servilletas de la semana'),
        ambito: almacen,
        idempotencyKey: clave(),
      }),
      'compras.guardar_plantilla',
    );
    plantillaId = guardada.plantillaId;
  });

  it(
    'el almacén la repite por transferencia; en efectivo no',
    { timeout: POR_COMANDOS },
    async () => {
      exigirOk(
        await comando(usarPlantillaCompra, {
          entrada: { plantillaId, metodoPago: 'transferencia' },
          ambito: almacen,
          idempotencyKey: clave(),
        }),
        'compras.usar_plantilla',
      );
      const antes = { compras: await contarCompras(), cajon: await salidasDelCajon() };
      const salida = await comando(usarPlantillaCompra, {
        entrada: { plantillaId, metodoPago: 'efectivo' },
        ambito: almacen,
        idempotencyKey: clave(),
      });
      expect(salida.ok).toBe(false);
      expect({ compras: await contarCompras(), cajon: await salidasDelCajon() }).toEqual(antes);
    },
  );

  it.each(SIN_PERMISO)(
    'el %s no guarda ni repite plantillas',
    { timeout: POR_COMANDOS },
    async (puesto) => {
      const ambito = ambitoDelPuesto(puesto);
      const guardar = await comando(guardarPlantillaCompra, {
        entrada: plantilla(`De ${puesto}`),
        ambito,
        idempotencyKey: clave(),
      });
      const repetir = await comando(usarPlantillaCompra, {
        entrada: { plantillaId, metodoPago: 'transferencia' },
        ambito,
        idempotencyKey: clave(),
      });
      for (const salida of [guardar, repetir]) {
        expect(salida.ok).toBe(false);
        if (!salida.ok) expect(salida.error.codigo).toBe('SIN_PERMISO');
      }
    },
  );
});
