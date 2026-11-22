/**
 * LOS SEIS CUADRES DE LA JORNADA CORTA DE DP-24, en SÓLO LECTURA sobre la copia: ventas, propinas, corte,
 * inventario, cocina y las invariantes del árbitro (las mismas consultas de `arbitro/invariantes-sql.ts`
 * apuntadas al negocio de prueba), más los 5xx y rechazos del servidor durante la jornada.
 *
 *   node --conditions=react-server qa/simulador/cuadres-dp24.ts --base postgres://…/qa_dp24_v3 --salida <carpeta del libro>
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { INVARIANTES } from './arbitro/invariantes-sql.ts';
import { abrirCliente } from './catalogo.ts';
import { exigirCopiaLocal } from './candado.ts';

const SLUG = 'prueba-restaurante';
function argumento(nombre: string): string {
  const i = process.argv.indexOf(`--${nombre}`);
  const v = i === -1 ? undefined : process.argv[i + 1];
  if (v === undefined) throw new Error(`Falta --${nombre}`);
  return v;
}
const BASE = argumento('base');
const SALIDA = argumento('salida');
exigirCopiaLocal({ databaseUrl: BASE, entorno: process.env });

const pg = abrirCliente(BASE);
await pg.connect();
await pg.query('begin read only');
const q = async (texto: string, v: unknown[] = []): Promise<Record<string, string>[]> =>
  (await pg.query<Record<string, string>>(texto, v)).rows;
const n = async (texto: string, v: unknown[] = []): Promise<number> =>
  Number(Object.values((await q(texto, v))[0] ?? { x: 0 })[0] ?? 0);

const libro = JSON.parse(readFileSync(join(SALIDA, 'libro.json'), 'utf8')) as {
  cobros: {
    ordenId: string;
    tipo: string;
    modo: string;
    totalCentavos: number;
    propinaCentavos: number;
    cambioEsperadoCentavos: number;
    respuesta: Record<string, string>;
  }[];
  grupos: { ordenId: string; lineas: { productoId: string; cantidad: number }[] }[];
  llevar: { ordenId: string; lineas: { productoId: string; cantidad: number }[] }[];
  caja: {
    fondoCentavos: number;
    entradasDeCambioCentavos: number;
    retirosCentavos: number;
    liquidaciones: { propinasCentavos: number; respuesta: Record<string, string | boolean> }[];
    cierre: null | { contadoCentavos: number; respuesta: Record<string, string | boolean> };
  };
  mermas: { insumoId: string; insumo: string; cantidad: number; unidad: string }[];
  existenciasIniciales?: Record<string, number>;
  pendientesDeCierre: string[];
};
const llamadas = JSON.parse(readFileSync(join(SALIDA, 'llamadas.json'), 'utf8')) as {
  quien: string;
  ruta: string;
  estado: number;
  codigo: string;
  mensaje: string;
  entrada: string;
  minuto: number;
}[];

const O = `(select id from organizaciones where slug = '${SLUG}')`;
const resultados: { id: string; ok: boolean; texto: string }[] = [];
const cuadra = (id: string, ok: boolean, texto: string): void => {
  resultados.push({ id, ok, texto });
  console.log(`${ok ? 'CUADRA   ' : 'NO CUADRA'} · ${id} · ${texto}`);
};
const mx = (c: number): string => (c / 100).toFixed(2);

// 1 · VENTAS ───────────────────────────────────────────────────────────────────────────────────
{
  const ordenes = await q(
    `select estado, count(*)::text c, coalesce(sum(total_centavos),0)::text t from ordenes where organizacion_id = ${O} group by 1 order by 1`,
  );
  console.log('Cuentas por estado:', ordenes.map((o) => `${o['estado']}=${o['c']}`).join(' '));
  const pagadas = ordenes.find((o) => o['estado'] === 'pagada');
  const totalPagadas = Number(pagadas?.['t'] ?? 0);
  const pagos = await n(
    `select coalesce(sum(p.monto_centavos),0) from pagos p where p.organizacion_id = ${O} and p.estado = 'confirmado'`,
  );
  const libroTotal = libro.cobros.reduce((s, c) => s + c.totalCentavos, 0);
  const corte = Number(libro.caja.cierre?.respuesta['ventasCentavos'] ?? NaN);
  const huerfanas = await n(
    `select count(*) from ordenes where organizacion_id = ${O} and estado in ('borrador','confirmada','en_preparacion','lista','cuenta_solicitada','parcialmente_pagada','suspendida')`,
  );
  const mesasOcupadas = await n(
    `select count(*) from mesas where organizacion_id = ${O} and (estado <> 'libre' or orden_activa_id is not null)`,
  );
  const mesasSinCuenta = await n(
    `select count(*) from mesas m where m.organizacion_id = ${O} and m.estado not in ('libre','limpieza') and not exists (select 1 from ordenes o where o.id = m.orden_activa_id and o.estado not in ('pagada','cancelada'))`,
  );
  const ok =
    totalPagadas === pagos &&
    pagos === libroTotal &&
    pagos === corte &&
    huerfanas === 0 &&
    mesasOcupadas === 0;
  cuadra(
    '1 Ventas',
    ok,
    `cuentas pagadas $${mx(totalPagadas)} · pagos sin propina $${mx(pagos)} · libro de la caja $${mx(libroTotal)} · corte $${Number.isNaN(corte) ? 'sin corte' : mx(corte)} · cuentas vivas ${String(huerfanas)} · mesas no libres ${String(mesasOcupadas)} (sin cuenta viva ${String(mesasSinCuenta)}) · cobros del libro ${String(libro.cobros.length)} contra ${String(pagadas?.['c'] ?? 0)} pagadas`,
  );
  let malos = 0;
  for (const c of libro.cobros) {
    const r = c.respuesta;
    const difiere =
      Number(r['totalCentavos']) !== c.totalCentavos ||
      Number(r['propinaCentavos']) !== c.propinaCentavos ||
      Number(r['cambioCentavos']) !== c.cambioEsperadoCentavos;
    if (difiere) {
      malos += 1;
      if (malos <= 5)
        console.log(
          `   · cobro ${c.ordenId} (${c.modo}): esperado total ${mx(c.totalCentavos)} propina ${mx(c.propinaCentavos)} cambio ${mx(c.cambioEsperadoCentavos)}; respondió ${JSON.stringify(r)}`,
        );
    }
  }
  cuadra(
    '1b Respuesta de cada cobro',
    malos === 0,
    `${String(malos)} de ${String(libro.cobros.length)} cobros con total/propina/cambio distintos de lo calculado por la pantalla`,
  );
  const porModo = new Map<string, number>();
  for (const c of libro.cobros) porModo.set(c.modo, (porModo.get(c.modo) ?? 0) + 1);
  console.log(
    '   cobros por tipo:',
    [...porModo.entries()].map(([k, v]) => `${k}=${String(v)}`).join(' '),
    `· mesa ${String(libro.cobros.filter((c) => c.tipo === 'mesa').length)} · para llevar ${String(libro.cobros.filter((c) => c.tipo === 'llevar').length)}`,
  );
}

// 2 · PROPINAS ─────────────────────────────────────────────────────────────────────────────────
{
  const cobradas = await n(
    `select coalesce(sum(p.propina_centavos),0) from pagos p where p.organizacion_id = ${O} and p.estado = 'confirmado'`,
  );
  const libroPropinas = libro.cobros.reduce((s, c) => s + c.propinaCentavos, 0);
  const liquidadas = await n(
    `select coalesce(sum(total_centavos),0) from liquidaciones_propina where organizacion_id = ${O}`,
  );
  const pendientes = await n(
    `select coalesce(sum(p.propina_centavos),0) from pagos p join ordenes o on o.id = p.orden_id where o.organizacion_id = ${O} and p.estado = 'confirmado' and o.propina_liquidacion_id is null`,
  );
  const enOrdenesLiquidadas = await n(
    `select coalesce(sum(p.propina_centavos),0) from pagos p join ordenes o on o.id = p.orden_id where o.organizacion_id = ${O} and p.estado = 'confirmado' and o.propina_liquidacion_id is not null`,
  );
  const ventasEnLiquidaciones = await n(
    `select count(*) from ordenes where organizacion_id = ${O} and propina_liquidacion_id is not null`,
  );
  const reclamadasPorLiquidacion = await q(
    `select l.folio::text, l.total_centavos::text t, (select count(*) from ordenes o where o.propina_liquidacion_id = l.id)::text v from liquidaciones_propina l where l.organizacion_id = ${O} order by l.folio`,
  );
  const dobles = await n(
    `select count(*) from (select o.id from ordenes o join auditoria a on a.entidad_id = o.id and a.accion = 'propinas.liquidar' where o.organizacion_id = ${O} group by o.id having count(*) > 1) x`,
  );
  const entregadoMov = await n(
    `select coalesce(-sum(m.monto_centavos),0) from movimientos_caja m join sesiones_caja s on s.id = m.sesion_caja_id where s.organizacion_id = ${O} and m.tipo = 'propina_entregada'`,
  );
  const entregadoLiq = await n(
    `select coalesce(sum(total_centavos),0) from liquidaciones_propina where organizacion_id = ${O} and sesion_caja_id is not null`,
  );
  const entregadoRespuestas = libro.caja.liquidaciones.reduce(
    (s, l) => s + Number(l.respuesta['entregadoDeLaCajaCentavos'] ?? 0),
    0,
  );
  console.log(
    '   liquidaciones:',
    reclamadasPorLiquidacion
      .map((l) => `${l['folio']}: $${mx(Number(l['t']))} en ${l['v']} cuentas`)
      .join(' · '),
    '· intentos:',
    libro.caja.liquidaciones
      .map((l) => (l.respuesta['ok'] === true ? 'ok' : `${String(l.respuesta['codigo'])}`))
      .join(','),
  );
  cuadra(
    '2 Propinas cobradas = liquidadas + pendientes',
    cobradas === liquidadas + pendientes &&
      cobradas === libroPropinas &&
      enOrdenesLiquidadas === liquidadas,
    `cobradas $${mx(cobradas)} (libro $${mx(libroPropinas)}) · liquidadas $${mx(liquidadas)} (en cuentas marcadas $${mx(enOrdenesLiquidadas)}) · pendientes $${mx(pendientes)} · cuentas marcadas ${String(ventasEnLiquidaciones)}`,
  );
  cuadra(
    '2b Ninguna cuenta liquidada dos veces',
    dobles === 0,
    `${String(dobles)} cuentas con más de una liquidación en la auditoría`,
  );
  cuadra(
    '2c Entregado desde la caja = movimientos propina_entregada',
    entregadoMov === entregadoLiq && entregadoMov === entregadoRespuestas,
    `movimientos $${mx(entregadoMov)} · liquidaciones sellada a la caja $${mx(entregadoLiq)} · lo que respondió el servidor $${mx(entregadoRespuestas)}`,
  );
}

// 3 · CORTE ────────────────────────────────────────────────────────────────────────────────────
{
  const fondo = await n(
    `select coalesce(sum(fondo_inicial_centavos),0) from sesiones_caja where organizacion_id = ${O}`,
  );
  const efectivoVenta = await n(
    `select coalesce(sum(p.monto_centavos),0) from pagos p where p.organizacion_id = ${O} and p.estado = 'confirmado' and p.metodo = 'efectivo'`,
  );
  const efectivoPropina = await n(
    `select coalesce(sum(p.propina_centavos),0) from pagos p where p.organizacion_id = ${O} and p.estado = 'confirmado' and p.metodo = 'efectivo'`,
  );
  const cambio = await n(
    `select coalesce(sum(p.cambio_centavos),0) from pagos p where p.organizacion_id = ${O} and p.estado = 'confirmado' and p.metodo = 'efectivo'`,
  );
  const entradas = libro.caja.entradasDeCambioCentavos;
  const retiros = libro.caja.retirosCentavos;
  const entregado = await n(
    `select coalesce(-sum(m.monto_centavos),0) from movimientos_caja m join sesiones_caja s on s.id = m.sesion_caja_id where s.organizacion_id = ${O} and m.tipo = 'propina_entregada'`,
  );
  const esperado = fondo + efectivoVenta + efectivoPropina + entradas - retiros - entregado;
  const movs = await q(
    `select m.tipo, count(*)::text c, sum(m.monto_centavos)::text t from movimientos_caja m join sesiones_caja s on s.id = m.sesion_caja_id where s.organizacion_id = ${O} group by 1 order by 1`,
  );
  console.log(
    '   movimientos del cajón:',
    movs.map((m) => `${m['tipo']}=${m['c']}×$${mx(Number(m['t']))}`).join(' · '),
    `· cambio devuelto $${mx(cambio)} (ya no está en el cajón: monto = lo vendido, no lo recibido)`,
  );
  const suma = await n(
    `select coalesce(sum(m.monto_centavos),0) from movimientos_caja m join sesiones_caja s on s.id = m.sesion_caja_id where s.organizacion_id = ${O} and m.tipo <> 'cierre'`,
  );
  const ses = (
    await q(
      `select estado, efectivo_esperado_centavos::text e, efectivo_contado_centavos::text c, diferencia_centavos::text d from sesiones_caja where organizacion_id = ${O} order by abierta_en desc limit 1`,
    )
  )[0];
  const respEsperado = Number(libro.caja.cierre?.respuesta['efectivoEsperadoCentavos'] ?? NaN);
  const contado = libro.caja.cierre?.contadoCentavos ?? NaN;
  const dif = Number(libro.caja.cierre?.respuesta['diferenciaCentavos'] ?? NaN);
  cuadra(
    '3 Efectivo esperado del corte',
    esperado === respEsperado && esperado === Number(ses?.['e']) && esperado === suma,
    `fondo $${mx(fondo)} + efectivo vendido $${mx(efectivoVenta)} + propinas en efectivo $${mx(efectivoPropina)} + entradas de cambio $${mx(entradas)} − retiros $${mx(retiros)} − propinas entregadas $${mx(entregado)} = $${mx(esperado)}; el servidor dijo $${Number.isNaN(respEsperado) ? 'sin corte' : mx(respEsperado)} (guardado ${ses?.['e'] === undefined ? '?' : `$${mx(Number(ses['e']))}`}, suma de movimientos $${mx(suma)})`,
  );
  cuadra(
    '3b Arqueo del bot contra el esperado',
    !Number.isNaN(contado) && dif === contado - respEsperado,
    `el bot contó $${Number.isNaN(contado) ? '?' : mx(contado)}; diferencia que dijo el servidor $${Number.isNaN(dif) ? '?' : mx(dif)} (debía ser $${Number.isNaN(contado) ? '?' : mx(contado - respEsperado)}) · sesión ${String(ses?.['estado'])}`,
  );
}

// 4 · INVENTARIO ───────────────────────────────────────────────────────────────────────────────
{
  const esperadoPorVenta = await q(`
    select nombre, unidad_base, sum(cant)::text as esperado from (
      select i.nombre, i.unidad_base, l.cantidad * r.cantidad * (1 + r.merma_bp / 10000.0) as cant
        from orden_lineas l join ordenes o on o.id = l.orden_id
        join recetas r on r.producto_id = l.producto_id and r.activa
        join insumos i on i.id = r.insumo_id
       where o.organizacion_id = ${O} and o.estado = 'pagada' and l.anulada_en is null
      union all
      select i.nombre, i.unidad_base, l.cantidad
        from orden_lineas l join ordenes o on o.id = l.orden_id
        join productos p on p.id = l.producto_id and p.estrategia_consumo = 'sku'
        join insumos i on i.producto_id = l.producto_id
       where o.organizacion_id = ${O} and o.estado = 'pagada' and l.anulada_en is null) x
     group by 1, 2 order by 1`);
  const salidas = await q(
    `select i.nombre, (-sum(m.cantidad))::text as salida from movimientos_stock m join insumos i on i.id = m.insumo_id where m.organizacion_id = ${O} and m.tipo = 'salida_venta' group by 1`,
  );
  const mermas = await q(
    `select i.nombre, (-sum(m.cantidad))::text as merma from movimientos_stock m join insumos i on i.id = m.insumo_id where m.organizacion_id = ${O} and m.tipo = 'merma' group by 1`,
  );
  const salidaDe = new Map(salidas.map((s) => [s['nombre'], Number(s['salida'])]));
  let distintos = 0;
  const detalle: string[] = [];
  for (const e of esperadoPorVenta) {
    const exp = Number(e['esperado']);
    const got = salidaDe.get(e['nombre']) ?? 0;
    if (Math.abs(exp - got) > 0.01 * Math.max(1, exp) && Math.abs(exp - got) > 0.5) {
      distintos += 1;
      detalle.push(
        `${String(e['nombre'])}: esperado ${exp.toFixed(2)} ${String(e['unidad_base'])} (líneas × receta), descontado ${got.toFixed(2)}`,
      );
    }
  }
  const sinReceta = [...salidaDe.keys()].filter(
    (k) => !esperadoPorVenta.some((e) => e['nombre'] === k),
  );
  const mermaLibro = libro.mermas.reduce((s, m) => s + m.cantidad, 0);
  const mermaDb = mermas.reduce((s, m) => s + Number(m['merma']), 0);
  console.log(
    '   descontado por venta:',
    salidas.map((s) => `${String(s['nombre'])}=${Number(s['salida']).toFixed(0)}`).join(' · '),
  );
  cuadra(
    '4 Lo descontado = lo vendido (líneas pagadas × receta)',
    distintos === 0 && sinReceta.length === 0,
    `${String(distintos)} insumos con diferencia, ${String(sinReceta.length)} descontados sin receta${detalle.length > 0 ? `: ${detalle.slice(0, 6).join(' | ')}` : ''}`,
  );
  cuadra(
    '4b Mermas',
    Math.abs(mermaLibro - mermaDb) < 0.01,
    `libro ${String(mermaLibro)} (${libro.mermas.map((m) => `${m.insumo} ${String(m.cantidad)}`).join(', ')}) · movimientos ${mermaDb.toFixed(2)} · ${mermas.map((m) => `${String(m['nombre'])} ${Number(m['merma']).toFixed(0)}`).join(', ')}`,
  );
  const anuladas = await n(
    `select count(*) from orden_lineas l join ordenes o on o.id = l.orden_id where o.organizacion_id = ${O} and l.anulada_en is not null`,
  );
  const todos = await q(
    `select i.nombre, x.cantidad::text c, i.unidad_base from existencias x join insumos i on i.id = x.insumo_id where x.organizacion_id = ${O} order by i.nombre`,
  );
  const negativos = todos.filter((x) => Number(x['c']) < 0);
  const movs = await q(
    `select i.nombre, coalesce(sum(m.cantidad),0)::text d from insumos i left join movimientos_stock m on m.insumo_id = i.id where i.organizacion_id = ${O} group by 1`,
  );
  const desvios = movs.filter((m) => {
    const ex = todos.find((x) => x['nombre'] === m['nombre']);
    return ex !== undefined && Math.abs(Number(m['d']) - Number(ex['c'])) > 0.01;
  });
  cuadra(
    '4c Existencias = suma de movimientos; nada negativo',
    desvios.length === 0 && negativos.length === 0,
    `${String(desvios.length)} insumos donde existencia ≠ suma de sus movimientos; ${String(negativos.length)} negativos${negativos.length > 0 ? `: ${negativos.map((x) => `${String(x['nombre'])} ${Number(x['c']).toFixed(1)} ${String(x['unidad_base'])}`).join(', ')}` : ''} · líneas anuladas ${String(anuladas)}`,
  );
}

// 5 · COCINA ───────────────────────────────────────────────────────────────────────────────────
{
  const comandas = await q(
    `select estado, count(*)::text c from comandas where organizacion_id = ${O} group by 1 order by 1`,
  );
  const items = await q(
    `select estado, count(*)::text c, sum(cantidad)::text q from comanda_items where organizacion_id = ${O} group by 1 order by 1`,
  );
  const atoradas = await n(
    `select count(*) from comandas where organizacion_id = ${O} and estado in ('nuevo','en_preparacion','listo')`,
  );
  const itemsAtorados = await n(
    `select count(*) from comanda_items where organizacion_id = ${O} and estado in ('pendiente','en_preparacion','listo')`,
  );
  const entregados = await n(
    `select coalesce(sum(ci.cantidad),0) from comanda_items ci where ci.organizacion_id = ${O} and ci.estado = 'entregado'`,
  );
  const vendidos = await n(
    `select coalesce(sum(l.cantidad),0) from orden_lineas l join ordenes o on o.id = l.orden_id where o.organizacion_id = ${O} and o.estado = 'pagada' and l.anulada_en is null`,
  );
  const enviados = [...libro.grupos, ...libro.llevar].reduce(
    (s, g) => s + g.lineas.reduce((t, l) => t + l.cantidad, 0),
    0,
  );
  console.log(
    '   comandas:',
    comandas.map((c) => `${c['estado']}=${c['c']}`).join(' '),
    '· platillos:',
    items.map((c) => `${c['estado']}=${c['c']}`).join(' '),
  );
  cuadra(
    '5 Ninguna comanda atorada; entregados = vendidos',
    atoradas === 0 && itemsAtorados === 0 && entregados === vendidos && vendidos === enviados,
    `comandas vivas ${String(atoradas)} · platillos vivos ${String(itemsAtorados)} · platillos entregados ${String(entregados)} · vendidos (líneas pagadas) ${String(vendidos)} · pedidos por los bots ${String(enviados)}`,
  );
}

// 6 · ÁRBITRO ──────────────────────────────────────────────────────────────────────────────────
{
  let violaciones = 0;
  const filas: string[] = [];
  for (const inv of INVARIANTES) {
    let sql = inv.sql.replaceAll("'don-poncho'", `'${SLUG}'`);
    if (inv.id === 'I03') {
      // El árbitro de Don Poncho no conoce el consumo por SKU (el insumo 1:1 del producto) del restaurante de prueba: se le agrega.
      const corte = /union all\s+select o\.id, l\.insumo_base_id,/;
      const sku = `union all select o.id, i2.id, l.cantidad from ordenes o join orden_lineas l on l.orden_id = o.id and l.anulada_en is null join productos p on p.id = l.producto_id and p.estrategia_consumo = 'sku' join insumos i2 on i2.producto_id = l.producto_id where o.organizacion_id = (select id from organizaciones where slug = '${SLUG}') and o.estado in ('pagada', 'parcialmente_reembolsada', 'reembolsada') union all select o.id, l.insumo_base_id,`;
      sql = sql.replace(corte, () => sku);
    }
    try {
      await pg.query('savepoint s');
      const r = await pg.query(sql);
      await pg.query('release savepoint s');
      if (r.rows.length > 0) {
        violaciones += 1;
        filas.push(
          `${inv.id} (${inv.nombre}): ${String(r.rows.length)} filas, p. ej. ${JSON.stringify(r.rows[0]).slice(0, 260)}`,
        );
      }
    } catch (error: unknown) {
      await pg.query('rollback to savepoint s');
      filas.push(`${inv.id}: la consulta falló (${String(error).slice(0, 120)})`);
      violaciones += 1;
    }
  }
  cuadra(
    '6 Invariantes del árbitro',
    violaciones === 0,
    `${String(INVARIANTES.length)} consultas, ${String(violaciones)} con filas`,
  );
  for (const f of filas) console.log(`   · ${f}`);
  const c5xx = llamadas.filter((l) => l.estado >= 500 || l.estado === 0);
  const rechazos = new Map<string, number>();
  for (const l of llamadas.filter((x) => x.estado >= 400 && x.estado < 500)) {
    const k = `${l.ruta} ${String(l.estado)} ${l.codigo}`;
    rechazos.set(k, (rechazos.get(k) ?? 0) + 1);
  }
  cuadra(
    '6b Errores 5xx / sin respuesta del servidor',
    c5xx.length === 0,
    `${String(c5xx.length)} de ${String(llamadas.length)} llamadas${
      c5xx.length > 0
        ? `: ${c5xx
            .slice(0, 5)
            .map((l) => `${l.ruta} ${String(l.estado)} ${l.codigo} «${l.mensaje.slice(0, 80)}»`)
            .join(' | ')}`
        : ''
    }`,
  );
  console.log('   rechazos 4xx por código:');
  for (const [k, v] of [...rechazos.entries()].sort())
    console.log(`     ${String(v).padStart(4)}  ${k}`);
  if (libro.pendientesDeCierre.length > 0)
    console.log('   anotaciones de los bots:', libro.pendientesDeCierre.slice(0, 12).join(' || '));
}
await pg.query('rollback');
await pg.end();
console.log(
  `\nResumen: ${String(resultados.filter((r) => r.ok).length)} cuadran, ${String(resultados.filter((r) => !r.ok).length)} no cuadran.`,
);
