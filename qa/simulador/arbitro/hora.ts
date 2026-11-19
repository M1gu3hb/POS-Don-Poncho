/**
 * EL ÁRBITRO DE CADA HORA (DP-22, el día de bots): lo mismo que el del cierre, pero con las cajas
 * ABIERTAS y los bots trabajando. Sólo LEE (la base en transacciones de sólo lectura y el libro en su
 * archivo): no toca a ningún bot ni a ninguna pantalla.
 *
 * El problema de medir a media jornada es el BORDE: un bot anota en el libro unos segundos DESPUÉS de
 * que la base ya tiene el cobro, así que una foto exacta de «ahora» da diferencias falsas. Por eso:
 *   1. se mira lo ocurrido hasta cuatro minutos simulados ANTES de ahora (un corte «asentado»);
 *   2. si hay diferencias, se espera unos segundos y se vuelve a mirar con el corte tres minutos más
 *      atrás: sólo lo que PERSISTE en los dos cortes es una diferencia; lo demás se cuenta como
 *      «transitoria del borde» y queda dicho en el informe (no se esconde).
 * Se compara: cada cobro al centavo (total, descuento, propina, método, cambio), las propinas por
 * mesero, los retiros y las entradas de efectivo, las compras y los gastos, el inventario al gramo y
 * su valor con UN solo redondeo sobre el costo exacto (`costo_exacto_dmc`), el kardex contra la
 * existencia, las comandas (ninguna perdida ni atorada) y las invariantes de la base. Aparte se
 * cuentan los 5xx y los errores de consola de los navegadores, con lo que se explicó y lo que no.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { INSUMOS } from '../dia0/datos.ts';
import { hechosVigilados, type HechoVigilado } from '../incidentes.ts';
import type { AsientoFechado } from '../libro.ts';
import { crearComparador, leerSql, num, ORGANIZACION, type Diferencia } from './base.ts';
import { arbitrarCajas } from './cajas.ts';
import { arbitrarInventario } from './inventario.ts';
import { contarInvariantes, type ConteoDeInvariantes } from './invariantes.ts';
import { INVARIANTES } from './invariantes-sql.ts';

/** Minutos simulados que el corte se queda atrás de «ahora» (lo que tarda un bot en anotar). */
export const ATRASO_DEL_CORTE_MIN = 4;
/** Cuánto más atrás se vuelve a mirar si algo no cuadró. */
export const SEGUNDO_CORTE_MIN = 3;
/** Una comanda sin entregar ni cancelar después de tanto tiempo se da por atorada. */
export const COMANDA_ATORADA_MIN = 45;

const MINUTO_MS = 60_000;

/** Lo que el informe sabe de cada revisión horaria. */
export interface RevisionDeLaHora {
  /** «HH:MM» simulada de la revisión. */
  readonly hora: string;
  readonly corteIso: string;
  readonly comparaciones: number;
  /** Lo que persistió en los dos cortes: lo único que cuenta como diferencia. */
  readonly diferencias: readonly Diferencia[];
  /** Diferencias del primer corte que se fueron en el segundo (borde entre la base y el libro). */
  readonly transitorias: number;
  readonly porFuente: Readonly<
    Record<string, { readonly comparaciones: number; readonly diferencias: number }>
  >;
  readonly dinero: {
    readonly cobros: number;
    readonly ventasCentavos: number;
    readonly propinasCentavos: number;
    readonly propinasPorMesero: Readonly<Record<string, number>>;
  };
  readonly comandas: {
    readonly enLibro: number;
    readonly enBase: number;
    readonly atoradas: number;
  };
  readonly vigilancia: ResumenDeVigilancia;
  readonly milisegundos: number;
}

export interface ResumenDeVigilancia {
  readonly cincoXX: number;
  readonly consolaSinExplicar: number;
  readonly consolaExplicada: number;
  readonly redExplicada: number;
  /** Los primeros hechos sin explicar (para el informe). */
  readonly ejemplos: readonly string[];
}

/** Lo que una corrida DECLARA explicado, con su razón: lo demás es un hallazgo. */
const CONSOLA_EXPLICADA: readonly { readonly patron: RegExp; readonly razon: string }[] = [
  {
    patron: /Loading the image 'http:\/\/localhost:3230\//,
    razon:
      'las fotos del molde apuntan al almacén de archivos de otra corrida (puerto 3230): es dato del clon, no de la app',
  },
  {
    patron: /Failed to load resource: the server responded with a status of 4\d\d/,
    razon: 'rechazo de negocio (4xx) a propósito: PIN equivocado, descuento sin PIN, cupo, etc.',
  },
  {
    patron:
      /ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED|net::ERR_FAILED|Failed to fetch|NetworkError/,
    razon: 'corte de red programado en el caos de la caja',
  },
];

/** Clasifica lo que vieron los navegadores desde `desdeMs` (reloj real). Pura: se prueba sola. */
export function clasificarLaVigilancia(
  hechos: readonly HechoVigilado[],
  desdeMs = 0,
): ResumenDeVigilancia {
  const mios = hechos.filter((h) => h.cuando >= desdeMs);
  let consolaExplicada = 0;
  let redExplicada = 0;
  const sinExplicar: string[] = [];
  for (const h of mios) {
    if (h.tipo === '5xx') continue;
    if (h.tipo === 'red') {
      redExplicada += 1;
      continue;
    }
    if (CONSOLA_EXPLICADA.some((e) => e.patron.test(h.texto))) consolaExplicada += 1;
    else sinExplicar.push(`${h.donde}: ${h.texto}`);
  }
  return {
    cincoXX: mios.filter((h) => h.tipo === '5xx').length,
    consolaSinExplicar: sinExplicar.length,
    consolaExplicada,
    redExplicada,
    ejemplos: [
      ...mios
        .filter((h) => h.tipo === '5xx')
        .slice(0, 5)
        .map((h) => `5xx · ${h.donde}: ${h.texto}`),
      ...sinExplicar.slice(0, 5),
    ],
  };
}

/** El valor de una cantidad a un costo exacto, redondeado UNA vez (como `valorDeLaCantidad` del dominio). */
export function valorExacto(cantidadTexto: string, costoDmc: bigint): bigint {
  const [entera = '0', fraccion = ''] = cantidadTexto.split('.');
  const escalada = BigInt(entera + fraccion.padEnd(4, '0').slice(0, 4));
  if (escalada <= 0n) return 0n;
  const acumulado = escalada * costoDmc;
  const base = 100_000_000n; // 10^4 de la cantidad × 10^4 del costo
  return (acumulado + base / 2n) / base;
}

interface FilaDeStock {
  readonly nombre: string;
  readonly existencia: string;
  readonly kardex: string;
  readonly dmc: string;
  readonly valor_app: string | null;
  readonly entradas: string;
}

const STOCK = `
select i.nombre, coalesce(e.cantidad, 0)::text as existencia,
       (select coalesce(sum(m.cantidad), 0) from movimientos_stock m where m.insumo_id = i.id)::text as kardex,
       i.costo_exacto_dmc::text as dmc, v.valor_centavos::text as valor_app,
       (select coalesce(sum(m.cantidad * m.costo_exacto_dmc), 0) from movimientos_stock m
         where m.insumo_id = i.id and m.tipo = 'entrada_compra' and m.created_at >= $2::timestamptz and m.created_at <= $3::timestamptz)::text as entradas
  from insumos i
  left join (select insumo_id, sum(cantidad) as cantidad from existencias group by insumo_id) e on e.insumo_id = i.id
  left join existencias_por_insumo v on v.insumo_id = i.id
 where i.organizacion_id = ${ORGANIZACION} and i.nombre = any($1::text[])`;

/** El inventario: existencia contra kardex al gramo y el valor con un solo redondeo del costo exacto. */
async function arbitrarElStock(
  baseUrl: string,
  desde: string,
  hasta: string,
  libro: readonly AsientoFechado[],
  c: ReturnType<typeof crearComparador>,
): Promise<void> {
  const nombres = INSUMOS.map((i) => i.nombre);
  const filas = await leerSql<FilaDeStock>(baseUrl, STOCK, [nombres, desde, hasta]);
  for (const f of filas) {
    c.comparar(
      'inventario',
      `${f.nombre}: la existencia es la suma del kardex (al gramo)`,
      Number(f.kardex),
      Number(f.existencia),
      'inventario',
      'alto',
    );
    const mio = valorExacto(f.existencia, BigInt(f.dmc));
    c.comparar(
      'inventario',
      `${f.nombre}: valor del inventario con un solo redondeo del costo exacto (¢)`,
      String(mio),
      f.valor_app ?? '0',
      'dinero',
      'alto',
    );
    // Lo que costaron las compras del día contra lo que el kardex valúa (cantidad × costo exacto, un redondeo),
    // con la tolerancia que DP-D165 escribió: ⌊ΣQ/20 000 + ½⌋ ¢ (Q: existencia tras cada compra; aquí, su cota).
    const compras = libro.flatMap((a) =>
      a.asiento.tipo === 'compra' && a.asiento.insumo === f.nombre ? [a.asiento] : [],
    );
    if (compras.length > 0) {
      const pagado = compras.reduce((s, x) => s + x.costoCentavos, 0);
      const kardex = Math.round(Number(f.entradas) / 10_000);
      const cota =
        Math.floor((compras.length * Math.max(Number(f.existencia), 0)) / 20_000 + 0.5) + 1;
      const diferencia = Math.abs(kardex - pagado);
      c.comparar(
        'inventario',
        `${f.nombre}: lo que costaron las compras del día contra el kardex valuado (¢, tolerancia ${String(cota)})`,
        '0',
        String(diferencia <= cota ? 0 : diferencia),
        'dinero',
        'alto',
      );
    }
  }
}

interface FilaDeCobroPorMesero {
  readonly mesero: string | null;
  readonly folio: string;
  readonly propina: string;
  readonly total: string;
  readonly origen: string | null;
}

const COBROS_POR_MESERO = `
select p.nombre as mesero, o.folio::text as folio, o.propina_origen as origen, o.total_centavos::text as total,
       coalesce(sum(pg.propina_centavos) filter (where pg.estado = 'confirmado'), 0)::text as propina
  from ordenes o
  left join empleos e on e.id = o.empleado_atiende_id
  left join personas p on p.id = e.persona_id
  left join pagos pg on pg.orden_id = o.id
 where o.organizacion_id = ${ORGANIZACION} and o.folio is not null and o.estado = 'pagada' and o.created_at >= $1::timestamptz
 group by p.nombre, o.folio, o.propina_origen, o.total_centavos`;

/** Las propinas por mesero: las cuentas de mesa que el libro sabe de quién son, contra lo que la base les carga. */
async function arbitrarLasPropinas(
  baseUrl: string,
  desde: string,
  libro: readonly AsientoFechado[],
  c: ReturnType<typeof crearComparador>,
): Promise<Readonly<Record<string, number>>> {
  const meseroDe = new Map<string, string>();
  for (const a of libro)
    if (a.asiento.tipo === 'linea' && a.asiento.canal === 'mesa' && !meseroDe.has(a.asiento.cuenta))
      meseroDe.set(a.asiento.cuenta, a.bot);
  // Las cuentas que un mesero dado de baja dejó y otro adoptó cambian de mesero: no se comparan por persona.
  const adoptadas = new Set(
    libro.flatMap((a) =>
      a.asiento.tipo === 'cambio_en_vivo' && a.asiento.que.startsWith('cuenta adoptada')
        ? [a.asiento.despues]
        : [],
    ),
  );
  const filas = await leerSql<FilaDeCobroPorMesero>(baseUrl, COBROS_POR_MESERO, [desde]);
  const porFolio = new Map(filas.map((f) => [f.folio, f]));
  const esperado = new Map<string, number>();
  const real = new Map<string, number>();
  for (const a of libro) {
    if (a.asiento.tipo !== 'cobro') continue;
    const quien = meseroDe.get(a.asiento.cuenta);
    const f = porFolio.get(a.asiento.folio);
    if (quien === undefined || f === undefined || adoptadas.has(a.asiento.cuenta)) continue;
    esperado.set(quien, (esperado.get(quien) ?? 0) + a.asiento.propinaCentavos);
    if (f.mesero === quien) real.set(quien, (real.get(quien) ?? 0) + num(f.propina));
    else
      c.violacion(
        'propinas',
        `La cuenta ${a.asiento.cuenta} (folio ${a.asiento.folio}) la atendió ${quien} y la base dice ${f.mesero ?? 'nadie'}`,
        `propina ${String(num(f.propina))}`,
        'dinero',
        'medio',
      );
  }
  for (const [mesero, centavos] of esperado)
    c.comparar(
      'propinas',
      `Propinas de ${mesero} (suma de sus cuentas cobradas, ¢)`,
      centavos,
      real.get(mesero) ?? 0,
      'dinero',
      'critico',
    );
  return Object.fromEntries(esperado);
}

/**
 * C02 con el IVA que cambia a media operación (DP-D155): cada cuenta se cobra con la tasa VIGENTE al
 * cobrar, así que la invariante general (que lee la tasa de ahora) no sirve. Aquí: el total es subtotal −
 * descuento (el IVA va incluido) y el impuesto es el de alguna de las dos tasas legales, con 3 ¢ de holgura.
 */
const IVA_DE_CADA_CUENTA = `
select o.serie || '-' || coalesce(o.folio::text, '?') as folio, o.total_centavos::text as total,
       o.impuestos_centavos::text as impuestos
  from ordenes o
 where o.organizacion_id = ${ORGANIZACION} and o.estado in ('pagada', 'parcialmente_reembolsada', 'reembolsada')
   and o.created_at >= $1::timestamptz and o.created_at <= $2::timestamptz
   and (o.total_centavos <> o.subtotal_centavos - o.descuento_centavos
        or (abs(o.impuestos_centavos - round(o.total_centavos::numeric * 16 / 116)) > 3
            and abs(o.impuestos_centavos - round(o.total_centavos::numeric * 8 / 108)) > 3))`;

const RETIROS_Y_ENTRADAS = `
select tipo, sum(monto_centavos)::text as suma
  from movimientos_caja
 where organizacion_id = ${ORGANIZACION} and created_at >= $1::timestamptz and created_at <= $2::timestamptz
 group by tipo`;

async function arbitrarElEfectivo(
  baseUrl: string,
  desde: string,
  hasta: string,
  libro: readonly AsientoFechado[],
  c: ReturnType<typeof crearComparador>,
): Promise<void> {
  const filas = await leerSql<{ tipo: string; suma: string }>(baseUrl, RETIROS_Y_ENTRADAS, [
    desde,
    hasta,
  ]);
  const suma = (patron: RegExp): number =>
    filas.filter((f) => patron.test(f.tipo)).reduce((s, f) => s + Math.abs(num(f.suma)), 0);
  const delLibro = (tipo: 'retiro' | 'entrada'): number =>
    libro.reduce(
      (s, a) =>
        a.asiento.tipo === tipo && a.horaSim >= new Date(desde).toISOString()
          ? s + a.asiento.centavos
          : s,
      0,
    );
  c.comparar(
    'cajas',
    'Retiros de efectivo del día (libro contra movimientos de caja, ¢)',
    delLibro('retiro'),
    suma(/retiro/i),
  );
  c.comparar(
    'cajas',
    'Entradas de cambio del día (libro contra movimientos de caja, ¢)',
    delLibro('entrada'),
    suma(/entrada/i),
  );
}

// El corte es el de la COMANDA (cuándo se mandó a cocina), no el de cada fila: al dividir una cuenta, una
// línea de 2 piezas se parte en 1 + 1 y la pieza nueva entra a la MISMA comanda con la hora de la división
// (D22-058 y D22-059 del día 2212: la división cayó después del corte, la fila vieja ya traía 1 y la nueva
// quedaba fuera, y el árbitro veía una pieza menos). Las piezas siguen siendo las que se mandaron.
// Las FILAS (lo que se cuenta de los platillos por porción o por peso: una línea es un platillo) sí miran la hora
// de la fila: al dividir una línea de 3 porciones, las 2 filas nuevas nacen minutos después que la comanda y no son
// platillos nuevos (D22-081 del día 2214: B058 con 3 Shots se cobró en 3 partes y la base dijo 8 contra 6 del libro).
export const COMANDAS = `
select split_part(ci.producto_nombre, ' · ', 1) as nombre,
       coalesce(sum(ci.cantidad) filter (where ci.estado <> 'cancelado'), 0)::text as piezas,
       count(*) filter (where ci.estado <> 'cancelado' and ci.created_at <= c.created_at + interval '5 seconds')::int as filas
  from comanda_items ci
  join comandas c on c.id = ci.comanda_id and c.organizacion_id = ci.organizacion_id
 where ci.organizacion_id = ${ORGANIZACION} and c.created_at >= $1::timestamptz and c.created_at <= $2::timestamptz
 group by 1`;

const TIPOS_DE_VENTA = `select split_part(nombre, ' · ', 1) as nombre, bool_or(tipo_venta = 'precio_fijo') as por_pieza from productos group by 1`;

const COMANDAS_ATORADAS = `
select count(*)::int as n
  from comandas c
 where c.organizacion_id = ${ORGANIZACION} and c.created_at >= $1::timestamptz and c.created_at <= $2::timestamptz
   and (c.estado in ('nuevo', 'en_preparacion') or (c.estado = 'listo' and c.mesa_id is not null))`;

/** Ninguna comanda perdida (lo que el libro mandó a cocina está en la base) y ninguna atorada. */
async function arbitrarLasComandas(
  baseUrl: string,
  desde: string,
  hasta: string,
  atoradasAntesDe: string,
  libro: readonly AsientoFechado[],
  c: ReturnType<typeof crearComparador>,
): Promise<{ enLibro: number; enBase: number; atoradas: number }> {
  const filas = await leerSql<{ nombre: string; piezas: string; filas: number }>(
    baseUrl,
    COMANDAS,
    [desde, hasta],
  );
  const porPieza = new Map(
    (await leerSql<{ nombre: string; por_pieza: boolean }>(baseUrl, TIPOS_DE_VENTA)).map((f) => [
      f.nombre,
      f.por_pieza,
    ]),
  );
  const base = new Map(filas.map((f) => [f.nombre, f]));
  const esperado = new Map<string, number>();
  const nombreDe = (producto: string): string => producto.split(' · ')[0] ?? producto;
  // Por pieza se cuentan piezas (una línea de 2 son dos platillos); por peso o porción, una línea es un platillo.
  for (const a of libro) {
    if (a.asiento.tipo === 'linea') {
      const n = nombreDe(a.asiento.producto);
      esperado.set(
        n,
        (esperado.get(n) ?? 0) + (porPieza.get(n) === false ? 1 : a.asiento.cantidad),
      );
    }
    if (a.asiento.tipo === 'cancelacion') {
      const n = nombreDe(a.asiento.producto);
      esperado.set(n, (esperado.get(n) ?? 0) - 1);
    }
  }
  for (const [producto, n] of esperado) {
    const f = base.get(producto);
    c.comparar(
      'comandas',
      `${producto}: platillos que llegaron a cocina (libro contra comandas de la base)`,
      n,
      porPieza.get(producto) === false ? (f?.filas ?? 0) : Number(f?.piezas ?? 0),
      'servidor',
      'critico',
    );
  }
  const [atoradas] = await leerSql<{ n: number }>(baseUrl, COMANDAS_ATORADAS, [
    desde,
    atoradasAntesDe,
  ]);
  c.comparar(
    'comandas',
    `Comandas sin entregar ni cancelar después de ${String(COMANDA_ATORADA_MIN)} min`,
    0,
    atoradas?.n ?? 0,
    'ux',
    'alto',
  );
  return {
    enLibro: [...esperado.values()].reduce((s, n) => s + n, 0),
    enBase: [...base.values()].reduce((s, f) => s + f.filas, 0),
    atoradas: atoradas?.n ?? 0,
  };
}

export interface OpcionesDeLaHora {
  readonly baseUrl: string;
  readonly salida: string;
  /** El inicio del día (ISO): lo anterior es historia del clon. */
  readonly desde: string;
  readonly ahoraSim: () => Date;
  readonly leerLibro: () => readonly AsientoFechado[];
  /** Reloj real (ms) desde el que se cuentan los 5xx y errores de consola. */
  readonly vigilarDesde: number;
}

interface PasadaDeUnCorte {
  readonly comparaciones: number;
  readonly diferencias: readonly Diferencia[];
  readonly porFuente: RevisionDeLaHora['porFuente'];
  readonly dinero: RevisionDeLaHora['dinero'];
  readonly comandas: RevisionDeLaHora['comandas'];
}

async function pasada(
  o: OpcionesDeLaHora,
  corte: Date,
  linea: ConteoDeInvariantes,
  conInvariantes: boolean,
): Promise<PasadaDeUnCorte> {
  const c = crearComparador();
  const hasta = corte.toISOString();
  const libro = o.leerLibro().filter((a) => a.horaSim <= hasta);
  await arbitrarCajas(o.baseUrl, libro, o.desde, c, hasta);
  await arbitrarElEfectivo(o.baseUrl, o.desde, hasta, libro, c);
  await arbitrarInventario(o.baseUrl, libro, o.desde, c, hasta);
  await arbitrarElStock(o.baseUrl, o.desde, hasta, libro, c);
  const propinasPorMesero = await arbitrarLasPropinas(o.baseUrl, o.desde, libro, c);
  const comandas = await arbitrarLasComandas(
    o.baseUrl,
    o.desde,
    hasta,
    new Date(corte.getTime() - COMANDA_ATORADA_MIN * MINUTO_MS).toISOString(),
    libro,
    c,
  );
  if (conInvariantes) {
    const { conteos, primera } = await contarInvariantes(o.baseUrl);
    const malas = await leerSql<{ folio: string; total: string; impuestos: string }>(
      o.baseUrl,
      IVA_DE_CADA_CUENTA,
      [o.desde, hasta],
    );
    c.comparar(
      'invariantes',
      'C02 (con el IVA que cambia) · total = subtotal − descuento e impuesto de una tasa legal',
      0,
      malas.length,
      'dinero',
      'alto',
    );
    for (const inv of INVARIANTES.filter((x) => x.id !== 'C02')) {
      const ahora = conteos[inv.id] ?? 0;
      if (ahora > (linea[inv.id] ?? 0))
        c.violacion(
          'invariantes',
          `${inv.id} · ${inv.nombre}`,
          `${String(ahora)} filas (línea base ${String(linea[inv.id] ?? 0)}); ejemplo ${primera[inv.id] ?? ''}`,
          inv.id.startsWith('I') ? 'inventario' : 'dinero',
          'alto',
        );
      else
        c.comparar(
          'invariantes',
          `${inv.id} · ${inv.nombre}`,
          'sin violaciones nuevas',
          'sin violaciones nuevas',
        );
    }
  }
  const r = c.resultado(0);
  const cobros = libro.flatMap((a) => (a.asiento.tipo === 'cobro' ? [a.asiento] : []));
  return {
    comparaciones: r.comparaciones,
    diferencias: r.diferencias,
    porFuente: r.porFuente,
    dinero: {
      cobros: cobros.length,
      ventasCentavos: cobros.reduce((s, x) => s + x.totalCentavos, 0),
      propinasCentavos: cobros.reduce((s, x) => s + x.propinaCentavos, 0),
      propinasPorMesero,
    },
    comandas,
  };
}

const clave = (d: Diferencia): string => `${d.fuente}|${d.concepto}`;

const horaDicha = (fecha: Date): string => {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(fecha);
  return partes;
};

/** Una revisión horaria completa (con la segunda mirada si el primer corte no cuadró). */
export async function arbitrarLaHora(
  o: OpcionesDeLaHora,
  linea: ConteoDeInvariantes,
  esperaMs = 15_000,
): Promise<RevisionDeLaHora> {
  const inicio = Date.now();
  const ahora = o.ahoraSim();
  const corte1 = new Date(ahora.getTime() - ATRASO_DEL_CORTE_MIN * MINUTO_MS);
  const primera = await pasada(o, corte1, linea, true);
  let persistentes = primera.diferencias;
  let transitorias = 0;
  if (primera.diferencias.length > 0) {
    await new Promise((r) => setTimeout(r, esperaMs));
    const corte2 = new Date(corte1.getTime() - SEGUNDO_CORTE_MIN * MINUTO_MS);
    const segunda = await pasada(o, corte2, linea, false);
    const enLas2 = new Set(segunda.diferencias.map(clave));
    persistentes = primera.diferencias.filter((d) => enLas2.has(clave(d)));
    transitorias = primera.diferencias.length - persistentes.length;
  }
  return {
    hora: horaDicha(ahora),
    corteIso: corte1.toISOString(),
    comparaciones: primera.comparaciones,
    diferencias: persistentes,
    transitorias,
    porFuente: primera.porFuente,
    dinero: primera.dinero,
    comandas: primera.comandas,
    vigilancia: clasificarLaVigilancia(hechosVigilados(), o.vigilarDesde),
    milisegundos: Date.now() - inicio,
  };
}

/** La línea base de las invariantes que dejó el arranque del día (o vacía). */
export function leerLaLineaBase(salida: string): ConteoDeInvariantes {
  const archivo = join(salida, 'invariantes-base.json');
  return existsSync(archivo)
    ? (JSON.parse(readFileSync(archivo, 'utf8')) as ConteoDeInvariantes)
    : {};
}

/**
 * Una revisión suelta sobre una base ya corrida (para ver cómo cuadra un día que terminó):
 *   node --conditions=react-server qa/simulador/arbitro/hora.ts --app … --base … --pines … --salida … --dia 22 --ahora 2026-11-20T19:30:00-06:00
 */
if (import.meta.main) {
  const { leerEntorno } = await import('../entorno.ts');
  const { abrirLibro } = await import('../libro.ts');
  const { rutaDelLibro } = await import('./salida.ts');
  const entorno = leerEntorno();
  const i = process.argv.indexOf('--ahora');
  const ahora = new Date(process.argv[i + 1] ?? new Date().toISOString());
  const libro = abrirLibro(rutaDelLibro(entorno.salida, entorno.dia), entorno.dia, () => ahora);
  const r = await arbitrarLaHora(
    {
      baseUrl: entorno.baseUrl,
      salida: entorno.salida,
      desde: new Date('2026-11-20T00:00:00-06:00').toISOString(),
      ahoraSim: () => ahora,
      leerLibro: () => libro.leer(),
      vigilarDesde: Date.now(),
    },
    leerLaLineaBase(entorno.salida),
    1_000,
  );
  process.stdout.write(
    `${String(r.comparaciones)} comparaciones, ${String(r.diferencias.length)} diferencias (${String(r.transitorias)} transitorias)\n`,
  );
  for (const d of r.diferencias)
    process.stdout.write(
      `  · [${d.fuente}] ${d.concepto}: esperado ${d.esperado}, real ${d.real}\n`,
    );
}
