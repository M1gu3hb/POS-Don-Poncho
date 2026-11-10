import 'server-only';

import { conTransaccion, type Transaccion } from '@morphiqpos/data';

import { resolverAmbitoDeEstacion, type AmbitoDeEstacion } from './ambito.ts';

/** Lo que el teléfono necesita para cocinar, y nada más (R33): ni precios, ni ids de nadie. */
export interface ComandaDelTelefono {
  readonly id: string;
  readonly estado: 'nuevo' | 'en_preparacion';
  readonly mesaNumero: number | null;
  readonly nombrePedido: string | null;
  /** DP-16 · El canal de la orden y su «Pedido para llevar N». */
  readonly canal: string;
  readonly numeroPedido: number | null;
  readonly creadaEn: string;
  readonly notas: string | null;
  readonly alergias: string | null;
  readonly celebracion: boolean;
  readonly tipoCelebracion: string | null;
  readonly platillos: readonly {
    readonly nombre: string;
    readonly cantidad: string;
    /** DP-14 · Lo que se vende por peso se dice «½ kg», no «0.5» (sólo si es por peso: ningún tipo de venta sale al teléfono). */
    readonly porPeso: boolean;
    readonly unidadVariable: string | null;
    readonly cantidadVariable: string | null;
    readonly notas: string | null;
    /** DP-16.2.3 · Lo que eligió el cliente, aparte de la nota: grupo y nombres, sin precio. */
    readonly opciones: readonly OpcionDelPlatillo[];
  }[];
}

export interface OpcionDelPlatillo {
  readonly grupo: string;
  readonly nombres: readonly string[];
}

/** DP-16.2.3 · Una tira por mesa o pedido de la estación. */
export interface MesaDelTelefono {
  readonly comandaId: string;
  readonly estado: 'nuevo' | 'en_preparacion' | 'listo';
  readonly mesaNumero: number | null;
  readonly nombrePedido: string | null;
  readonly canal: string;
  readonly numeroPedido: number | null;
}

export interface PantallaDelTelefono {
  readonly estacion: { readonly nombre: string; readonly color: string | null };
  readonly vigenteHasta: string;
  /** La pendiente MÁS RECIENTE de la estación; `null` si no hay ninguna. */
  readonly comanda: ComandaDelTelefono | null;
  /** Cuántas quedan pendientes en total, ésta incluida. */
  readonly pendientes: number;
  /** DP-16.2.3 · TODAS las activas (nuevo y en preparación), de la más vieja a la más nueva, con tope. */
  readonly comandas: readonly ComandaDelTelefono[];
  /** DP-16.2.3 · La tira de mesas/pedidos con su estado, incluidas las listas sin entregar. */
  readonly mesas: readonly MesaDelTelefono[];
}

/** Cuántas comandas activas caben en el teléfono: más no se leen en un carrusel. */
export const TOPE_DE_COMANDAS = 40;

const PENDIENTES = ['nuevo', 'en_preparacion'] as const;
const PARA_LA_TIRA = ['nuevo', 'en_preparacion', 'listo'] as const;
/** Las listas sin entregar que caben en la tira: más viejas que esto ya no son de este turno. */
const HORAS_DE_UNA_LISTA = 6;

/** La pantalla del teléfono de una estación. Sólo lee: no audita, como el portal. */
export async function pantallaDelTelefono(peticion: {
  readonly token: string;
  readonly organizacionId: string;
  readonly pimienta: string;
}): Promise<PantallaDelTelefono> {
  return conTransaccion(async (tx) => {
    const ahora = new Date();
    const ambito = await resolverAmbitoDeEstacion(tx, { ...peticion, ahora });
    const [reciente, pendientes, comandas, mesas] = await Promise.all([
      cargarComandas(tx, ambito, 'desc', 1),
      cuantasPendientes(tx, ambito),
      cargarComandas(tx, ambito, 'asc', TOPE_DE_COMANDAS),
      laTiraDeMesas(tx, ambito, ahora),
    ]);
    return {
      estacion: { nombre: ambito.estacionNombre, color: ambito.estacionColor },
      vigenteHasta: ambito.vigenteHasta.toISOString(),
      comanda: reciente[0] ?? null,
      pendientes,
      comandas,
      mesas,
    };
  });
}

async function cuantasPendientes(tx: Transaccion, ambito: AmbitoDeEstacion): Promise<number> {
  const fila = await tx
    .selectFrom('comandas')
    .select((eb) => eb.fn.countAll<string>().as('total'))
    .where('organizacion_id', '=', ambito.organizacionId)
    .where('estacion_preparacion_id', '=', ambito.estacionId)
    .where('estado', 'in', PENDIENTES)
    .executeTakeFirst();
  return Number(fila?.total ?? 0);
}

/** Una tira por comanda de la estación: pendientes y listas sin entregar, de la más vieja a la nueva. */
async function laTiraDeMesas(
  tx: Transaccion,
  ambito: AmbitoDeEstacion,
  ahora: Date,
): Promise<readonly MesaDelTelefono[]> {
  const desde = new Date(ahora.getTime() - HORAS_DE_UNA_LISTA * 3_600_000);
  const filas = await tx
    .selectFrom('comandas as c')
    .leftJoin('mesas as m', 'm.id', 'c.mesa_id')
    .leftJoin('ordenes as o', 'o.id', 'c.orden_id')
    .select([
      'c.id',
      'c.estado',
      'm.numero as mesa_numero',
      'o.nombre_pedido',
      'o.canal',
      'o.numero_pedido',
    ])
    .where('c.organizacion_id', '=', ambito.organizacionId)
    .where('c.estacion_preparacion_id', '=', ambito.estacionId)
    .where('c.estado', 'in', PARA_LA_TIRA)
    .where('c.created_at', '>=', desde)
    .orderBy('c.created_at', 'asc')
    .orderBy('c.id', 'asc')
    .limit(TOPE_DE_COMANDAS * 2)
    .execute();
  return filas.map((f) => ({
    comandaId: f.id,
    estado: estadoDeLaTira(f.estado),
    mesaNumero: f.mesa_numero ?? null,
    nombrePedido: primeraPalabra(f.nombre_pedido),
    canal: f.canal ?? 'aqui',
    numeroPedido: f.numero_pedido ?? null,
  }));
}

function estadoDeLaTira(estado: string): MesaDelTelefono['estado'] {
  if (estado === 'listo') return 'listo';
  return estado === 'en_preparacion' ? 'en_preparacion' : 'nuevo';
}

/** Las comandas pendientes de la estación con su desglose, en el orden y con el tope pedidos. */
async function cargarComandas(
  tx: Transaccion,
  ambito: AmbitoDeEstacion,
  orden: 'asc' | 'desc',
  limite: number,
): Promise<readonly ComandaDelTelefono[]> {
  const cabeceras = await tx
    .selectFrom('comandas as c')
    .leftJoin('mesas as m', 'm.id', 'c.mesa_id')
    .leftJoin('ordenes as o', 'o.id', 'c.orden_id')
    .select([
      'c.id',
      'c.estado',
      'c.created_at',
      'c.notas',
      'c.notas_alergias',
      'c.celebracion_especial',
      'c.tipo_celebracion',
      'm.numero as mesa_numero',
      'o.nombre_pedido',
      'o.canal',
      'o.numero_pedido',
    ])
    .where('c.organizacion_id', '=', ambito.organizacionId)
    .where('c.estacion_preparacion_id', '=', ambito.estacionId)
    .where('c.estado', 'in', PENDIENTES)
    .orderBy('c.created_at', orden)
    .orderBy('c.id', orden)
    .limit(limite)
    .execute();
  if (cabeceras.length === 0) return [];

  const renglones = await tx
    .selectFrom('comanda_items as i')
    .leftJoin('orden_lineas as l', 'l.id', 'i.orden_linea_id')
    .select([
      'i.comanda_id',
      'i.producto_nombre',
      'i.cantidad',
      'i.notas',
      'i.tipo_venta',
      'i.unidad_variable',
      'i.cantidad_variable',
      'l.opciones',
    ])
    .where('i.organizacion_id', '=', ambito.organizacionId)
    .where(
      'i.comanda_id',
      'in',
      cabeceras.map((c) => c.id),
    )
    .where('i.estado', '!=', 'cancelado')
    .orderBy('i.orden_visual')
    .execute();

  return cabeceras.map((cabecera) => ({
    id: cabecera.id,
    estado: cabecera.estado === 'en_preparacion' ? 'en_preparacion' : 'nuevo',
    mesaNumero: cabecera.mesa_numero ?? null,
    // Sólo la primera palabra, como el monitor de recogida: basta para «Juan» y no publica
    // el nombre completo de nadie.
    nombrePedido: primeraPalabra(cabecera.nombre_pedido),
    canal: cabecera.canal ?? 'aqui',
    numeroPedido: cabecera.numero_pedido ?? null,
    creadaEn: cabecera.created_at.toISOString(),
    notas: cabecera.notas,
    alergias: cabecera.notas_alergias,
    celebracion: cabecera.celebracion_especial,
    tipoCelebracion: cabecera.celebracion_especial ? cabecera.tipo_celebracion : null,
    platillos: renglones
      .filter((p) => p.comanda_id === cabecera.id)
      .map((p) => ({
        nombre: p.producto_nombre,
        cantidad: p.cantidad,
        porPeso: p.tipo_venta === 'variable_medida',
        unidadVariable: p.unidad_variable,
        cantidadVariable: p.cantidad_variable,
        notas: p.notas,
        opciones: opcionesSinPrecio(p.opciones),
      })),
  }));
}

/**
 * La instantánea `orden_lineas.opciones` es `[{ grupo, opciones: [{ nombre, precioCentavos }] }]`.
 * El teléfono sólo lee grupo y nombres: nada de importes (R33). Lo que no tenga esa forma se ignora.
 */
export function opcionesSinPrecio(crudo: unknown): readonly OpcionDelPlatillo[] {
  if (!Array.isArray(crudo)) return [];
  const salida: OpcionDelPlatillo[] = [];
  for (const elegido of crudo as unknown[]) {
    if (typeof elegido !== 'object' || elegido === null) continue;
    const { grupo, opciones } = elegido as { grupo?: unknown; opciones?: unknown };
    if (typeof grupo !== 'string' || !Array.isArray(opciones)) continue;
    const nombres = (opciones as unknown[]).flatMap((o) => {
      const nombre = (o as { nombre?: unknown } | null)?.nombre;
      return typeof nombre === 'string' && nombre.trim() !== '' ? [nombre] : [];
    });
    if (nombres.length > 0) salida.push({ grupo, nombres });
  }
  return salida;
}

function primeraPalabra(texto: string | null): string | null {
  const palabra = texto?.trim().split(/\s+/)[0] ?? '';
  return palabra === '' ? null : palabra.slice(0, 24);
}
