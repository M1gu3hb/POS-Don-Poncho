import { randomUUID } from 'node:crypto';

import type { Ambito, Rol } from '@morphiqpos/contracts';
import { obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { ambitoDeCaja, sembrarSalon, type Salon } from '../restaurante/pruebas/salon-real.ts';
import { loMasVendido } from './lo-mas-vendido.ts';
import { resumenDelPeriodo } from './resumen-del-periodo.ts';

/**
 * DP-22 · «LO MÁS VENDIDO», contra Postgres: por platillo (piezas o kilos, e importe) y por mesero
 * (cuentas, venta, propina), sumado en el servidor sin tope, con el día del negocio, sin lo anulado ni
 * lo cancelado ni la cuenta madre de una división, y con las devoluciones restando. El total de la
 * venta cuadra con `registros.resumen`.
 *
 * Los datos se siembran con SQL y los resultados esperados se escriben aquí, a mano, no se calculan con
 * la implementación.
 */

const POR_COMANDOS = 180_000;
/** Medianoche de México = 06:00 UTC (sin horario de verano desde 2022). */
const utc = (mes: number, dia: number, hora: number, minuto = 0): string =>
  new Date(Date.UTC(2026, mes - 1, dia, hora, minuto)).toISOString();

const DESDE = '2026-03-02';
const HASTA = '2026-03-04';

let salon: Salon;
let ana = '';
let beto = '';
let folio = 1;
const ambitos = new Map<Rol, Ambito>();

const ambitoDe = (rol: Rol): Ambito => {
  const a = ambitos.get(rol);
  if (a === undefined) throw new Error(`Falta el puesto ${rol}.`);
  return a;
};

const lo = (rol: Rol = 'dueno', entrada = { desde: DESDE, hasta: HASTA }) =>
  comando(loMasVendido, { entrada, ambito: ambitoDe(rol), idempotencyKey: clave() });
const resumen = () =>
  comando(resumenDelPeriodo, {
    entrada: { desde: DESDE, hasta: HASTA },
    ambito: ambitoDe('dueno'),
    idempotencyKey: clave(),
  });

interface Linea {
  readonly nombre: string;
  readonly cantidad: number;
  readonly precio: number;
  /** Por peso: los kilos de la línea (la línea es de 1 pieza). */
  readonly kilos?: number;
  readonly anulada?: boolean;
}

interface Cuenta {
  readonly estado: 'pagada' | 'cancelada' | 'dividida' | 'parcialmente_reembolsada' | 'reembolsada';
  readonly cierre: string;
  readonly mesero?: string;
  readonly descuento?: number;
  readonly total: number;
  readonly lineas: readonly Linea[];
  readonly padre?: string;
  readonly propina?: number;
  /** Una devolución: día, monto y cuántas piezas de la primera línea. */
  readonly devolucion?: {
    readonly cuando: string;
    readonly piezas: number;
    readonly monto: number;
  };
}

const ids = new Map<string, string>();

async function sembrar(
  nombre: string,
  c: Cuenta,
  db: ReturnType<typeof obtenerDb> = obtenerDb(),
): Promise<string> {
  const { organizacionId } = salon.negocio;
  const { sucursalId } = salon.sucursal;
  const id = randomUUID();
  ids.set(nombre, id);
  const cierre = c.cierre;
  const nuevaFolio = folio++;
  await sql`
    insert into ordenes (id, organizacion_id, sucursal_id, serie, folio, estado, total_centavos,
                         subtotal_centavos, descuento_centavos, created_at, cerrada_en,
                         empleado_atiende_id, orden_padre_id, division_indice,
                         motivo_cancelacion, cancelada_en)
    values (${id}::uuid, ${organizacionId}::uuid, ${sucursalId}::uuid, 'A', ${nuevaFolio}, ${c.estado},
            ${c.total}, ${c.total + (c.descuento ?? 0)}, ${c.descuento ?? 0},
            ${cierre}::timestamptz - interval '10 minutes', ${cierre}::timestamptz,
            ${c.mesero ?? null}::uuid, ${c.padre ?? null}::uuid, ${c.padre === undefined ? null : 1},
            ${c.estado === 'cancelada' ? 'cliente se fue' : null},
            ${c.estado === 'cancelada' ? cierre : null}::timestamptz)
  `.execute(db);
  for (const l of c.lineas) {
    const total = l.kilos === undefined ? l.cantidad * l.precio : Math.round(l.kilos * l.precio);
    await sql`
      insert into orden_lineas (orden_id, organizacion_id, producto_nombre, cantidad,
                                precio_unitario_centavos, subtotal_centavos, total_centavos,
                                tipo_venta, cantidad_variable, unidad_variable, unidad, anulada_en, motivo_anulacion)
      values (${id}::uuid, ${organizacionId}::uuid, ${l.nombre}, ${l.kilos === undefined ? l.cantidad : 1},
              ${l.precio}, ${total}, ${total},
              ${l.kilos === undefined ? 'precio_fijo' : 'variable_medida'}, ${l.kilos ?? null},
              ${l.kilos === undefined ? null : 'kg'}, ${l.kilos === undefined ? 'pza' : 'pza'},
              ${l.anulada === true ? cierre : null}::timestamptz, ${l.anulada === true ? 'error_de_captura' : null})
    `.execute(db);
  }
  if (c.propina !== undefined) {
    await sql`
      insert into pagos (orden_id, organizacion_id, metodo, monto_centavos, propina_centavos)
      values (${id}::uuid, ${organizacionId}::uuid, 'efectivo', ${c.total}, ${c.propina})
    `.execute(db);
    // Un pago reembolsado con propina nunca cuenta.
    await sql`
      insert into pagos (orden_id, organizacion_id, metodo, monto_centavos, propina_centavos, estado)
      values (${id}::uuid, ${organizacionId}::uuid, 'efectivo', ${c.total}, 999, 'reembolsado')
    `.execute(db);
  }
  if (c.devolucion !== undefined) await devolver(id, c.devolucion);
  return id;
}

async function devolver(
  ordenId: string,
  d: { readonly cuando: string; readonly piezas: number; readonly monto: number },
): Promise<void> {
  const db = obtenerDb();
  const { organizacionId } = salon.negocio;
  const { sucursalId } = salon.sucursal;
  const devolucionId = randomUUID();
  await sql`
    insert into devoluciones (id, organizacion_id, sucursal_id, orden_id, empleado_id, metodo,
                              monto_centavos, motivo, created_at)
    values (${devolucionId}::uuid, ${organizacionId}::uuid, ${sucursalId}::uuid, ${ordenId}::uuid,
            ${ana}::uuid, 'transferencia', ${d.monto}, 'No era lo que pidió', ${d.cuando}::timestamptz)
  `.execute(db);
  await sql`
    insert into devoluciones_lineas (organizacion_id, devolucion_id, orden_linea_id, cantidad,
                                     monto_centavos, created_at)
    select ${organizacionId}::uuid, ${devolucionId}::uuid, l.id, ${d.piezas}, ${d.monto},
           ${d.cuando}::timestamptz
      from orden_lineas l where l.orden_id = ${ordenId}::uuid order by l.created_at, l.id limit 1
  `.execute(db);
}

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Fonda de lo más vendido', mesas: 1, terminales: 1 });
  const base = ambitoDeCaja(salon);
  ana = await sembrarCompanero(salon.negocio, { nombre: 'Ana Mesera', rol: 'mesero' });
  beto = await sembrarCompanero(salon.negocio, { nombre: 'Beto Mesero', rol: 'mesero' });
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

  // A · pagada el 3: 3 tacos y 0.75 kg de barbacoa (a $795 el kilo = $596.25). Propina $15.
  await sembrar('A', {
    estado: 'pagada',
    cierre: utc(3, 3, 21),
    mesero: ana,
    total: 70_125,
    propina: 1_500,
    lineas: [
      { nombre: 'Taco', cantidad: 3, precio: 3_500 },
      { nombre: 'Barbacoa por kilo', cantidad: 1, precio: 79_500, kilos: 0.75 },
    ],
  });
  // B · pagada el 3: 2 tacos y un flan ANULADO aparte (no es venta).
  await sembrar('B', {
    estado: 'pagada',
    cierre: utc(3, 3, 22),
    mesero: ana,
    total: 7_000,
    lineas: [
      { nombre: 'Taco', cantidad: 2, precio: 3_500 },
      { nombre: 'Flan', cantidad: 1, precio: 5_500, anulada: true },
    ],
  });
  // C · CANCELADA: sus diez tacos no se vendieron.
  await sembrar('C', {
    estado: 'cancelada',
    cierre: utc(3, 3, 23),
    mesero: ana,
    total: 35_000,
    lineas: [{ nombre: 'Taco', cantidad: 10, precio: 3_500 }],
  });
  // D · una cuenta DIVIDIDA: la madre no cuenta; sus dos hijas, cada una con 2 tacos, sí.
  // (La base exige que las hijas sumen lo de la madre al confirmar: todo en una transacción.)
  await obtenerDb()
    .transaction()
    .execute(async (trx) => {
      const madre = await sembrar(
        'D',
        {
          estado: 'dividida',
          cierre: utc(3, 3, 20),
          mesero: ana,
          total: 14_000,
          lineas: [{ nombre: 'Taco', cantidad: 4, precio: 3_500 }],
        },
        trx,
      );
      for (const [i, nombre] of ['D1', 'D2'].entries()) {
        await sembrar(
          nombre,
          {
            estado: 'pagada',
            cierre: utc(3, 3, 20, 5 + i),
            mesero: ana,
            total: 7_000,
            padre: madre,
            lineas: [{ nombre: 'Taco', cantidad: 2, precio: 3_500 }],
          },
          trx,
        );
      }
    });
  // E · de Beto: 0.5 kg de barbacoa ($397.50) con $10 de descuento de CUENTA; propina $20.
  await sembrar('E', {
    estado: 'pagada',
    cierre: utc(3, 4, 18),
    mesero: beto,
    total: 38_750,
    descuento: 1_000,
    propina: 2_000,
    lineas: [{ nombre: 'Barbacoa por kilo', cantidad: 1, precio: 79_500, kilos: 0.5 }],
  });
  // F · de Beto, devuelta en parte el 4: 5 tacos vendidos, 2 devueltos ($70).
  await sembrar('F', {
    estado: 'parcialmente_reembolsada',
    cierre: utc(3, 3, 19),
    mesero: beto,
    total: 17_500,
    lineas: [{ nombre: 'Taco', cantidad: 5, precio: 3_500 }],
    devolucion: { cuando: utc(3, 4, 15), piezas: 2, monto: 7_000 },
  });
  // G · de Beto, devuelta ENTERA el 4: sigue siendo venta de su día y la devolución resta.
  await sembrar('G', {
    estado: 'reembolsada',
    cierre: utc(3, 3, 19, 30),
    mesero: beto,
    total: 3_500,
    lineas: [{ nombre: 'Taco', cantidad: 1, precio: 3_500 }],
    devolucion: { cuando: utc(3, 4, 16), piezas: 1, monto: 3_500 },
  });
  // I · las 23:59 del último día (05:59 UTC del 5): entra. J · las 00:00 del 5: no entra.
  await sembrar('I', {
    estado: 'pagada',
    cierre: utc(3, 5, 5, 59),
    mesero: ana,
    total: 3_500,
    lineas: [{ nombre: 'Taco', cantidad: 1, precio: 3_500 }],
  });
  await sembrar('J', {
    estado: 'pagada',
    cierre: utc(3, 5, 6, 0),
    mesero: ana,
    total: 3_500,
    lineas: [{ nombre: 'Taco', cantidad: 1, precio: 3_500 }],
  });
  // H · fuera del periodo (el 10). K · de febrero, vendida y devuelta el 3: la devolución entra, la venta no.
  await sembrar('H', {
    estado: 'pagada',
    cierre: utc(3, 10, 20),
    mesero: ana,
    total: 31_500,
    lineas: [{ nombre: 'Taco', cantidad: 9, precio: 3_500 }],
  });
  await sembrar('K', {
    estado: 'parcialmente_reembolsada',
    cierre: utc(2, 20, 20),
    mesero: beto,
    total: 5_500,
    lineas: [{ nombre: 'Flan', cantidad: 1, precio: 5_500 }],
    devolucion: { cuando: utc(3, 3, 21), piezas: 1, monto: 5_500 },
  });

  // Otro negocio, mismo periodo y mismo platillo: no entra.
  const otro = await sembrarSalon({ nombre: 'Otra Fonda', mesas: 1, terminales: 1 });
  const otraId = randomUUID();
  await sql`
    insert into ordenes (id, organizacion_id, sucursal_id, serie, folio, estado, total_centavos,
                         created_at, cerrada_en)
    values (${otraId}::uuid, ${otro.negocio.organizacionId}::uuid, ${otro.sucursal.sucursalId}::uuid, 'A', 1,
            'pagada', 999900, ${utc(3, 3, 20)}::timestamptz, ${utc(3, 3, 21)}::timestamptz)
  `.execute(obtenerDb());
  await sql`
    insert into orden_lineas (orden_id, organizacion_id, producto_nombre, cantidad,
                              precio_unitario_centavos, subtotal_centavos, total_centavos)
    values (${otraId}::uuid, ${otro.negocio.organizacionId}::uuid, 'Taco', 99, 10100, 999900, 999900)
  `.execute(obtenerDb());
}, POR_COMANDOS);

describe('registros.lo_mas_vendido · por platillo', () => {
  it(
    'suma lo vendido sin lo anulado, lo cancelado ni la cuenta madre, y la devolución resta',
    { timeout: POR_COMANDOS },
    async () => {
      const salida = exigirOk(await lo(), 'registros.lo_mas_vendido');
      const por = new Map(salida.platillos.map((p) => [p.nombre, p]));
      // Tacos: A 3 + B 2 + D1 2 + D2 2 + F 5 + G 1 + I 1 = 16 piezas = $560.00. Devueltos: F 2 + G 1 = 3 ($105).
      expect(por.get('Taco')).toMatchObject({
        cantidad: '16',
        unidad: 'pza',
        lineas: 7,
        importeCentavos: '56000',
        devueltoCantidad: '3',
        devueltoCentavos: '10500',
        cantidadNeta: '13',
        netoCentavos: '45500',
      });
      // Barbacoa por kilo: A 0.75 kg + E 0.5 kg = 1.25 kg: $596.25 + $397.50 = $993.75; cuenta en kilos.
      expect(por.get('Barbacoa por kilo')).toMatchObject({
        cantidad: '1.25',
        unidad: 'kg',
        lineas: 2,
        importeCentavos: '99375',
        devueltoCentavos: '0',
        netoCentavos: '99375',
      });
      // Flan: el anulado de B no cuenta; el de K se vendió en febrero: sólo aparece su devolución.
      expect(por.get('Flan')).toMatchObject({
        cantidad: '0',
        importeCentavos: '0',
        devueltoCantidad: '1',
        devueltoCentavos: '5500',
        netoCentavos: '-5500',
      });
      expect(salida.platillos).toHaveLength(3);
    },
  );

  it('va ordenado por lo que dejó cada platillo', { timeout: POR_COMANDOS }, async () => {
    const salida = exigirOk(await lo(), 'registros.lo_mas_vendido');
    expect(salida.platillos.map((p) => p.nombre)).toEqual(['Barbacoa por kilo', 'Taco', 'Flan']);
  });

  it(
    'el total de lo vendido cuadra con el resumen del periodo (cuentas, venta y descuento de cuenta)',
    { timeout: POR_COMANDOS },
    async () => {
      const salida = exigirOk(await lo(), 'registros.lo_mas_vendido');
      const resu = exigirOk(await resumen(), 'registros.resumen');
      // Las cuentas vendidas: A B D1 D2 E F G I = 8; su venta es la del resumen, al centavo.
      expect(salida.cuentas.cantidad).toBe(8);
      expect(salida.cuentas.cantidad).toBe(resu.ventas.cuentas);
      expect(salida.cuentas.ventasCentavos).toBe(resu.ventas.ventasCentavos);
      expect(salida.cuentas.ventasCentavos).toBe(
        String(70_125 + 7_000 + 7_000 + 7_000 + 38_750 + 17_500 + 3_500 + 3_500),
      );
      // Lo vendido por platillo + lo que no es platillo (aquí, el descuento de la cuenta E: −$10) = la venta.
      expect(BigInt(salida.vendidoCentavos) + BigInt(salida.cuentas.ajusteCentavos)).toBe(
        BigInt(resu.ventas.ventasCentavos),
      );
      expect(salida.cuentas.ajusteCentavos).toBe('-1000');
      expect(salida.vendidoCentavos).toBe('155375');
      expect(salida.devueltoCentavos).toBe('16000');
      expect(salida.netoCentavos).toBe('139375');
    },
  );
});

describe('registros.lo_mas_vendido · por mesero', () => {
  it(
    'cuentas, venta y propina de cada uno (el pago reembolsado no da propina)',
    { timeout: POR_COMANDOS },
    async () => {
      const salida = exigirOk(await lo(), 'registros.lo_mas_vendido');
      const por = new Map(salida.meseros.map((m) => [m.nombre, m]));
      expect(por.get('Ana Mesera')).toMatchObject({
        cuentas: 5,
        ventaCentavos: String(70_125 + 7_000 + 7_000 + 7_000 + 3_500),
        propinaCentavos: '1500',
      });
      expect(por.get('Beto Mesero')).toMatchObject({
        cuentas: 3,
        ventaCentavos: String(38_750 + 17_500 + 3_500),
        propinaCentavos: '2000',
      });
      expect(salida.meseros).toHaveLength(2);
      expect(salida.meseros[0]?.nombre).toBe('Ana Mesera');
    },
  );

  it(
    'la venta y la propina de los meseros suman la venta y la propina del resumen',
    { timeout: POR_COMANDOS },
    async () => {
      const salida = exigirOk(await lo(), 'registros.lo_mas_vendido');
      const resu = exigirOk(await resumen(), 'registros.resumen');
      expect(salida.meseros.reduce((s, m) => s + BigInt(m.ventaCentavos), 0n)).toBe(
        BigInt(resu.ventas.ventasCentavos),
      );
      expect(salida.meseros.reduce((s, m) => s + BigInt(m.propinaCentavos), 0n)).toBe(
        BigInt(resu.propinasCentavos),
      );
      expect(salida.meseros.reduce((s, m) => s + m.cuentas, 0)).toBe(resu.ventas.cuentas);
    },
  );
});

describe('registros.lo_mas_vendido · el día del negocio, permisos y entrada', () => {
  it(
    'las 23:59 del último día entran y las 00:00 del siguiente no',
    { timeout: POR_COMANDOS },
    async () => {
      const quinto = exigirOk(
        await lo('dueno', { desde: '2026-03-05', hasta: '2026-03-05' }),
        'registros.lo_mas_vendido',
      );
      // Sólo J (00:00 del 5): una pieza. La de las 23:59 del 4 se cuenta el 4.
      expect(quinto.platillos.find((p) => p.nombre === 'Taco')?.cantidad).toBe('1');
      expect(quinto.cuentas.cantidad).toBe(1);
    },
  );

  it(
    'un periodo sin nada da listas vacías y ceros, no error',
    { timeout: POR_COMANDOS },
    async () => {
      const salida = exigirOk(
        await lo('dueno', { desde: '2025-01-01', hasta: '2025-01-31' }),
        'registros.lo_mas_vendido',
      );
      expect(salida.platillos).toEqual([]);
      expect(salida.meseros).toEqual([]);
      expect(salida.vendidoCentavos).toBe('0');
      expect(salida.cuentas).toEqual({ cantidad: 0, ventasCentavos: '0', ajusteCentavos: '0' });
    },
  );

  it.each(['dueno', 'administrador', 'gerente'] as const)(
    'el %s lo lee',
    { timeout: POR_COMANDOS },
    async (rol) => {
      exigirOk(await lo(rol), 'registros.lo_mas_vendido');
    },
  );

  it.each(['cajero', 'mesero', 'cocina', 'almacen'] as const)(
    'el %s no: SIN_PERMISO',
    { timeout: POR_COMANDOS },
    async (rol) => {
      const salida = await lo(rol);
      expect(salida.ok).toBe(false);
      if (!salida.ok) expect(salida.error.codigo).toBe('SIN_PERMISO');
    },
  );

  it('un periodo al revés o una fecha rota se rechazan', { timeout: POR_COMANDOS }, async () => {
    for (const entrada of [
      { desde: '2026-03-06', hasta: '2026-03-02' },
      { desde: 'ayer', hasta: HASTA },
    ]) {
      const salida = await lo('dueno', entrada);
      expect(salida.ok).toBe(false);
      if (!salida.ok) expect(salida.error.codigo).toBe('ENTRADA_INVALIDA');
    }
  });
});

describe('registros.lo_mas_vendido · sin tope de filas', () => {
  it('suma más de mil líneas de un platillo sin toparlas', { timeout: POR_COMANDOS }, async () => {
    const otro = await sembrarSalon({ nombre: 'Fonda grande', mesas: 1, terminales: 1 });
    const db = obtenerDb();
    await sql`
      insert into ordenes (organizacion_id, sucursal_id, serie, folio, estado, total_centavos,
                           created_at, cerrada_en)
      select ${otro.negocio.organizacionId}::uuid, ${otro.sucursal.sucursalId}::uuid, 'A', g, 'pagada', 3500,
             ${utc(3, 3, 20)}::timestamptz, ${utc(3, 3, 21)}::timestamptz + g * interval '1 second'
        from generate_series(1, 1300) g
    `.execute(db);
    await sql`
      insert into orden_lineas (orden_id, organizacion_id, producto_nombre, cantidad,
                                precio_unitario_centavos, subtotal_centavos, total_centavos)
      select o.id, o.organizacion_id, 'Taco ' || (o.folio % 2), 1, 3500, 3500, 3500
        from ordenes o where o.organizacion_id = ${otro.negocio.organizacionId}::uuid
    `.execute(db);
    const ambito: Ambito = {
      ...ambitoDeCaja(otro),
      rol: 'dueno',
      empleoId: await sembrarCompanero(otro.negocio, { nombre: 'Dueña grande', rol: 'dueno' }),
    };
    const salida = exigirOk(
      await comando(loMasVendido, {
        entrada: { desde: DESDE, hasta: HASTA },
        ambito,
        idempotencyKey: clave(),
      }),
      'registros.lo_mas_vendido',
    );
    const piezas = salida.platillos.reduce((s, p) => s + Number(p.cantidad), 0);
    expect(piezas).toBe(1300);
    expect(salida.cuentas.cantidad).toBe(1300);
    expect(salida.vendidoCentavos).toBe(String(1300 * 3500));
  });
});
