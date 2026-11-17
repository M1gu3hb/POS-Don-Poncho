import type { Ambito, Rol } from '@morphiqpos/contracts';
import { obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { ambitoDeCaja, sembrarSalon, type Salon } from '../restaurante/pruebas/salon-real.ts';
import { propinasDelRango } from './del-rango.ts';

/**
 * A23 · LAS PROPINAS POR MESERO DE UN RANGO SE SUMAN EN EL SERVIDOR, contra Postgres.
 *
 * La pestaña Propinas de Registros bajaba las últimas ventas (el puente topa en 1 000) y agrupaba en
 * el navegador: pasado el tope, las propinas viejas desaparecían sin aviso. Aquí hay MÁS cuentas con
 * propina que el tope (1 440 en el rango) repartidas entre dos meseros y la venta directa, unas
 * pendientes y otras liquidadas, y el total por mesero coincide al centavo con la cuenta hecha en la
 * prueba. La lista de detalle sí va topada, y lo dice (`hayMasVentas`).
 */

const POR_COMANDOS = 180_000;
const TOPE_DEL_PUENTE = 1_000;
const CUENTAS = 1_800;
const MINUTOS_ENTRE_CUENTAS = 5;
const BASE_UTC = Date.UTC(2026, 2, 1, 20, 0, 0);
/** Del 2 al 6 de marzo en México (UTC-6): de las 06:00 UTC del 2 hasta un milisegundo antes del 7. */
const DESDE = new Date(Date.UTC(2026, 2, 2, 6, 0, 0)).toISOString();
const HASTA = new Date(Date.UTC(2026, 2, 7, 6, 0, 0) - 1).toISOString();
const LIMITE = 300;

const cierreDe = (g: number): number => BASE_UTC + g * MINUTOS_ENTRE_CUENTAS * 60_000;
const propinaDe = (g: number): number => 100 + (g % 17) * 25;
/** Cada tercera cuenta es de Ana, cada tercera de Beto, y una de cada tres es venta directa. */
const meseroDe = (g: number): 'ana' | 'beto' | null =>
  g % 3 === 0 ? 'ana' : g % 3 === 1 ? 'beto' : null;
const estaLiquidada = (g: number): boolean => g % 4 === 0;

let salon: Salon;
const ambitos = new Map<Rol, Ambito>();
const empleos = { ana: '', beto: '' };

const iso = (ms: number): string => new Date(ms).toISOString();

type Estado = 'todas' | 'pendientes' | 'liquidadas';

const consultar = (
  rol: Rol,
  entrada: {
    desde?: string;
    hasta?: string;
    estado?: Estado;
    meseroId?: string | null;
    limite?: number;
  } = {},
) => {
  const ambito = ambitos.get(rol);
  if (ambito === undefined) throw new Error(`Falta el puesto ${rol}.`);
  return comando(propinasDelRango, {
    entrada: { desde: DESDE, hasta: HASTA, limite: LIMITE, ...entrada },
    ambito,
    idempotencyKey: clave(),
  });
};

/** La cuenta de la prueba: lo que debe salir de un rango, un estado y (opcional) un mesero. */
function esperado(estado: Estado, mesero: 'ana' | 'beto' | 'directa' | null = null) {
  const desde = Date.parse(DESDE);
  const hasta = Date.parse(HASTA);
  const porMesero = new Map<string, { centavos: number; ventas: number }>();
  let total = 0;
  let pendientes = 0;
  let ventas = 0;
  let ultimaCuenta = 0;
  for (let g = 1; g <= CUENTAS; g += 1) {
    const cierre = cierreDe(g);
    if (cierre < desde || cierre > hasta) continue;
    if (estado === 'pendientes' && estaLiquidada(g)) continue;
    if (estado === 'liquidadas' && !estaLiquidada(g)) continue;
    const quien = meseroDe(g) ?? 'directa';
    if (mesero !== null && quien !== mesero) continue;
    total += propinaDe(g);
    if (!estaLiquidada(g)) pendientes += propinaDe(g);
    ventas += 1;
    ultimaCuenta = g;
    const previo = porMesero.get(quien) ?? { centavos: 0, ventas: 0 };
    porMesero.set(quien, { centavos: previo.centavos + propinaDe(g), ventas: previo.ventas + 1 });
  }
  return { total, pendientes, liquidadas: total - pendientes, ventas, ultimaCuenta, porMesero };
}

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Fonda de las Propinas', mesas: 1, terminales: 1 });
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
  empleos.ana = await sembrarCompanero(salon.negocio, { nombre: 'Ana', rol: 'mesero' });
  empleos.beto = await sembrarCompanero(salon.negocio, { nombre: 'Beto', rol: 'mesero' });

  const { organizacionId } = salon.negocio;
  const { sucursalId } = salon.sucursal;
  const db = obtenerDb();
  const liquida = ambitos.get('dueno')?.empleoId ?? '';
  const { rows: liquidaciones } = await sql<{ id: string }>`
    insert into liquidaciones_propina (organizacion_id, sucursal_id, folio, rango_inicio, rango_fin,
                                       empleado_liquida_id)
    values (${organizacionId}::uuid, ${sucursalId}::uuid, 1, ${DESDE}::timestamptz,
            ${HASTA}::timestamptz, ${liquida}::uuid)
    returning id
  `.execute(db);
  const liquidacionId = liquidaciones[0]?.id ?? '';

  await sql`
    insert into ordenes (organizacion_id, sucursal_id, serie, folio, estado, total_centavos,
                         created_at, cerrada_en, empleado_atiende_id, propina_liquidacion_id,
                         propina_origen)
    select ${organizacionId}::uuid, ${sucursalId}::uuid, 'A', g, 'pagada', 1000 + (g * 37 % 9000),
           ${iso(BASE_UTC)}::timestamptz + g * ${MINUTOS_ENTRE_CUENTAS} * interval '1 minute'
             - interval '1 minute',
           ${iso(BASE_UTC)}::timestamptz + g * ${MINUTOS_ENTRE_CUENTAS} * interval '1 minute',
           case g % 3 when 0 then ${empleos.ana}::uuid when 1 then ${empleos.beto}::uuid end,
           case when g % 4 = 0 then ${liquidacionId}::uuid end,
           'mesero'
      from generate_series(1, ${CUENTAS}) g
  `.execute(db);
  await sql`
    insert into pagos (orden_id, organizacion_id, metodo, monto_centavos, propina_centavos)
    select o.id, o.organizacion_id, case when o.folio % 2 = 0 then 'efectivo' else 'tarjeta' end,
           o.total_centavos, 100 + (o.folio % 17) * 25
      from ordenes o
     where o.organizacion_id = ${organizacionId}::uuid
  `.execute(db);
  // Un pago reembolsado con propina no cuenta como propina.
  await sql`
    insert into pagos (orden_id, organizacion_id, metodo, monto_centavos, propina_centavos, estado)
    select o.id, o.organizacion_id, 'tarjeta', o.total_centavos, 5000, 'reembolsado'
      from ordenes o
     where o.organizacion_id = ${organizacionId}::uuid and o.folio % 40 = 0
  `.execute(db);

  // Otro negocio con propinas en el mismo rango: no entra en nada.
  const otro = await sembrarSalon({ nombre: 'Otra Fonda', mesas: 1, terminales: 1 });
  await sql`
    insert into ordenes (organizacion_id, sucursal_id, serie, folio, estado, total_centavos,
                         created_at, cerrada_en)
    select ${otro.negocio.organizacionId}::uuid, ${otro.sucursal.sucursalId}::uuid, 'A', g,
           'pagada', 5000, ${DESDE}::timestamptz + interval '1 hour',
           ${DESDE}::timestamptz + interval '2 hours'
      from generate_series(1, 5) g
  `.execute(db);
  await sql`
    insert into pagos (orden_id, organizacion_id, metodo, monto_centavos, propina_centavos)
    select o.id, o.organizacion_id, 'efectivo', 5000, 777777
      from ordenes o where o.organizacion_id = ${otro.negocio.organizacionId}::uuid
  `.execute(db);
}, POR_COMANDOS);

describe('propinas.del_rango · más cuentas con propina que el tope del puente', () => {
  it(
    'el total y lo pendiente coinciden al centavo con la cuenta hecha fuera, sin tope',
    { timeout: POR_COMANDOS },
    async () => {
      const esp = esperado('todas');
      expect(esp.ventas).toBeGreaterThan(TOPE_DEL_PUENTE);

      const salida = exigirOk(await consultar('dueno'), 'propinas.del_rango');
      expect(salida.numeroVentas).toBe(esp.ventas);
      expect(salida.totalCentavos).toBe(String(esp.total));
      expect(salida.pendientesCentavos).toBe(String(esp.pendientes));
      expect(salida.liquidadasCentavos).toBe(String(esp.liquidadas));

      // La misma suma en SQL, con instantes explícitos y sin pasar por la implementación.
      const { rows } = await sql<{ total: string }>`
        select sum(p.propina_centavos)::text as total
          from pagos p join ordenes o on o.id = p.orden_id
         where o.organizacion_id = ${salon.negocio.organizacionId}::uuid
           and p.estado = 'confirmado'
           and o.cerrada_en between ${DESDE}::timestamptz and ${HASTA}::timestamptz
      `.execute(obtenerDb());
      expect(salida.totalCentavos).toBe(rows[0]?.total);
    },
  );

  it(
    'el total por mesero coincide al centavo, con la venta directa aparte',
    { timeout: POR_COMANDOS },
    async () => {
      const esp = esperado('todas');
      const salida = exigirOk(await consultar('dueno'), 'propinas.del_rango');
      const porId = new Map(salida.meseros.map((m) => [m.meseroId, m]));
      const ana = esp.porMesero.get('ana');
      const beto = esp.porMesero.get('beto');
      const directa = esp.porMesero.get('directa');
      expect(porId.get(empleos.ana)).toMatchObject({
        meseroNombre: 'Ana',
        propinaCentavos: String(ana?.centavos),
        numeroVentas: ana?.ventas,
      });
      expect(porId.get(empleos.beto)).toMatchObject({
        meseroNombre: 'Beto',
        propinaCentavos: String(beto?.centavos),
        numeroVentas: beto?.ventas,
      });
      expect(porId.get(null)).toMatchObject({
        propinaCentavos: String(directa?.centavos),
        numeroVentas: directa?.ventas,
      });
      expect(salida.meseros).toHaveLength(3);
      // Lo que ganó cada quien suma lo que dice el total: nada se pierde en el reparto.
      expect(salida.meseros.reduce((suma, m) => suma + BigInt(m.propinaCentavos), 0n)).toBe(
        BigInt(esp.total),
      );
    },
  );

  it(
    'la lista de detalle va topada y lo dice; los totales no dependen de ella',
    { timeout: POR_COMANDOS },
    async () => {
      const esp = esperado('todas');
      const salida = exigirOk(await consultar('dueno'), 'propinas.del_rango');
      expect(salida.ventas).toHaveLength(LIMITE);
      expect(salida.hayMasVentas).toBe(true);
      expect(salida.numeroVentas).toBeGreaterThan(salida.ventas.length);
      // La más reciente primero, con lo que la pantalla pinta de cada renglón.
      expect(salida.ventas[0]).toMatchObject({
        serie: 'A',
        folio: String(esp.ultimaCuenta),
        liquidada: esp.ultimaCuenta % 4 === 0,
        origen: 'mesero',
        propinaCentavos: String(propinaDe(esp.ultimaCuenta)),
        metodoPago: esp.ultimaCuenta % 2 === 0 ? 'efectivo' : 'tarjeta',
      });
      // Pidiendo la lista completa de lo que cabe, deja de haber «más».
      const corto = exigirOk(
        await consultar('dueno', {
          desde: iso(cierreDe(1_500)),
          hasta: iso(cierreDe(1_509)),
          limite: LIMITE,
        }),
        'propinas.del_rango',
      );
      expect(corto.hayMasVentas).toBe(false);
      expect(corto.ventas).toHaveLength(corto.numeroVentas);
    },
  );
});

describe('propinas.del_rango · por estado y por mesero', () => {
  it.each(['pendientes', 'liquidadas'] as const)(
    'con estado «%s» el total, la cuenta y los meseros son los de ese estado',
    { timeout: POR_COMANDOS },
    async (estado) => {
      const esp = esperado(estado);
      const salida = exigirOk(await consultar('dueno', { estado }), 'propinas.del_rango');
      expect(salida.numeroVentas).toBe(esp.ventas);
      expect(salida.totalCentavos).toBe(String(esp.total));
      const ana = salida.meseros.find((m) => m.meseroId === empleos.ana);
      expect(ana?.propinaCentavos).toBe(String(esp.porMesero.get('ana')?.centavos));
      expect(salida.ventas.every((v) => v.liquidada === (estado === 'liquidadas'))).toBe(true);
    },
  );

  it('con un mesero elegido sólo cuenta el suyo', { timeout: POR_COMANDOS }, async () => {
    const esp = esperado('todas', 'ana');
    const salida = exigirOk(
      await consultar('dueno', { meseroId: empleos.ana }),
      'propinas.del_rango',
    );
    expect(salida.numeroVentas).toBe(esp.ventas);
    expect(salida.totalCentavos).toBe(String(esp.total));
    expect(salida.meseros).toHaveLength(1);
  });

  it('un rango sin propinas da ceros, no error', { timeout: POR_COMANDOS }, async () => {
    const salida = exigirOk(
      await consultar('dueno', {
        desde: '2025-01-01T06:00:00.000Z',
        hasta: '2025-01-31T06:00:00.000Z',
      }),
      'propinas.del_rango',
    );
    expect(salida).toMatchObject({
      numeroVentas: 0,
      totalCentavos: '0',
      pendientesCentavos: '0',
      liquidadasCentavos: '0',
      hayMasVentas: false,
    });
    expect(salida.meseros).toEqual([]);
  });
});

describe('propinas.del_rango · permisos y entrada', () => {
  it.each(['dueno', 'administrador', 'gerente'] as const)(
    'el %s lo lee',
    { timeout: POR_COMANDOS },
    async (rol) => {
      exigirOk(await consultar(rol, { limite: 5 }), 'propinas.del_rango');
    },
  );

  it.each(['cajero', 'mesero', 'cocina', 'almacen'] as const)(
    'el %s no: SIN_PERMISO',
    { timeout: POR_COMANDOS },
    async (rol) => {
      const salida = await consultar(rol);
      expect(salida.ok).toBe(false);
      if (!salida.ok) expect(salida.error.codigo).toBe('SIN_PERMISO');
    },
  );

  it('un rango al revés o de más de un año se rechaza', { timeout: POR_COMANDOS }, async () => {
    for (const entrada of [
      { desde: HASTA, hasta: DESDE },
      { desde: '2024-01-01T06:00:00.000Z', hasta: '2026-01-01T06:00:00.000Z' },
    ]) {
      const salida = await consultar('dueno', entrada);
      expect(salida.ok).toBe(false);
    }
  });
});
