/**
 * LA JORNADA CORTA DE BOTS DE DP-24 (por comandos, no por pantallas): 12 mesas, las dos estaciones de
 * preparación, el mesero, la cocina, la Caja nueva (cobros con propina por porcentaje o monto, varias
 * tarjetas, efectivo con cambio y «cambio como propina», «Agregar a la cuenta», para llevar) y el corte
 * con las propinas entregadas desde la caja. Cada bot llama los MISMOS comandos HTTP que las pantallas
 * (`/api/restaurante/…`, `/api/venta/cobrar`, `/api/propinas/liquidar`, `/api/caja/…`) con su sesión de
 * PIN, y la Caja arma los pagos con el mismo `cuentaDelCobro` que usa la pantalla.
 *
 * Sólo lee la base (ids y estados) para saber qué hacer; nunca la escribe. Pasa por el candado.
 *
 *   node --conditions=react-server qa/simulador/jornada-dp24.ts --app http://localhost:3213 \
 *     --base postgres://morphiqpos@localhost:55443/qa_dp24_v3 --reloj D:/mpos-tmp/dp24/verificacion/bots/reloj.json \
 *     --salida D:/mpos-tmp/dp24/verificacion/bots/salida --semilla 2411 [--minutos 160] [--cuentas 44] [--factor 4]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { request, type APIRequestContext } from '@playwright/test';

import { cuentaDelCobro, type PropinaDelCobro } from '../../apps/web/src/venta/cuenta-del-cobro.ts';
import {
  DUENO_DE_PRUEBA,
  EQUIPO_DE_PRUEBA,
} from '../../packages/contracts/src/negocios/equipo-de-prueba.ts';
import { abrirCliente, type Cliente } from './catalogo.ts';
import { exigirCopiaLocal } from './candado.ts';
import { fijarElReloj } from './reloj/fijar.ts';

const SLUG = 'prueba-restaurante';
const INICIO_SIM = '2026-11-21T08:00:00-06:00';

function argumento(nombre: string, porOmision?: string): string {
  const i = process.argv.indexOf(`--${nombre}`);
  const v = (i === -1 ? undefined : process.argv[i + 1]) ?? porOmision;
  if (v === undefined) throw new Error(`Falta --${nombre}`);
  return v;
}

const APP = argumento('app').replace(/\/+$/, '');
const BASE = argumento('base');
const SALIDA = argumento('salida');
const ARCHIVO_RELOJ = argumento('reloj');
const SEMILLA = Number(argumento('semilla', '2411'));
const MINUTOS = Number(argumento('minutos', '160'));
const CUENTAS = Number(argumento('cuentas', '44'));
const FACTOR = Number(argumento('factor', '4'));
const PARA_LLEVAR = Number(argumento('llevar', '8'));

exigirCopiaLocal({ appUrl: APP, databaseUrl: BASE, entorno: process.env });
mkdirSync(SALIDA, { recursive: true });

// ── Azar con semilla ─────────────────────────────────────────────────────────────────────────
function crearAzar(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const azar = crearAzar(SEMILLA);
const entre = (a: number, b: number): number => a + Math.floor(azar() * (b - a + 1));
const elige = <T>(xs: readonly T[]): T => xs[Math.floor(azar() * xs.length)] as T;

// ── El reloj: minutos simulados desde las 8:00 ───────────────────────────────────────────────
let inicioReal = Date.now();
const minutoSim = (): number => ((Date.now() - inicioReal) * FACTOR) / 60_000;
const dormir = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
async function hastaMinuto(m: number): Promise<void> {
  while (minutoSim() < m) await dormir(Math.min(1000, ((m - minutoSim()) * 60_000) / FACTOR));
}
const dormirSim = (min: number): Promise<void> => dormir((min * 60_000) / FACTOR);
async function esperarQue(
  condicion: () => Promise<boolean>,
  maximoMs: number,
  cadaMs = 1500,
): Promise<boolean> {
  const limite = Date.now() + maximoMs;
  while (Date.now() < limite) {
    if (await condicion()) return true;
    await dormir(cadaMs);
  }
  return false;
}
const horaDe = (m: number): string =>
  `${String(8 + Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;

// ── La base (SÓLO lectura) ───────────────────────────────────────────────────────────────────
const pg: Cliente = abrirCliente(BASE);
await pg.connect();
async function sql<T = Record<string, unknown>>(
  texto: string,
  valores: unknown[] = [],
): Promise<T[]> {
  return (await pg.query<T>(texto, valores)).rows;
}

// ── Las llamadas HTTP, con su cuenta ─────────────────────────────────────────────────────────
interface Respuesta {
  readonly estado: number;
  readonly ok: boolean;
  readonly datos: Record<string, unknown>;
  readonly codigo: string;
  readonly mensaje: string;
}
interface Llamada {
  readonly minuto: number;
  readonly quien: string;
  readonly ruta: string;
  readonly estado: number;
  readonly codigo: string;
  readonly mensaje: string;
  readonly entrada: string;
}
const llamadas: Llamada[] = [];

class Sesion {
  readonly quien: string;
  private readonly ctx: APIRequestContext;
  constructor(quien: string, ctx: APIRequestContext) {
    this.quien = quien;
    this.ctx = ctx;
  }
  async post(ruta: string, datos: Record<string, unknown> = {}): Promise<Respuesta> {
    let r: Awaited<ReturnType<APIRequestContext['post']>>;
    let texto = '';
    try {
      r = await this.ctx.post(ruta, {
        headers: { 'idempotency-key': crypto.randomUUID() },
        data: datos,
        timeout: 60_000,
      });
      texto = await r.text();
    } catch (error: unknown) {
      const res = {
        estado: 0,
        ok: false,
        datos: {},
        codigo: 'SIN_RESPUESTA',
        mensaje: String(error).slice(0, 200),
      };
      registrar(this.quien, ruta, res, datos);
      return res;
    }
    let cuerpo: { ok?: boolean; datos?: unknown; error?: { codigo?: string; mensaje?: string } } =
      {};
    try {
      cuerpo = JSON.parse(texto) as typeof cuerpo;
    } catch {
      cuerpo = { ok: false, error: { codigo: 'NO_ES_JSON', mensaje: texto.slice(0, 160) } };
    }
    const d = cuerpo.datos;
    const res: Respuesta = {
      estado: r.status(),
      ok: r.status() === 200 && cuerpo.ok !== false,
      datos:
        typeof d === 'object' && d !== null && !Array.isArray(d)
          ? (d as Record<string, unknown>)
          : (cuerpo as Record<string, unknown>),
      codigo: cuerpo.error?.codigo ?? '',
      mensaje: cuerpo.error?.mensaje ?? '',
    };
    registrar(this.quien, ruta, res, datos);
    return res;
  }
}
function registrar(
  quien: string,
  ruta: string,
  r: Respuesta,
  entrada: Record<string, unknown>,
): void {
  const seguro = { ...entrada };
  for (const clave of ['pin', 'autorizacion']) if (clave in seguro) seguro[clave] = '<oculto>';
  llamadas.push({
    minuto: Math.round(minutoSim()),
    quien,
    ruta,
    estado: r.estado,
    codigo: r.codigo,
    mensaje: r.mensaje.slice(0, 200),
    entrada: r.ok ? '' : JSON.stringify(seguro).slice(0, 600),
  });
}

async function entrar(empleoId: string, nombre: string, pin: string): Promise<Sesion> {
  const ctx = await request.newContext({
    baseURL: APP,
    extraHTTPHeaders: {
      'content-type': 'application/json',
      'x-morphiqpos-request': '1',
      origin: APP,
    },
  });
  const s = new Sesion(nombre, ctx);
  const r = await s.post('/api/auth/entrar', { empleoId, pin, negocio: SLUG });
  if (!r.ok)
    throw new Error(`${nombre} no pudo entrar: ${String(r.estado)} ${r.codigo} ${r.mensaje}`);
  return s;
}

// ── El negocio ───────────────────────────────────────────────────────────────────────────────
interface Producto {
  readonly id: string;
  readonly nombre: string;
  readonly precio: number;
  readonly area: string;
}
interface Mesa {
  readonly id: string;
  readonly numero: number;
}
interface LineaPedida {
  readonly productoId: string;
  readonly nombre: string;
  readonly cantidad: number;
  readonly origen: 'ronda1' | 'ronda2' | 'caja' | 'llevar';
}
interface CobroAnotado {
  readonly ordenId: string;
  readonly tipo: 'mesa' | 'llevar';
  readonly modo: string;
  readonly totalCentavos: number;
  readonly propinaCentavos: number;
  readonly cambioEsperadoCentavos: number;
  readonly pagos: readonly unknown[];
  readonly respuesta: Record<string, unknown>;
  readonly minuto: number;
}
const libro = {
  inicioReal: 0,
  grupos: [] as { mesa: number; ordenId: string; personas: number; lineas: LineaPedida[] }[],
  llevar: [] as { ordenId: string; lineas: LineaPedida[] }[],
  cobros: [] as CobroAnotado[],
  caja: {
    fondoCentavos: 0,
    entradasDeCambioCentavos: 0,
    retirosCentavos: 0,
    liquidaciones: [] as {
      minuto: number;
      propinasCentavos: number;
      respuesta: Record<string, unknown>;
    }[],
    cierre: null as null | { contadoCentavos: number; respuesta: Record<string, unknown> },
  },
  mermas: [] as { insumoId: string; insumo: string; cantidad: number; unidad: string }[],
  pendientesDeCierre: [] as string[],
  existenciasIniciales: {} as Record<string, number>,
};

const orgId = (
  await sql<{ id: string }>('select id from organizaciones where slug = $1', [SLUG])
)[0]?.id;
if (orgId === undefined) throw new Error(`No existe el negocio ${SLUG} en la base.`);

const productos: Producto[] = (
  await sql<{ id: string; nombre: string; precio: string; area: string }>(
    `select id, nombre, precio_venta_centavos::text as precio, coalesce(area_preparacion,'cocina') as area
       from productos where organizacion_id = $1 and activo and visible_en_pos and tipo_venta = 'precio_fijo'
      order by nombre`,
    [orgId],
  )
).map((p) => ({ id: p.id, nombre: p.nombre, precio: Number(p.precio), area: p.area }));
const mesas: Mesa[] = (
  await sql<{ id: string; numero: number }>(
    'select id, numero from mesas where organizacion_id = $1 and activa order by numero',
    [orgId],
  )
).map((m) => ({ id: m.id, numero: Number(m.numero) }));
const personal = await sql<{ id: string; nombre: string; rol: string }>(
  `select e.id, p.nombre, e.rol from empleos e join personas p on p.id = e.persona_id
    where e.organizacion_id = $1 and e.activo`,
  [orgId],
);
const empleoDe = (nombre: string): string => {
  const f = personal.find((p) => p.nombre === nombre);
  if (f === undefined) throw new Error(`No existe «${nombre}» en el negocio.`);
  return f.id;
};
const pinDe = (nombre: string): string => {
  if (nombre === DUENO_DE_PRUEBA.nombre) return DUENO_DE_PRUEBA.pin;
  const f = EQUIPO_DE_PRUEBA.restaurante.find((e) => e.nombre === nombre);
  if (f === undefined) throw new Error(`No hay PIN de prueba para «${nombre}».`);
  return f.pin;
};

// ── El mesero ────────────────────────────────────────────────────────────────────────────────
const mesasLibres = new Set(mesas.map((m) => m.numero));
let mesero!: Sesion;
let cajera!: Sesion;
const colaDeCobro: {
  ordenId: string;
  mesa: number;
  agregarEnCaja: boolean;
  lineas: LineaPedida[];
}[] = [];
const cobradas = new Set<string>();
let gruposTerminados = 0;

function armarLineas(personas: number, origen: LineaPedida['origen']): LineaPedida[] {
  const n = Math.min(5, entre(1, Math.max(1, personas)) + (azar() < 0.4 ? 1 : 0));
  const elegidos = new Set<number>();
  while (elegidos.size < n) elegidos.add(Math.floor(azar() * productos.length));
  return [...elegidos].map((i) => {
    const p = productos[i] as Producto;
    return { productoId: p.id, nombre: p.nombre, cantidad: azar() < 0.2 ? 2 : 1, origen };
  });
}
const comoLineasApi = (ls: LineaPedida[]): Record<string, unknown>[] =>
  ls.map((l) => ({
    productoId: l.productoId,
    cantidad: String(l.cantidad),
    ...(azar() < 0.15 ? { notas: 'sin picante' } : {}),
  }));

async function itemsSinEntregar(ordenId: string): Promise<number> {
  const r = await sql<{ n: string }>(
    `select count(*)::text as n from comanda_items ci join comandas c on c.id = ci.comanda_id
      where c.orden_id = $1 and ci.estado not in ('entregado','cancelado')`,
    [ordenId],
  );
  return Number(r[0]?.n ?? 0);
}

async function atenderGrupo(numero: number, llegaEn: number): Promise<void> {
  await hastaMinuto(llegaEn);
  const personas = entre(1, 6);
  let numeroMesa: number | undefined;
  await esperarQue(
    async () => {
      const libre = [...mesasLibres][0];
      if (libre === undefined) return false;
      numeroMesa = libre;
      mesasLibres.delete(libre);
      return true;
    },
    ((40 * 60_000) / FACTOR) * 4,
  );
  if (numeroMesa === undefined) {
    gruposTerminados += 1;
    return;
  }
  const mesa = mesas.find((m) => m.numero === numeroMesa) as Mesa;
  const liberar = (): void => {
    mesasLibres.add(mesa.numero);
    gruposTerminados += 1;
  };
  const abierta = await mesero.post('/api/restaurante/abrir-mesa', { mesaId: mesa.id, personas });
  const ordenId = abierta.datos['ordenId'];
  if (!abierta.ok || typeof ordenId !== 'string') {
    liberar();
    return;
  }
  const grupo = { mesa: mesa.numero, ordenId, personas, lineas: [] as LineaPedida[] };
  libro.grupos.push(grupo);
  const pedir = async (origen: 'ronda1' | 'ronda2'): Promise<boolean> => {
    const ls = armarLineas(personas, origen);
    const r = await mesero.post('/api/restaurante/enviar-pedido', {
      ordenId,
      lineas: comoLineasApi(ls),
    });
    if (r.ok) grupo.lineas.push(...ls);
    return r.ok;
  };
  await dormirSim(entre(1, 4));
  if (!(await pedir('ronda1'))) {
    await mesero.post('/api/restaurante/liberar-mesa', { mesaId: mesa.id });
    liberar();
    return;
  }
  const horaDeComer = (600_000 / FACTOR) * 8;
  await esperarQue(async () => (await itemsSinEntregar(ordenId)) === 0, horaDeComer, 2000);
  await dormirSim(entre(8, 20));
  if (azar() < 0.4 && (await pedir('ronda2'))) {
    await esperarQue(async () => (await itemsSinEntregar(ordenId)) === 0, horaDeComer, 2000);
    await dormirSim(entre(6, 15));
  }
  // El mesero pide la cuenta y, a veces, deja elegida la propina.
  const eleccion = azar();
  const propina =
    eleccion < 0.35
      ? { propinaTipo: 'porcentaje', propinaPuntosBase: elige([1000, 1000, 1500]) }
      : eleccion < 0.45
        ? { propinaTipo: 'sin_propina' }
        : eleccion < 0.55
          ? { propinaTipo: 'decidir_en_caja' }
          : {};
  const cuenta = await mesero.post('/api/restaurante/solicitar-cuenta', { ordenId, ...propina });
  if (!cuenta.ok) {
    // La cuenta quedó viva: la Caja la cobra igual (no se pierde la mesa).
    libro.pendientesDeCierre.push(
      `solicitar-cuenta ${ordenId}: ${cuenta.codigo} ${cuenta.mensaje}`,
    );
  }
  colaDeCobro.push({
    ordenId,
    mesa: mesa.numero,
    agregarEnCaja: azar() < 0.2,
    lineas: grupo.lineas,
  });
  const pagada = await esperarQue(
    async () => cobradas.has(ordenId),
    ((90 * 60_000) / FACTOR) * 3,
    2000,
  );
  if (pagada) {
    const l = await mesero.post('/api/restaurante/liberar-mesa', { mesaId: mesa.id });
    if (!l.ok)
      libro.pendientesDeCierre.push(`liberar-mesa ${mesa.numero}: ${l.codigo} ${l.mensaje}`);
  }
  liberar();
  void numero;
}

/** El mesero entrega lo que sale listo (platillo por platillo, por comanda), con su camino a la mesa. */
async function entregador(): Promise<void> {
  const vistas = new Map<string, number>();
  while (!terminoLaJornada) {
    const listas = await sql<{ id: string; orden_id: string; canal: string | null }>(
      `select c.id, c.orden_id, o.canal from comandas c join ordenes o on o.id = c.orden_id
        where c.organizacion_id = $1 and c.estado = 'listo' and coalesce(o.canal,'aqui') <> 'llevar'`,
      [orgId],
    );
    for (const c of listas) {
      const desde = vistas.get(c.id) ?? minutoSim();
      vistas.set(c.id, desde);
      if (minutoSim() - desde < entre(1, 3)) continue;
      const r = await mesero.post('/api/restaurante/entregar-pedidos', {
        ordenId: c.orden_id,
        comandaIds: [c.id],
      });
      if (r.ok) vistas.delete(c.id);
    }
    await dormir(1500);
  }
}
async function comandasVivasDeMesa(): Promise<number> {
  const r = await sql<{ n: string }>(
    `select count(*)::text as n from comandas c join ordenes o on o.id = c.orden_id
      where c.organizacion_id = $1 and c.estado in ('nuevo','en_preparacion','listo') and coalesce(o.canal,'aqui') <> 'llevar'`,
    [orgId],
  );
  return Number(r[0]?.n ?? 0);
}

// ── La cocina: platillo por platillo ─────────────────────────────────────────────────────────
async function estacion(
  nombre: string,
  sesion: Sesion,
  estaciones: readonly string[],
): Promise<void> {
  const enPreparacion = new Map<string, { comandaId: string; listoEn: number }>();
  const vistos = new Map<string, number>();
  for (;;) {
    const filas = await sql<{ id: string; comanda_id: string; estado: string }>(
      `select ci.id, ci.comanda_id, ci.estado from comanda_items ci join comandas c on c.id = ci.comanda_id
        where ci.organizacion_id = $1 and ci.estado in ('pendiente','en_preparacion')
          and c.estado in ('nuevo','en_preparacion') and c.estacion_nombre = any($2::text[])
        order by ci.created_at`,
      [orgId, estaciones],
    );
    for (const it of filas) {
      if (it.estado === 'pendiente' && !enPreparacion.has(it.id)) {
        const desde = vistos.get(it.id) ?? minutoSim();
        vistos.set(it.id, desde);
        if (minutoSim() - desde < azar() * 2) continue;
        const r = await sesion.post('/api/restaurante/transicionar-pedido', {
          comandaId: it.comanda_id,
          comandaItemId: it.id,
          estado: 'en_preparacion',
        });
        if (r.ok) {
          const prep = nombre === 'Barra' ? entre(1, 4) : entre(4, 12);
          enPreparacion.set(it.id, { comandaId: it.comanda_id, listoEn: minutoSim() + prep });
        }
      } else if (it.estado === 'en_preparacion') {
        if (!enPreparacion.has(it.id))
          enPreparacion.set(it.id, {
            comandaId: it.comanda_id,
            listoEn: minutoSim() + entre(2, 6),
          });
        const e = enPreparacion.get(it.id);
        if (e !== undefined && minutoSim() >= e.listoEn) {
          const r = await sesion.post('/api/restaurante/transicionar-pedido', {
            comandaId: e.comandaId,
            comandaItemId: it.id,
            estado: 'listo',
          });
          if (r.ok) enPreparacion.delete(it.id);
        }
      }
    }
    await dormir(1200);
    if (terminoLaJornada && filas.length === 0) return;
  }
}
let terminoLaJornada = false;

// ── La Caja ──────────────────────────────────────────────────────────────────────────────────
const MODOS = [
  'efectivo-exacto',
  'efectivo-cambio',
  'cambio-como-propina',
  'tarjeta',
  'tarjeta-dividida',
  'mixto',
  'transferencia',
] as const;
let turnoDeModo = 0;

interface OrdenDelCobro {
  readonly total: number;
  readonly version: number;
  readonly propinaTipo: string | null;
  readonly propinaPuntos: number | null;
}
async function leerOrden(ordenId: string): Promise<OrdenDelCobro> {
  const r = await sql<{
    total: string;
    version: number;
    propina_tipo: string | null;
    propina_puntos_base: number | null;
  }>(
    'select total_centavos::text as total, version, propina_tipo, propina_puntos_base from ordenes where id = $1',
    [ordenId],
  );
  const o = r[0];
  return {
    total: Number(o?.total ?? 0),
    version: Number(o?.version ?? 0),
    propinaTipo: o?.propina_tipo ?? null,
    propinaPuntos: o?.propina_puntos_base ?? null,
  };
}

function propinaDeCaja(orden: OrdenDelCobro): PropinaDelCobro {
  if (orden.propinaTipo === 'porcentaje' && orden.propinaPuntos !== null)
    return { tipo: 'porcentaje', puntosBase: orden.propinaPuntos };
  if (orden.propinaTipo === 'sin_propina') return { tipo: 'sin_propina' };
  if (orden.propinaTipo === 'monto_manual' && orden.propinaPuntos !== null)
    return { tipo: 'porcentaje', puntosBase: orden.propinaPuntos };
  const x = azar();
  if (x < 0.4) return { tipo: 'porcentaje', puntosBase: elige([1000, 1500, 2000]) };
  if (x < 0.7) return { tipo: 'monto', centavos: elige([1000, 2000, 3500, 5000]) };
  return { tipo: 'sin_propina' };
}

async function cobrarCuenta(ordenId: string, tipo: 'mesa' | 'llevar'): Promise<boolean> {
  const orden = await leerOrden(ordenId);
  const propina = propinaDeCaja(orden);
  const modo = MODOS[turnoDeModo % MODOS.length] as (typeof MODOS)[number];
  turnoDeModo += 1;
  const total = orden.total;
  const base =
    propina.tipo === 'monto'
      ? propina.centavos
      : propina.tipo === 'porcentaje'
        ? Math.round((total * propina.puntosBase) / 10_000)
        : 0;
  const aCobrarBase = total + base;
  const billete = Math.ceil(aCobrarBase / 10_000) * 10_000 + (azar() < 0.5 ? 0 : 5_000);
  const tecleado = {
    modo:
      modo.startsWith('efectivo') || modo === 'cambio-como-propina'
        ? ('efectivo' as const)
        : modo === 'mixto'
          ? ('mixto' as const)
          : modo === 'transferencia'
            ? ('transferencia' as const)
            : ('tarjeta' as const),
    recibidoCentavos:
      modo === 'efectivo-exacto'
        ? null
        : modo === 'efectivo-cambio' || modo === 'cambio-como-propina'
          ? billete
          : modo === 'mixto'
            ? Math.max(0, aCobrarBase - Math.floor(aCobrarBase * 0.4)) + 2_000
            : null,
    tarjetasCentavos:
      modo === 'tarjeta-dividida'
        ? [Math.floor(aCobrarBase / 2), aCobrarBase - Math.floor(aCobrarBase / 2)]
        : modo === 'mixto'
          ? [Math.floor(aCobrarBase * 0.4)]
          : [],
    transferenciaCentavos: 0,
    cambioComoPropina: modo === 'cambio-como-propina',
  };
  const cuenta = cuentaDelCobro(total, propina, tecleado);
  if (cuenta.tropiezo !== null || cuenta.pagos.length === 0) {
    libro.pendientesDeCierre.push(`SIMULADOR · ${ordenId} ${modo}: ${String(cuenta.tropiezo)}`);
    return false;
  }
  const cuerpo: Record<string, unknown> = {
    ordenId,
    pagos: cuenta.pagos,
    totalEsperadoCentavos: total,
    versionDeLaCuenta: orden.version,
    propinaTipo: cuenta.propinaAEnviar.tipo,
    propinaPuntosBase: cuenta.propinaAEnviar.puntosBase,
    propinaOrigen: 'caja',
    ...(tipo === 'llevar' ? { canal: 'llevar' } : {}),
  };
  const r = await cajera.post('/api/venta/cobrar', cuerpo);
  if (!r.ok) return false;
  libro.cobros.push({
    ordenId,
    tipo,
    modo,
    totalCentavos: total,
    propinaCentavos: cuenta.propinaCentavos,
    cambioEsperadoCentavos: cuenta.cambioCentavos,
    pagos: cuenta.pagos,
    respuesta: r.datos,
    minuto: Math.round(minutoSim()),
  });
  cobradas.add(ordenId);
  return true;
}

async function cobrarLaCola(): Promise<void> {
  const siguiente = colaDeCobro.shift();
  if (siguiente === undefined) return;
  await dormirSim(entre(1, 3));
  if (siguiente.agregarEnCaja) {
    const extra = armarLineas(2, 'caja').slice(0, 2);
    const r = await cajera.post('/api/restaurante/agregar-en-caja', {
      ordenId: siguiente.ordenId,
      lineas: comoLineasApi(extra),
      paraLlevar: azar() < 0.5,
    });
    if (r.ok) {
      const g = libro.grupos.find((x) => x.ordenId === siguiente.ordenId);
      g?.lineas.push(...extra);
    } else
      libro.pendientesDeCierre.push(
        `agregar-en-caja ${siguiente.ordenId}: ${r.codigo} ${r.mensaje}`,
      );
  }
  let hecho = await cobrarCuenta(siguiente.ordenId, 'mesa');
  if (!hecho) {
    // Una segunda oportunidad con la cuenta como quedó (por si la versión cambió).
    await dormir(800);
    hecho = await cobrarCuenta(siguiente.ordenId, 'mesa');
  }
  if (!hecho)
    libro.pendientesDeCierre.push(
      `la mesa ${String(siguiente.mesa)} (${siguiente.ordenId}) no se pudo cobrar`,
    );
}

const llevarPendientes: string[] = [];
async function pedidoParaLlevar(minuto: number): Promise<void> {
  await hastaMinuto(minuto);
  const ls = armarLineas(3, 'llevar');
  const r = await cajera.post('/api/restaurante/armar-para-llevar', {
    nombrePedido: `Cliente ${String(entre(1, 99))}`,
    lineas: comoLineasApi(ls),
  });
  const ordenId = r.datos['ordenId'];
  if (!r.ok || typeof ordenId !== 'string') return;
  libro.llevar.push({ ordenId, lineas: ls });
  const ok = await cobrarCuenta(ordenId, 'llevar');
  if (ok) llevarPendientes.push(ordenId);
  else libro.pendientesDeCierre.push(`para llevar ${ordenId} no se cobró`);
}

async function entregarParaLlevar(): Promise<void> {
  for (const ordenId of [...llevarPendientes]) {
    const r = await sql<{ n: string }>(
      `select count(*)::text as n from comanda_items ci join comandas c on c.id = ci.comanda_id
        where c.orden_id = $1 and ci.estado not in ('listo','entregado','cancelado')`,
      [ordenId],
    );
    if (Number(r[0]?.n ?? 1) > 0) continue;
    const e = await cajera.post('/api/restaurante/entregar-para-llevar', { ordenId });
    if (e.ok || e.codigo !== '') llevarPendientes.splice(llevarPendientes.indexOf(ordenId), 1);
  }
}

async function autorizar(montoCentavos: number): Promise<string | undefined> {
  const r = await cajera.post('/api/identidad/supervisor', {
    empleoId: empleoDe('Beatriz'),
    pin: pinDe('Beatriz'),
    para: 'retiro',
    montoCentavos,
  });
  const t = r.datos['autorizacion'] ?? r.datos['token'];
  return typeof t === 'string' ? t : undefined;
}

async function propinasSinLiquidar(): Promise<number> {
  const r = await sql<{ t: string }>(
    `select coalesce(sum(p.propina_centavos),0)::text as t
       from pagos p join ordenes o on o.id = p.orden_id
      where o.organizacion_id = $1 and o.estado in ('pagada','parcialmente_reembolsada') and p.estado = 'confirmado'
        and o.propina_liquidacion_id is null`,
    [orgId],
  );
  return Number(r[0]?.t ?? 0);
}

async function liquidarDesdeLaCaja(): Promise<void> {
  const monto = await propinasSinLiquidar();
  if (monto <= 0) return;
  const auth = await autorizar(monto);
  const r = await cajera.post('/api/propinas/liquidar', {
    rangoTipo: 'dia',
    desde: '2026-11-21T00:00:00-06:00',
    hasta: '2026-11-21T23:59:59-06:00',
    entregarDeLaCaja: true,
    ...(auth === undefined ? {} : { autorizacion: auth }),
    notas: 'Entrega desde la caja (jornada de bots)',
  });
  libro.caja.liquidaciones.push({
    minuto: Math.round(minutoSim()),
    propinasCentavos: monto,
    respuesta: { ok: r.ok, estado: r.estado, codigo: r.codigo, mensaje: r.mensaje, ...r.datos },
  });
}

async function caja(): Promise<void> {
  const fondo = 150_000;
  const a = await cajera.post('/api/caja/abrir', { fondoInicialCentavos: fondo });
  if (!a.ok) throw new Error(`La caja no abrió: ${a.codigo} ${a.mensaje}`);
  libro.caja.fondoCentavos = fondo;
  const hitos: { en: number; hacer: () => Promise<void> }[] = [
    {
      en: 40,
      hacer: async () => {
        const r = await cajera.post('/api/caja/entrada-cambio', {
          monedasCentavos: 20_000,
          chicosCentavos: 30_000,
          origen: 'banco',
          motivo: 'Cambio para el turno',
        });
        if (r.ok) libro.caja.entradasDeCambioCentavos += 50_000;
      },
    },
    {
      en: 70,
      hacer: async () => {
        const r = await cajera.post('/api/caja/movimiento', {
          tipo: 'retiro',
          montoCentavos: -60_000,
          motivo: 'Pago a proveedor de tortillas',
        });
        if (r.ok) libro.caja.retirosCentavos += 60_000;
      },
    },
    ...(process.argv.includes('--sin-liquidacion-intermedia')
      ? []
      : [{ en: 95, hacer: liquidarDesdeLaCaja }]),
    {
      en: 125,
      hacer: async () => {
        const auth = await autorizar(120_000);
        const r = await cajera.post('/api/caja/movimiento', {
          tipo: 'retiro',
          montoCentavos: -120_000,
          motivo: 'Al banco, depósito del día',
          ...(auth === undefined ? {} : { autorizacion: auth }),
        });
        if (r.ok) libro.caja.retirosCentavos += 120_000;
      },
    },
  ];
  while (!terminoLaJornada) {
    const h = hitos[0];
    if (h !== undefined && minutoSim() >= h.en) {
      hitos.shift();
      await h.hacer();
    }
    await cobrarLaCola();
    await entregarParaLlevar();
    await dormir(700);
  }
  // Cierre: lo que quede por cobrar, la entrega de las propinas y el corte.
  for (let i = 0; i < 200 && colaDeCobro.length > 0; i += 1) await cobrarLaCola();
  await esperarQue(async () => {
    await entregarParaLlevar();
    return llevarPendientes.length === 0;
  }, 8 * 60_000);
  await liquidarDesdeLaCaja();
}

async function cerrarLaCaja(): Promise<void> {
  const esperado = await sql<{ t: string }>(
    `select coalesce(sum(m.monto_centavos),0)::text as t from movimientos_caja m
      join sesiones_caja s on s.id = m.sesion_caja_id where s.organizacion_id = $1 and s.estado = 'abierta'`,
    [orgId],
  );
  const contado = Number(esperado[0]?.t ?? 0) - (azar() < 0.5 ? 0 : 500);
  const r = await cajera.post('/api/caja/cerrar', {
    efectivoContadoCentavos: Math.max(0, contado),
    notas: 'Corte de la jornada de bots',
  });
  libro.caja.cierre = {
    contadoCentavos: contado,
    respuesta: { ok: r.ok, estado: r.estado, codigo: r.codigo, mensaje: r.mensaje, ...r.datos },
  };
}

// ── El almacén y la gerente ──────────────────────────────────────────────────────────────────
async function almacenista(almacen: Sesion): Promise<void> {
  const alm = (
    await sql<{ id: string }>(
      'select id from almacenes where organizacion_id = $1 order by created_at limit 1',
      [orgId],
    )
  )[0]?.id;
  const motivo = 'caducado';
  const candidatos = [
    ['Tortilla de maíz', 12, 'pieza'],
    ['Aguacate', 300, 'g'],
    ['Jitomate', 500, 'g'],
  ] as const;
  for (const [i, [nombre, cantidad, unidad]] of candidatos.entries()) {
    await hastaMinuto(50 + i * 45);
    const ins = (
      await sql<{ id: string }>(
        'select id from insumos where organizacion_id = $1 and nombre = $2',
        [orgId, nombre],
      )
    )[0]?.id;
    if (ins === undefined || alm === undefined) continue;
    const r = await almacen.post('/api/inventario/merma', {
      almacenId: alm,
      insumoId: ins,
      estrategia: 'insumo',
      cantidad: String(cantidad),
      unidad,
      motivoClave: motivo,
      nota: 'Merma de la jornada de bots',
    });
    if (r.ok) libro.mermas.push({ insumoId: ins, insumo: nombre, cantidad, unidad });
  }
}

// ── La jornada ───────────────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const iniciales = await sql<{ nombre: string; c: string }>(
    `select i.nombre, coalesce(sum(x.cantidad),0)::text c from insumos i left join existencias x on x.insumo_id = i.id
      where i.organizacion_id = $1 group by 1`,
    [orgId],
  );
  libro.existenciasIniciales = Object.fromEntries(iniciales.map((i) => [i.nombre, Number(i.c)]));
  const relojDb = abrirCliente(BASE);
  await relojDb.connect();
  inicioReal = Date.now();
  libro.inicioReal = inicioReal;
  await fijarElReloj(relojDb, ARCHIVO_RELOJ, new Date(INICIO_SIM), FACTOR, inicioReal);
  await relojDb.end();
  const rec = {
    mesero: await entrar(empleoDe('Lupita'), 'Lupita (mesero)', pinDe('Lupita')),
    cajera: await entrar(empleoDe('Rosa'), 'Rosa (caja)', pinDe('Rosa')),
    cocina: await entrar(empleoDe('Toño'), 'Toño (cocina caliente)', pinDe('Toño')),
    barra: await entrar(empleoDe('Toño'), 'Toño (barra)', pinDe('Toño')),
    almacen: await entrar(empleoDe('Nacho'), 'Nacho (almacén)', pinDe('Nacho')),
  };
  if (process.argv.includes('--estaciones')) {
    // El negocio de prueba no asigna ninguna categoría a una estación: todo cae en «Cocina general».
    // La dueña reparte las categorías entre las dos estaciones, como lo haría desde Configuración.
    const dueña = await entrar(
      empleoDe(DUENO_DE_PRUEBA.nombre),
      'Dueña (configuración)',
      pinDe(DUENO_DE_PRUEBA.nombre),
    );
    const est = await sql<{ id: string; nombre: string }>(
      'select id, nombre from estaciones_preparacion where organizacion_id = $1',
      [orgId],
    );
    const cats = await sql<{ id: string; nombre: string }>(
      "select id, nombre from categorias where organizacion_id = $1 and tipo = 'producto'",
      [orgId],
    );
    for (const c of cats) {
      const barra = c.nombre === 'Bebidas' || c.nombre === 'Cervezas';
      const e = est.find((x) => x.nombre === (barra ? 'Barra' : 'Cocina caliente'));
      if (e === undefined) continue;
      const r = await dueña.post('/api/datos/escribir', {
        entidad: 'CategoriaProducto',
        operacion: 'update',
        id: c.id,
        datos: { estacion_preparacion_id: e.id },
      });
      console.log(
        `Categoría ${c.nombre} → ${e.nombre}: ${r.ok ? 'ok' : `${String(r.estado)} ${r.codigo} ${r.mensaje}`}`,
      );
    }
  }
  mesero = rec.mesero;
  cajera = rec.cajera;
  console.log(
    `Jornada de bots: ${String(MINUTOS)} min simulados ×${String(FACTOR)}, ${String(mesas.length)} mesas, ${String(CUENTAS)} cuentas de mesa y ${String(PARA_LLEVAR)} para llevar.`,
  );

  const llegadas = Array.from({ length: CUENTAS }, () => {
    const pico = azar() < 0.5;
    return Math.round(pico ? entre(40, 110) : entre(0, MINUTOS - 55));
  }).sort((a, b) => a - b);
  const llevar = Array.from({ length: PARA_LLEVAR }, () => entre(10, MINUTOS - 25)).sort(
    (a, b) => a - b,
  );

  const cocinas = [
    estacion('Cocina caliente', rec.cocina, ['Cocina general', 'Cocina caliente']),
    estacion('Barra', rec.barra, ['Barra']),
  ];
  const cajaTarea = caja();
  const entrega = entregador();
  const almacenTarea = almacenista(rec.almacen);
  const latido = (async () => {
    while (!terminoLaJornada) {
      await dormir(60_000);
      console.log(
        `[${horaDe(minutoSim())}] mesas libres ${String(mesasLibres.size)} · grupos ${String(libro.grupos.length)} · cobros ${String(libro.cobros.length)} · 5xx ${String(llamadas.filter((l) => l.estado >= 500).length)} · cola de caja ${String(colaDeCobro.length)}`,
      );
      writeFileSync(join(SALIDA, 'llamadas-parcial.json'), JSON.stringify(llamadas));
      writeFileSync(join(SALIDA, 'libro-parcial.json'), JSON.stringify(libro));
    }
  })();
  const grupos = llegadas.map((m, i) => atenderGrupo(i + 1, m));
  const llevares = llevar.map((m) => pedidoParaLlevar(m));
  await Promise.all(grupos);
  await Promise.all(llevares);
  // Hasta que cocina y entrega vacíen lo vivo.
  await esperarQue(async () => (await comandasVivasDeMesa()) === 0, 15 * 60_000);
  terminoLaJornada = true;
  await cajaTarea;
  await Promise.all([...cocinas, entrega, almacenTarea]);
  await cerrarLaCaja();
  void latido;
  console.log(
    `Fin: ${horaDe(minutoSim())} simuladas (${String(Math.round((Date.now() - inicioReal) / 60000))} min reales).`,
  );
  writeFileSync(join(SALIDA, 'libro.json'), JSON.stringify(libro, null, 1));
  writeFileSync(join(SALIDA, 'llamadas.json'), JSON.stringify(llamadas, null, 1));
  const porEstado = new Map<string, number>();
  for (const l of llamadas) {
    const k = `${l.ruta} ${String(l.estado)} ${l.codigo}`;
    porEstado.set(k, (porEstado.get(k) ?? 0) + 1);
  }
  const cuentaPorRuta = [...porEstado.entries()]
    .sort()
    .map(([k, n]) => `${String(n).padStart(5)}  ${k}`)
    .join('\n');
  writeFileSync(join(SALIDA, 'llamadas-por-ruta.txt'), cuentaPorRuta);
  console.log(cuentaPorRuta);
  await pg.end();
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error);
    try {
      writeFileSync(join(SALIDA, 'libro-parcial.json'), JSON.stringify(libro, null, 1));
      writeFileSync(join(SALIDA, 'llamadas-parcial.json'), JSON.stringify(llamadas, null, 1));
    } catch {
      // nada
    }
    process.exit(1);
  },
);
