import 'server-only';

import { PAQUETES_RESTAURANTE } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { z } from 'zod';

import { definirComando } from '../definicion.ts';
import { opcionesParaCocina } from '../puente/opciones-de-cocina.ts';

/**
 * DP-24 · LOS AVISOS DE «LISTO»: lo que ya salió de cocina, para el mesero DE ESA MESA y nadie más.
 *
 * El destinatario lo decide el SERVIDOR, no la pantalla: la mesa es de quien la tiene asignada o,
 * sin asignación, de quien la atiende (`empleado_atiende_id`). Un mesero que pregunta sólo ve lo
 * de sus mesas, y el administrador, el gerente o la caja no reciben nada por aquí (el rol de este
 * comando es `mesero`): el aviso es para recoger el plato, no para vigilar.
 *
 * No guarda nada: lo «listo» y todavía sin entregar de una mesa viva ES el aviso. Se va solo en
 * cuanto el platillo se entrega o se cancela; el mesero que lo quita de su pantalla lo recuerda su
 * aparato, y mientras exista el aviso en el servidor jamás se pierde en silencio. La mesa se toma
 * de la CUENTA (en una unión, la mesa principal).
 */

export const entradaAvisosDeListo = z.object({}).strict();

export interface PlatilloDelAviso {
  readonly id: string;
  readonly nombre: string;
  readonly cantidad: string;
  readonly tipoVenta: string | null;
  readonly unidadVariable: string | null;
  /** DP-25 · 3.2 · Los nombres de las opciones elegidas («Michelado»), sin precios ni ids. */
  readonly opciones: readonly string[];
}

export interface AvisoDeListo {
  /** El aviso es de UNA estación de UNA mesa: la comanda lo identifica. */
  readonly comandaId: string;
  readonly ordenId: string;
  readonly mesaId: string;
  readonly mesaNumero: number;
  readonly estacionNombre: string | null;
  readonly estacionColor: string | null;
  /** El instante en que salió el platillo más reciente (ISO). */
  readonly listoEn: string | null;
  readonly platillos: readonly PlatilloDelAviso[];
}

export interface ResultadoAvisosDeListo {
  readonly avisos: readonly AvisoDeListo[];
}

export const avisosDeListo = definirComando<
  Transaccion,
  typeof entradaAvisosDeListo,
  ResultadoAvisosDeListo
>({
  nombre: 'restaurante.avisos_de_listo',
  entidad: 'comanda',
  escribe: false,
  roles: ['mesero'],
  paquetes: PAQUETES_RESTAURANTE,
  modulo: 'cocina',
  entrada: entradaAvisosDeListo,
  async ejecutar(ctx) {
    const { organizacionId, sucursalId, empleoId } = ctx.ambito;
    let consulta = ctx.tx
      .selectFrom('comanda_items as i')
      .innerJoin('comandas as c', (j) =>
        j.onRef('c.id', '=', 'i.comanda_id').onRef('c.organizacion_id', '=', 'i.organizacion_id'),
      )
      .innerJoin('ordenes as o', (j) =>
        j.onRef('o.id', '=', 'c.orden_id').onRef('o.organizacion_id', '=', 'c.organizacion_id'),
      )
      .leftJoin('orden_lineas as l', (j) =>
        j
          .onRef('l.id', '=', 'i.orden_linea_id')
          .onRef('l.organizacion_id', '=', 'i.organizacion_id'),
      )
      .innerJoin('mesas as m', (j) =>
        j.onRef('m.id', '=', 'o.mesa_id').onRef('m.organizacion_id', '=', 'o.organizacion_id'),
      )
      .select([
        'i.id as platilloId',
        'i.producto_nombre as nombre',
        'i.cantidad as cantidad',
        'i.tipo_venta as tipoVenta',
        'i.unidad_variable as unidadVariable',
        'l.opciones as opciones',
        'i.listo_en as listoEn',
        'i.orden_visual as ordenVisual',
        'c.id as comandaId',
        'c.orden_id as ordenId',
        'c.estacion_nombre as estacionNombre',
        'c.estacion_color as estacionColor',
        'm.id as mesaId',
        'm.numero as mesaNumero',
      ])
      .where('i.organizacion_id', '=', organizacionId)
      .where('i.estado', '=', 'listo')
      .where('c.estado', 'in', ['nuevo', 'en_preparacion', 'listo'])
      .where('o.estado', 'not in', ['pagada', 'cancelada', 'absorbida'])
      // Quien tiene la mesa: el asignado; sin asignación, el que la atiende.
      .where((eb) =>
        eb.or([
          eb('m.empleado_asignado_id', '=', empleoId),
          eb.and([
            eb('m.empleado_asignado_id', 'is', null),
            eb('m.empleado_atiende_id', '=', empleoId),
          ]),
        ]),
      );
    if (sucursalId !== null) consulta = consulta.where('m.sucursal_id', '=', sucursalId);

    const filas = await ctx.paso('leer_listos', () =>
      consulta.orderBy('i.listo_en').orderBy('i.orden_visual').execute(),
    );

    const porComanda = new Map<string, AvisoDeListo>();
    for (const f of filas) {
      const platillo: PlatilloDelAviso = {
        id: f.platilloId,
        nombre: f.nombre,
        cantidad: f.cantidad,
        tipoVenta: f.tipoVenta,
        unidadVariable: f.unidadVariable,
        opciones: (opcionesParaCocina(f.opciones) ?? []).flatMap((g) => g.opciones),
      };
      const previo = porComanda.get(f.comandaId);
      const listoEn = f.listoEn === null ? null : f.listoEn.toISOString();
      porComanda.set(f.comandaId, {
        comandaId: f.comandaId,
        ordenId: f.ordenId,
        mesaId: f.mesaId,
        mesaNumero: f.mesaNumero,
        estacionNombre: f.estacionNombre,
        estacionColor: f.estacionColor,
        listoEn: masReciente(previo?.listoEn ?? null, listoEn),
        platillos: [...(previo?.platillos ?? []), platillo],
      });
    }
    return { avisos: [...porComanda.values()] };
  },
});

function masReciente(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return a > b ? a : b;
}
