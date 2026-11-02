import 'server-only';

import { createHmac } from 'node:crypto';

import type { Transaccion } from '@morphiqpos/data';
import { z } from 'zod';

import type { AmbitoPortal } from './ambito.ts';
import type { BanderasPortal } from './banderas.ts';
import { itemDelCarrito } from './esquemas.ts';
import { faltaMesero } from './negocio.ts';
import { comoSeEnvia, type ComoSeEnvia } from './quien-envia.ts';

/**
 * EL CARRITO COMPARTIDO DE LA MESA (DP-9.5).
 *
 * Todos los teléfonos que escanean el QR de una mesa arman UN carrito: cada quien agrega, todos
 * ven lo de todos (sondeo de 2-3 s), cada quien quita lo suyo, y cualquiera lo manda. Sale a
 * cocina UNA vez, entero —una comanda por estación—, y se vacía para todos.
 *
 * Aquí: la huella del teléfono, la forma de lo que llega, el latido y la lectura del carrito.
 * Los tres comandos están en `carrito-comandos.ts`.
 */

/** De la mesa, lo que el carrito necesita: el portal y el mesero (DP-12.2) lo arman cada uno. */
export type MesaDelCarrito = Pick<AmbitoPortal, 'organizacionId' | 'mesaId' | 'empleadoAsignadoId'>;

/** Más de esto en un carrito ya no es una mesa pidiendo. */
export const MAXIMO_EN_EL_CARRITO = 60;
/** Un teléfono cuenta como conectado si latió en este último rato. */
export const SEGUNDOS_CONECTADO = 60;
/**
 * DP-12.2 · El latido se escribe a lo mucho una vez en este rato por teléfono: el sondeo es cada
 * 2.5 s y, con diez teléfonos, cada uno escribía 24 veces por minuto la misma fila. Con 30 s el
 * teléfono sigue contando como conectado (la ventana es de 60).
 */
export const SEGUNDOS_ENTRE_LATIDOS = 30;

/** El id que inventa el navegador del teléfono: sólo letras, números, «-» y «_». */
const DISPOSITIVO = z
  .string()
  .regex(/^[A-Za-z0-9_-]{16,64}$/, { error: 'No se pudo reconocer este teléfono.' });

/** Lo que se guarda del teléfono: su huella con la pimienta del servidor, nunca el id. */
export function huellaDelDispositivo(pimienta: string, dispositivo: string): string {
  return createHmac('sha256', pimienta)
    .update(`portal:dispositivo:${dispositivo}`, 'utf8')
    .digest('hex');
}

export const entradaDelTelefono = z.object({ dispositivo: DISPOSITIVO }).strict();
export const entradaAgregarAlCarrito = z
  .object({ dispositivo: DISPOSITIVO, item: itemDelCarrito })
  .strict();
export const entradaQuitarDelCarrito = z
  .object({ dispositivo: DISPOSITIVO, lineaId: z.uuid() })
  .strict();
export const entradaEnviarElCarrito = z
  .object({
    dispositivo: DISPOSITIVO,
    confirmado: z.boolean(),
    /** La nota para cocina de quien lo manda («todo junto, sin picante…»). */
    notaGeneral: z.string().trim().max(300).default(''),
  })
  .strict();

export interface LineaDelCarrito {
  readonly id: string;
  readonly productoId: string;
  readonly nombre: string;
  readonly cantidad: string;
  readonly notas: string;
  /**
   * El precio vigente del catálogo, sólo para enseñarlo: lo que se cobra lo pone el envío. `null`
   * cuando el negocio no enseña precios en el portal (DP-12.2: la respuesta tampoco los trae).
   */
  readonly precioCentavos: string | null;
  /** La agregó ESTE teléfono: sólo ésas se pueden quitar desde aquí. */
  readonly esMia: boolean;
  /** De qué teléfono es, numerados por orden de llegada: «Teléfono 2» para el mesero. */
  readonly telefono: number;
  /**
   * `false`: el negocio la ocultó del menú o la desactivó después de que se agregara. Todos los
   * teléfonos la ven marcada; al enviar se quita y el pedido sale sin ella.
   */
  readonly disponible: boolean;
}

export interface EstadoDelCarrito {
  readonly lineas: readonly LineaDelCarrito[];
  /** Teléfonos distintos que latieron en el último minuto desde que se abrió la cuenta. */
  readonly conectados: number;
  /** Las personas con las que se abrió la mesa. */
  readonly personas: number;
  /** Dos o más teléfonos, o una mesa de dos o más: «Esperen a que todos agreguen…». */
  readonly esperarATodos: boolean;
  /** Cuántas veces ha salido el carrito de esta mesa: si sube, alguien lo mandó. */
  readonly ronda: number;
  readonly ultimoEnvio: { readonly en: string; readonly porEsteTelefono: boolean } | null;
  /** DP-12.2 · La mesa tiene cuenta abierta. Sin ella el carrito se arma igual. */
  readonly cuentaAbierta: boolean;
  /** DP-12.2 · Qué puede hacer el comensal con lo armado (`quien-envia.ts`). */
  readonly envio: ComoSeEnvia;
  /** DP-12.2 · Ya hay un «Pedido listo para confirmar» esperando al mesero. */
  readonly meseroAvisado: boolean;
}

/** `2.5000` → `2.5`, `3.0000` → `3`: como la escribió el comensal. */
export function cantidadLegible(cantidad: string): string {
  return cantidad.includes('.') ? cantidad.replace(/\.?0+$/, '') : cantidad;
}

/** El teléfono sigue aquí: su último latido es ahora. */
export async function latir(
  tx: Transaccion,
  ambito: MesaDelCarrito,
  huella: string,
  ahora: Date,
): Promise<void> {
  await tx
    .insertInto('dispositivos_mesa')
    .values({
      organizacion_id: ambito.organizacionId,
      mesa_id: ambito.mesaId,
      dispositivo_huella: huella,
      visto_en: ahora,
    })
    .onConflict((oc) =>
      oc
        .columns(['organizacion_id', 'mesa_id', 'dispositivo_huella'])
        .doUpdateSet({ visto_en: ahora })
        .where(
          'dispositivos_mesa.visto_en',
          '<',
          new Date(ahora.getTime() - SEGUNDOS_ENTRE_LATIDOS * 1000),
        ),
    )
    .execute();
}

/** La cuenta abierta de la mesa, sin candado: sólo para saber desde cuándo cuenta el carrito. */
export async function aperturaDeLaCuenta(
  tx: Transaccion,
  ambito: MesaDelCarrito,
): Promise<Date | null> {
  const orden = await tx
    .selectFrom('ordenes')
    .select('created_at')
    .where('organizacion_id', '=', ambito.organizacionId)
    .where('mesa_id', '=', ambito.mesaId)
    .where('estado', 'in', [
      'borrador',
      'confirmada',
      'en_preparacion',
      'lista',
      'cuenta_solicitada',
    ])
    .orderBy('created_at', 'desc')
    .executeTakeFirst();
  return orden?.created_at ?? null;
}

/**
 * El carrito de la mesa como lo ve un teléfono (DP-12.2: con la mesa cerrada también).
 *
 * Son todas las líneas de la mesa: lo armado antes de abrir la cuenta se conserva, y lo de una
 * cuenta anterior ya no está porque se olvida al cerrarse (`restaurante/carrito-del-salon.ts`).
 * `desde` es la apertura de la cuenta, o `null` sin cuenta; sólo cuenta a los conectados.
 */
export async function estadoDelCarrito(
  tx: Transaccion,
  ambito: MesaDelCarrito,
  huella: string,
  {
    desde,
    ahora,
    banderas,
  }: { readonly desde: Date | null; readonly ahora: Date; readonly banderas: BanderasPortal },
): Promise<EstadoDelCarrito> {
  const lineas = await tx
    .selectFrom('carrito_mesa_lineas as l')
    .innerJoin('productos as p', (j) =>
      j.onRef('p.id', '=', 'l.producto_id').onRef('p.organizacion_id', '=', 'l.organizacion_id'),
    )
    .select([
      'l.id',
      'l.producto_id',
      'l.cantidad',
      'l.notas',
      'l.dispositivo_huella',
      'p.nombre',
      'p.precio_venta_centavos',
      'p.activo',
      'p.visible_en_menu_digital',
    ])
    .where('l.organizacion_id', '=', ambito.organizacionId)
    .where('l.mesa_id', '=', ambito.mesaId)
    .orderBy('l.created_at')
    .orderBy('l.id')
    .execute();

  const umbral = new Date(ahora.getTime() - SEGUNDOS_CONECTADO * 1000);
  const desdeConectados = desde !== null && desde > umbral ? desde : umbral;
  const conectados = await tx
    .selectFrom('dispositivos_mesa')
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where('organizacion_id', '=', ambito.organizacionId)
    .where('mesa_id', '=', ambito.mesaId)
    .where('visto_en', '>=', desdeConectados)
    .executeTakeFirst();
  const mesa = await tx
    .selectFrom('mesas')
    .select('personas_actuales')
    .where('organizacion_id', '=', ambito.organizacionId)
    .where('id', '=', ambito.mesaId)
    .executeTakeFirst();
  const carrito = await tx
    .selectFrom('carritos_mesa')
    .select(['ronda', 'enviado_en', 'enviado_por_huella'])
    .where('organizacion_id', '=', ambito.organizacionId)
    .where('mesa_id', '=', ambito.mesaId)
    .executeTakeFirst();
  const aviso = await tx
    .selectFrom('solicitudes_qr')
    .select('id')
    .where('organizacion_id', '=', ambito.organizacionId)
    .where('mesa_id', '=', ambito.mesaId)
    .where('tipo', '=', 'ordenar')
    .where('estado', '=', 'pendiente')
    .executeTakeFirst();

  const telefonos = new Map<string, number>();
  for (const l of lineas) {
    if (!telefonos.has(l.dispositivo_huella)) {
      telefonos.set(l.dispositivo_huella, telefonos.size + 1);
    }
  }
  const nConectados = Number(conectados?.n ?? 0);
  const personas = desde === null ? 0 : (mesa?.personas_actuales ?? 0);
  return {
    lineas: lineas.map((l) => ({
      id: l.id,
      productoId: l.producto_id,
      nombre: l.nombre,
      cantidad: cantidadLegible(l.cantidad),
      notas: l.notas,
      precioCentavos: banderas.mostrarPrecios ? l.precio_venta_centavos.toString() : null,
      esMia: l.dispositivo_huella === huella,
      telefono: telefonos.get(l.dispositivo_huella) ?? 0,
      disponible: l.activo && l.visible_en_menu_digital,
    })),
    conectados: nConectados,
    personas,
    esperarATodos: nConectados >= 2 || personas >= 2,
    ronda: carrito?.ronda ?? 0,
    ultimoEnvio:
      carrito?.enviado_en == null
        ? null
        : {
            en: carrito.enviado_en.toISOString(),
            porEsteTelefono: carrito.enviado_por_huella === huella,
          },
    cuentaAbierta: desde !== null,
    envio: comoSeEnvia(banderas, {
      cuentaAbierta: desde !== null,
      faltaMesero: faltaMesero(banderas, ambito.empleadoAsignadoId),
    }),
    meseroAvisado: aviso !== undefined,
  };
}
