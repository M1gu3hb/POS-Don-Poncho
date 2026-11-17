import type { Ambito, Rol } from '@morphiqpos/contracts';
import { obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { ambitoDeCaja, sembrarSalon, type Salon } from '../restaurante/pruebas/salon-real.ts';
import { resumenDelPeriodo } from './resumen-del-periodo.ts';

/**
 * H3 · REGISTROS, «ESTE AÑO»: EL RESUMEN SALE DEL SERVIDOR, SIN TOPE, contra Postgres.
 *
 * El puente no devuelve más de 1 000 filas por petición y Registros sumaba las que bajaba: con un
 * periodo grande el resumen era una suma parcial. Aquí hay MÁS filas que el tope (1 165 cuentas
 * cobradas, 1 100 compras y 1 100 gastos dentro del periodo) y el agregado del servidor coincide al
 * centavo con dos cuentas hechas por fuera de la implementación: una suma en SQL con instantes
 * explícitos y la misma suma en la prueba.
 *
 * El día es el del NEGOCIO (America/Mexico_City, sin horario de verano desde 2022: UTC-6): una cuenta
 * de las 23:59 del último día cuenta; la de las 00:00 del siguiente, no.
 */

const POR_COMANDOS = 180_000;
const TOPE_DEL_PUENTE = 1_000;

/** El periodo pedido: del 2 al 6 de marzo. */
const DESDE = '2026-03-02';
const HASTA = '2026-03-06';

/** Medianoche de México = 06:00 UTC (sin horario de verano desde 2022). */
const medianocheDe = (diaDeMarzo: number): number => Date.UTC(2026, 2, diaDeMarzo, 6, 0, 0);

/** La cuenta g cierra a las 20:00 UTC del 1 de marzo más g · 5 minutos. */
const BASE_UTC = Date.UTC(2026, 2, 1, 20, 0, 0);
const MINUTOS_ENTRE_CUENTAS = 5;
const CUENTAS = 1_800;

const totalDe = (g: number): number => 1_000 + ((g * 37) % 9_000);
const costoDe = (g: number): number => Math.floor((totalDe(g) * 3) / 10);
const cierreDe = (g: number): number => BASE_UTC + g * MINUTOS_ENTRE_CUENTAS * 60_000;
const propinaDe = (g: number): number => 100 + (g % 13) * 50;
const compraDe = (g: number): number => 300 + ((g * 11) % 4_000);
const gastoDe = (g: number): number => 500 + ((g * 13) % 900);
const DIAS_DE_COMPRAS = 8;
const FILAS_DE_COMPRAS = 1_800;

/** El día de marzo (1 a 8) de la compra y del gasto g. */
const diaDeCompra = (g: number): number => 1 + (g % DIAS_DE_COMPRAS);

const EN_EL_BORDE_DENTRO = { folio: 5_000, total: 777, cierre: Date.UTC(2026, 2, 7, 5, 59, 0) };
const EN_EL_BORDE_FUERA = { folio: 5_001, total: 888, cierre: Date.UTC(2026, 2, 7, 6, 0, 0) };

let salon: Salon;
const ambitos = new Map<Rol, Ambito>();

function ambitoDe(rol: Rol): Ambito {
  const ambito = ambitos.get(rol);
  if (ambito === undefined) throw new Error(`Falta el puesto ${rol}.`);
  return ambito;
}

const resumen = (rol: Rol = 'dueno', entrada = { desde: DESDE, hasta: HASTA }) =>
  comando(resumenDelPeriodo, {
    entrada,
    ambito: ambitoDe(rol),
    idempotencyKey: clave(),
  });

const iso = (ms: number): string => new Date(ms).toISOString();

async function sembrarCuentas(organizacionId: string, sucursalId: string): Promise<void> {
  const db = obtenerDb();
  await sql`
    insert into ordenes (organizacion_id, sucursal_id, serie, folio, estado, total_centavos,
                         costo_total_centavos, created_at, cerrada_en)
    select ${organizacionId}::uuid, ${sucursalId}::uuid, 'A', g, 'pagada',
           1000 + (g * 37 % 9000),
           (1000 + (g * 37 % 9000)) * 3 / 10,
           ${iso(BASE_UTC)}::timestamptz + g * ${MINUTOS_ENTRE_CUENTAS} * interval '1 minute'
             - interval '1 minute',
           ${iso(BASE_UTC)}::timestamptz + g * ${MINUTOS_ENTRE_CUENTAS} * interval '1 minute'
      from generate_series(1, ${CUENTAS}) g
  `.execute(db);
  // Los bordes del último día: 23:59 del 6 (adentro) y 00:00 del 7 (afuera).
  for (const borde of [EN_EL_BORDE_DENTRO, EN_EL_BORDE_FUERA]) {
    await sql`
      insert into ordenes (organizacion_id, sucursal_id, serie, folio, estado, total_centavos,
                           created_at, cerrada_en)
      values (${organizacionId}::uuid, ${sucursalId}::uuid, 'A', ${borde.folio}, 'pagada',
              ${borde.total}, ${iso(borde.cierre - 60_000)}::timestamptz,
              ${iso(borde.cierre)}::timestamptz)
    `.execute(db);
  }
  // Una cuenta abierta dentro del periodo: no es venta.
  await sql`
    insert into ordenes (organizacion_id, sucursal_id, serie, estado, total_centavos, created_at)
    values (${organizacionId}::uuid, ${sucursalId}::uuid, 'A', 'borrador', 99999,
            ${iso(medianocheDe(2) + 3_600_000)}::timestamptz)
  `.execute(db);
  // La propina de cada quinta cuenta; un pago reembolsado con propina no cuenta.
  await sql`
    insert into pagos (orden_id, organizacion_id, metodo, monto_centavos, propina_centavos)
    select o.id, o.organizacion_id, 'efectivo', o.total_centavos, 100 + (o.folio % 13) * 50
      from ordenes o
     where o.organizacion_id = ${organizacionId}::uuid and o.folio <= ${CUENTAS} and o.folio % 5 = 0
  `.execute(db);
  await sql`
    insert into pagos (orden_id, organizacion_id, metodo, monto_centavos, propina_centavos, estado)
    select o.id, o.organizacion_id, 'efectivo', o.total_centavos, 999, 'reembolsado'
      from ordenes o
     where o.organizacion_id = ${organizacionId}::uuid and o.folio <= ${CUENTAS} and o.folio % 50 = 0
  `.execute(db);
}

async function sembrarComprasYGastos(organizacionId: string, sucursalId: string): Promise<void> {
  const db = obtenerDb();
  await sql`
    insert into compras (organizacion_id, sucursal_id, proveedor_nombre, fecha, total_centavos,
                         metodo_pago)
    select ${organizacionId}::uuid, ${sucursalId}::uuid, 'Don Beto',
           date '2026-02-28' + (g % ${DIAS_DE_COMPRAS} + 1), 300 + (g * 11 % 4000), 'transferencia'
      from generate_series(1, ${FILAS_DE_COMPRAS}) g
  `.execute(db);
  await sql`
    insert into gastos (organizacion_id, sucursal_id, categoria, descripcion, fecha, monto_centavos,
                        metodo_pago)
    select ${organizacionId}::uuid, ${sucursalId}::uuid, 'otro', 'Gasto ' || g,
           date '2026-02-28' + (g % ${DIAS_DE_COMPRAS} + 1), 500 + (g * 13 % 900), 'transferencia'
      from generate_series(1, ${FILAS_DE_COMPRAS}) g
  `.execute(db);
}

/** La misma cuenta, hecha en la prueba y no en la implementación, del día d1 al d2 de marzo. */
function esperadoDe(d1: number, d2: number) {
  const desdeUtc = medianocheDe(d1);
  const hastaUtcExclusivo = medianocheDe(d2 + 1);
  const dentro = (cierre: number): boolean => cierre >= desdeUtc && cierre < hastaUtcExclusivo;
  let cuentas = 0;
  let ventas = 0;
  let costo = 0;
  let propinas = 0;
  for (let g = 1; g <= CUENTAS; g += 1) {
    if (!dentro(cierreDe(g))) continue;
    cuentas += 1;
    ventas += totalDe(g);
    costo += costoDe(g);
    if (g % 5 === 0) propinas += propinaDe(g);
  }
  for (const borde of [EN_EL_BORDE_DENTRO, EN_EL_BORDE_FUERA]) {
    if (!dentro(borde.cierre)) continue;
    cuentas += 1;
    ventas += borde.total;
  }
  let compras = 0;
  let gastos = 0;
  let filas = 0;
  for (let g = 1; g <= FILAS_DE_COMPRAS; g += 1) {
    const diaDeMarzo = diaDeCompra(g);
    if (diaDeMarzo < d1 || diaDeMarzo > d2) continue;
    filas += 1;
    compras += compraDe(g);
    gastos += gastoDe(g);
  }
  return { desdeUtc, hastaUtcExclusivo, cuentas, ventas, costo, propinas, compras, gastos, filas };
}

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Fonda del Año', mesas: 1, terminales: 1 });
  const base = ambitoDeCaja(salon);
  for (const rol of [
    'dueno',
    'administrador',
    'gerente',
    'cajero',
    'mesero',
    'cocina',
    'almacen',
  ] as const) {
    ambitos.set(rol, {
      ...base,
      rol,
      empleoId: await sembrarCompanero(salon.negocio, { nombre: `Alguien ${rol}`, rol }),
    });
  }
  const { organizacionId } = salon.negocio;
  const { sucursalId } = salon.sucursal;
  await sembrarCuentas(organizacionId, sucursalId);
  await sembrarComprasYGastos(organizacionId, sucursalId);

  // Otro negocio con cuentas en el mismo periodo: no entra en ningún total.
  const otro = await sembrarSalon({ nombre: 'Otra Fonda', mesas: 1, terminales: 1 });
  await sql`
    insert into ordenes (organizacion_id, sucursal_id, serie, folio, estado, total_centavos,
                         created_at, cerrada_en)
    select ${otro.negocio.organizacionId}::uuid, ${otro.sucursal.sucursalId}::uuid, 'A', g,
           'pagada', 123456, ${iso(medianocheDe(2) + 3_600_000)}::timestamptz,
           ${iso(medianocheDe(2) + 7_200_000)}::timestamptz
      from generate_series(1, 5) g
  `.execute(obtenerDb());
}, POR_COMANDOS);

describe('registros.resumen · un periodo con más filas que el tope del puente', () => {
  it(
    'las cuentas, las ventas, el costo y las propinas coinciden al centavo con la suma hecha fuera',
    { timeout: POR_COMANDOS },
    async () => {
      const esp = esperadoDe(2, 6);
      expect(esp.cuentas).toBeGreaterThan(TOPE_DEL_PUENTE);
      expect(esp.filas).toBeGreaterThan(TOPE_DEL_PUENTE);

      const salida = exigirOk(await resumen(), 'registros.resumen');
      expect(salida.ventas.cuentas).toBe(esp.cuentas);
      expect(salida.ventas.ventasCentavos).toBe(String(esp.ventas));
      expect(salida.ventas.costoCentavos).toBe(String(esp.costo));
      // Sin renglones que digan lo contrario el costo de la cuenta se conoce (como en el corte).
      expect(salida.ventas.ventaConCostoCentavos).toBe(String(esp.ventas));
      expect(salida.propinasCentavos).toBe(String(esp.propinas));

      // La misma suma, en SQL con instantes explícitos (otra mano que la de la implementación).
      const { rows } = await sql<{ total: string; propinas: string }>`
        select sum(o.total_centavos)::text as total,
               (select sum(p.propina_centavos)::text
                  from pagos p join ordenes x on x.id = p.orden_id
                 where x.organizacion_id = ${salon.negocio.organizacionId}::uuid
                   and p.estado = 'confirmado' and x.estado = 'pagada'
                   and x.cerrada_en >= ${iso(esp.desdeUtc)}::timestamptz
                   and x.cerrada_en <  ${iso(esp.hastaUtcExclusivo)}::timestamptz) as propinas
          from ordenes o
         where o.organizacion_id = ${salon.negocio.organizacionId}::uuid
           and o.estado = 'pagada'
           and o.cerrada_en >= ${iso(esp.desdeUtc)}::timestamptz
           and o.cerrada_en <  ${iso(esp.hastaUtcExclusivo)}::timestamptz
      `.execute(obtenerDb());
      expect(salida.ventas.ventasCentavos).toBe(rows[0]?.total);
      expect(salida.propinasCentavos).toBe(rows[0]?.propinas);
    },
  );

  it(
    'las compras y los gastos del periodo suman sin tope, y el neto es ventas − compras − gastos',
    { timeout: POR_COMANDOS },
    async () => {
      const esp = esperadoDe(2, 6);
      const salida = exigirOk(await resumen(), 'registros.resumen');
      expect(salida.compras).toEqual({ cantidad: esp.filas, totalCentavos: String(esp.compras) });
      expect(salida.gastos).toEqual({ cantidad: esp.filas, totalCentavos: String(esp.gastos) });
      expect(salida.netoCentavos).toBe(String(esp.ventas - esp.compras - esp.gastos));
    },
  );

  it(
    'la utilidad bruta es la venta con costo conocido menos su costo',
    { timeout: POR_COMANDOS },
    async () => {
      const esp = esperadoDe(2, 6);
      const salida = exigirOk(await resumen(), 'registros.resumen');
      expect(salida.ventas.utilidadBrutaCentavos).toBe(String(esp.ventas - esp.costo));
      expect(salida.ventas.sinReceta + salida.ventas.recetaIncompleta).toBe(0);
    },
  );

  it(
    'el día es el del negocio: las 23:59 del último día entran y las 00:00 del siguiente no',
    { timeout: POR_COMANDOS },
    async () => {
      for (const dia of [6, 7]) {
        const esp = esperadoDe(dia, dia);
        const fecha = `2026-03-0${String(dia)}`;
        const salida = exigirOk(
          await resumen('dueno', { desde: fecha, hasta: fecha }),
          'registros.resumen',
        );
        expect(salida.ventas.cuentas, fecha).toBe(esp.cuentas);
        expect(salida.ventas.ventasCentavos, fecha).toBe(String(esp.ventas));
      }
      // La de las 23:59 cuenta el 6 y la de las 00:00 cuenta el 7: ninguna se cuenta dos veces.
      const seis = esperadoDe(6, 6);
      const siete = esperadoDe(7, 7);
      const juntos = esperadoDe(6, 7);
      expect(seis.cuentas + siete.cuentas).toBe(juntos.cuentas);
      expect(seis.ventas + siete.ventas).toBe(juntos.ventas);
    },
  );

  it('un periodo sin nada da ceros, no error', { timeout: POR_COMANDOS }, async () => {
    const salida = exigirOk(
      await resumen('dueno', { desde: '2025-01-01', hasta: '2025-01-31' }),
      'registros.resumen',
    );
    expect(salida.ventas).toMatchObject({ cuentas: 0, ventasCentavos: '0' });
    expect(salida.propinasCentavos).toBe('0');
    expect(salida.netoCentavos).toBe('0');
  });
});

describe('registros.resumen · permisos y entrada', () => {
  it.each(['dueno', 'administrador', 'gerente'] as const)(
    'el %s lo lee',
    { timeout: POR_COMANDOS },
    async (rol) => {
      exigirOk(
        await resumen(rol, { desde: '2026-03-06', hasta: '2026-03-06' }),
        'registros.resumen',
      );
    },
  );

  it.each(['cajero', 'mesero', 'cocina', 'almacen'] as const)(
    'el %s no: SIN_PERMISO',
    { timeout: POR_COMANDOS },
    async (rol) => {
      const salida = await resumen(rol);
      expect(salida.ok).toBe(false);
      if (!salida.ok) expect(salida.error.codigo).toBe('SIN_PERMISO');
    },
  );

  it('un periodo al revés o una fecha rota se rechazan', { timeout: POR_COMANDOS }, async () => {
    for (const entrada of [
      { desde: '2026-03-06', hasta: '2026-03-02' },
      { desde: 'ayer', hasta: HASTA },
    ]) {
      const salida = await resumen('dueno', entrada);
      expect(salida.ok).toBe(false);
      if (!salida.ok) expect(salida.error.codigo).toBe('ENTRADA_INVALIDA');
    }
  });
});
