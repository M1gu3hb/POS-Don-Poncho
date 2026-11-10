import 'server-only';

import { createHash, createHmac } from 'node:crypto';

import type { Esquema, Transaccion } from '@morphiqpos/data';
import { estaAgotado } from '@morphiqpos/domain/catalogo';
import type { Kysely } from 'kysely';
import { z } from 'zod';

import type { AmbitoPortal } from './ambito.ts';
import type { BanderasPortal } from './banderas.ts';
import { entradaAbrirMesa, itemDelCarrito } from './esquemas.ts';
import { faltaMesero } from './negocio.ts';
import { deltasDeLasNotas, precioConLaNota } from './precio-en-el-carrito.ts';
import { PREFIJO_DEL_PEDIDO_LISTO, comoSeEnvia, type ComoSeEnvia } from './quien-envia.ts';

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
/**
 * DP-13.3 · Las «personas conectadas» que se cuentan no pasan de esto por mesa. Los ids ya los firma
 * el servidor y emitirlos tiene límite (`telefono.ts`, `limite.ts`), pero el conteo manda en
 * «¿Ya pidieron todos?» y en lo que ve el mesero: ninguna mesa real pasa de aquí.
 */
export const TOPE_DE_CONECTADOS = 20;
/**
 * DP-13.3 · La marca de «el mesero vació el pedido» vive en `carritos_mesa` sin migración: en las
 * mismas columnas del último envío (`enviado_en`, `enviado_por_huella`), con esta huella que no es
 * de ningún teléfono ni de ningún empleo. NO sube la ronda: vaciar no es enviar. Lo último que pasó
 * gana: un envío posterior la reemplaza.
 */
export const HUELLA_DEL_VACIADO = createHash('sha256')
  .update('portal:vaciado-del-mesero', 'utf8')
  .digest('hex');
/** El aviso de «tu mesero vació el pedido» vive este rato; pasado, ya es noticia vieja. */
export const SEGUNDOS_VACIADO_VIGENTE = 300;
/**
 * DP-13.2 · El carrito de una mesa SIN cuenta caduca solo a estas horas de que nadie le agregó
 * nada: el de una familia que nunca abrió la mesa (o que se fue y dejó el teléfono abierto) no le
 * aparece a la siguiente al otro día. Con la cuenta abierta no caduca: es el pedido de una mesa
 * servida. «Actividad» es agregar: un teléfono que sigue latiendo no lo mantiene vivo.
 *
 * Revisión de DP-13: lo que se dejó horas ANTES de abrir la cuenta tampoco es de la mesa servida.
 * La cuenta se abre a las 17:00 y el carrito es de las 13:00: caducó al abrirse, y no revive.
 */
export const HORAS_SIN_ACTIVIDAD = 3;

/**
 * ¿Ya caducó? Puro: sin líneas no hay nada que caducar. Se mide hasta la APERTURA de la cuenta si
 * la hay (con la cuenta abierta lo agregado después no caduca), o hasta ahora si no.
 */
export function carritoCaducado(
  ultimaLinea: Date | null,
  aperturaDeLaCuenta: Date | null,
  ahora: Date,
): boolean {
  if (ultimaLinea === null) return false;
  const hasta = aperturaDeLaCuenta ?? ahora;
  return hasta.getTime() - ultimaLinea.getTime() > HORAS_SIN_ACTIVIDAD * 3_600_000;
}

/** La más reciente de las líneas, o `null` sin líneas. */
export function ultimaDe(lineas: readonly { readonly created_at: Date }[]): Date | null {
  return lineas.reduce<Date | null>(
    (ultima, l) => (ultima === null || l.created_at > ultima ? l.created_at : ultima),
    null,
  );
}

/**
 * El id del teléfono, sólo su FORMA: letras, números, «-» y «_». Lo emite y lo firma el servidor
 * (DP-13.3, `telefono.ts`); los comandos comprueban la firma al sacar la huella.
 */
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
/**
 * DP-13.3 · El sondeo es lo único que puede llegar SIN id (un teléfono nuevo) o con uno que ya no
 * vale: el servidor lo reconoce o le emite uno (`resolverElTelefono`). Cualquier texto corto cabe aquí.
 */
export const entradaDelSondeo = z.object({ dispositivo: z.string().max(64).optional() }).strict();
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
    /**
     * DP-13.3 · Con la mesa cerrada y el negocio dejando que los comensales la abran, «Abrir la mesa
     * y enviar» es UN comando: los datos de la apertura (las personas que el comensal confirmó, su
     * nombre, las alergias) viajan con el envío y todo ocurre en la misma transacción. Sin ellos se
     * abre para una persona y el mesero corrige.
     */
    apertura: entradaAbrirMesa.optional(),
  })
  .strict();

export interface LineaDelCarrito {
  readonly id: string;
  readonly productoId: string;
  readonly nombre: string;
  readonly cantidad: string;
  /** DP-14 · `variable_medida`: la cantidad es un PESO («½ kg»), no piezas. */
  readonly tipoVenta: string;
  readonly unidad: string | null;
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
  /** DP-13.3 · La cuenta de la mesa ya se pidió (`cuenta_solicitada`): nadie envía desde el teléfono. */
  readonly cuentaPedida: boolean;
  /**
   * DP-13.3 · El mesero vació el pedido de esta mesa mientras este teléfono estaba conectado. Se dice
   * UNA vez (el sondeo que lo trae cuenta como visto, `vaciadoQueLeToca`); `null` el resto del tiempo.
   */
  readonly vaciadoPorElMesero: { readonly en: string } | null;
  /**
   * DP-14.6 · El carrito de la mesa caducó (pasaron `HORAS_SIN_ACTIVIDAD` sin enviarse): ya no se ve
   * y el comensal lo ve dicho («Tu pedido se borró…»), no un carrito vacío sin explicación. Dura
   * hasta que alguien agrega algo (eso borra lo viejo).
   */
  readonly caducado: boolean;
}

/**
 * DP-14.6 · El aviso «Pedido listo para confirmar» de un carrito que caducó se resuelve en cuanto
 * una lectura lo encuentra caducado: antes se quedaba en el globo del mesero hasta que alguien
 * agregara algo (su pedido ya no existe). Sólo ese aviso, no los demás `ordenar` de la mesa.
 */
export async function resolverElAvisoCaducado(
  tx: Kysely<Esquema>,
  ambito: MesaDelCarrito,
  ahora: Date,
): Promise<void> {
  await tx
    .updateTable('solicitudes_qr')
    .set((eb) => ({
      estado: 'resuelta',
      atendida_en: eb.fn.coalesce('atendida_en', eb.val(ahora)),
      resuelta_en: ahora,
      updated_at: ahora,
    }))
    .where('organizacion_id', '=', ambito.organizacionId)
    .where('mesa_id', '=', ambito.mesaId)
    .where('tipo', '=', 'ordenar')
    .where('estado', 'in', ['pendiente', 'atendida'])
    .where('notas', 'like', `${PREFIJO_DEL_PEDIDO_LISTO}%`)
    .execute();
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
  /** DP-13.3 · Escribe aunque el último latido sea de hace nada: es el acuse de un aviso entregado. */
  { sinEspera = false }: { readonly sinEspera?: boolean } = {},
): Promise<void> {
  await tx
    .insertInto('dispositivos_mesa')
    .values({
      organizacion_id: ambito.organizacionId,
      mesa_id: ambito.mesaId,
      dispositivo_huella: huella,
      visto_en: ahora,
    })
    .onConflict((oc) => {
      const actualizar = oc
        .columns(['organizacion_id', 'mesa_id', 'dispositivo_huella'])
        .doUpdateSet({ visto_en: ahora });
      return sinEspera
        ? actualizar
        : actualizar.where(
            'dispositivos_mesa.visto_en',
            '<',
            new Date(ahora.getTime() - SEGUNDOS_ENTRE_LATIDOS * 1000),
          );
    })
    .execute();
}

/** El último latido que se escribió de este teléfono en esta mesa, o `null` si nunca. */
export async function ultimoLatido(
  tx: Transaccion,
  ambito: MesaDelCarrito,
  huella: string,
): Promise<Date | null> {
  const fila = await tx
    .selectFrom('dispositivos_mesa')
    .select('visto_en')
    .where('organizacion_id', '=', ambito.organizacionId)
    .where('mesa_id', '=', ambito.mesaId)
    .where('dispositivo_huella', '=', huella)
    .executeTakeFirst();
  return fila?.visto_en ?? null;
}

/**
 * DP-13.3 (punto 12) · ¿Le toca a este teléfono la noticia de que el mesero vació el pedido? Puro.
 *
 * Le toca si la marca de `carritos_mesa` es de un vaciado, es reciente, y el teléfono estaba
 * CONECTADO cuando pasó: su último latido es de antes del vaciado pero de menos de un minuto antes.
 * Es "UNA vez" sin guardar nada más: entregar la noticia reescribe el latido (`leerElCarrito`), y con
 * el latido ya posterior al vaciado no vuelve a tocarle. Quien llega después (sin latido previo) o
 * llevaba rato sin sondear no oye nada.
 */
export function vaciadoQueLeToca(
  marca:
    { readonly enviado_en: Date | null; readonly enviado_por_huella: string | null } | undefined,
  latidoAnterior: Date | null,
  ahora: Date,
): { readonly en: string } | null {
  if (marca?.enviado_por_huella !== HUELLA_DEL_VACIADO || marca.enviado_en === null) return null;
  if (latidoAnterior === null) return null;
  const vaciado = marca.enviado_en.getTime();
  const latido = latidoAnterior.getTime();
  const estabaConectado = latido < vaciado && latido >= vaciado - SEGUNDOS_CONECTADO * 1000;
  const vigente = ahora.getTime() - vaciado <= SEGUNDOS_VACIADO_VIGENTE * 1000;
  return estabaConectado && vigente ? { en: marca.enviado_en.toISOString() } : null;
}

/** La cuenta abierta de la mesa, sin candado: sólo para saber desde cuándo cuenta el carrito. */
export async function aperturaDeLaCuenta(
  tx: Kysely<Esquema>,
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
    latidoAnterior = null,
  }: {
    readonly desde: Date | null;
    readonly ahora: Date;
    readonly banderas: BanderasPortal;
    /**
     * DP-13.3 · El latido de este teléfono ANTES de que el sondeo escribiera el de ahora: con él se
     * decide si le toca la noticia del vaciado (`vaciadoQueLeToca`). Sólo lo da el sondeo; los
     * comandos y la lectura del mesero no entregan ese aviso.
     */
    readonly latidoAnterior?: Date | null;
  },
): Promise<EstadoDelCarrito> {
  const todas = await tx
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
      'l.created_at',
      'p.nombre',
      'p.tipo_venta',
      'p.unidad_variable',
      'p.precio_venta_centavos',
      'p.activo',
      'p.visible_en_menu_digital',
      'p.agotado_hasta',
    ])
    .where('l.organizacion_id', '=', ambito.organizacionId)
    .where('l.mesa_id', '=', ambito.mesaId)
    .orderBy('l.created_at')
    .orderBy('l.id')
    .execute();
  // DP-13.2: lo caducado ya no se ve; se borra con lo siguiente que se agregue.
  const caducoElCarrito = carritoCaducado(ultimaDe(todas), desde, ahora);
  const lineas = caducoElCarrito ? [] : todas;
  if (caducoElCarrito) await resolverElAvisoCaducado(tx, ambito, ahora);
  // DP-16 · Lo que suman las opciones que el comensal eligió (van plegadas en la nota): el precio
  // de la línea en el carrito es aproximado, pero ya con ellas. El cobro lo calcula el servidor.
  const deltaDe =
    banderas.mostrarPrecios && lineas.length > 0
      ? await deltasDeLasNotas(
          tx,
          ambito.organizacionId,
          lineas.map((l) => ({ productoId: l.producto_id, nombre: l.nombre, notas: l.notas })),
        )
      : () => 0n;
  // Ronda 2 (medio 9) · «Tu pedido se borró…» es de los teléfonos que ESTABAN en ese carrito: la
  // familia nueva que se sienta después (otro teléfono) no lo lee, aunque lo viejo siga ahí.
  const caducado = caducoElCarrito && todas.some((l) => l.dispositivo_huella === huella);

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
  const pedida = await tx
    .selectFrom('ordenes')
    .select('id')
    .where('organizacion_id', '=', ambito.organizacionId)
    .where('mesa_id', '=', ambito.mesaId)
    .where('estado', '=', 'cuenta_solicitada')
    .executeTakeFirst();

  const telefonos = new Map<string, number>();
  for (const l of lineas) {
    if (!telefonos.has(l.dispositivo_huella)) {
      telefonos.set(l.dispositivo_huella, telefonos.size + 1);
    }
  }
  const nConectados = Math.min(Number(conectados?.n ?? 0), TOPE_DE_CONECTADOS);
  const vaciado = vaciadoQueLeToca(carrito, latidoAnterior, ahora);
  const personas = desde === null ? 0 : (mesa?.personas_actuales ?? 0);
  return {
    lineas: lineas.map((l) => ({
      id: l.id,
      productoId: l.producto_id,
      nombre: l.nombre,
      cantidad: cantidadLegible(l.cantidad),
      tipoVenta: l.tipo_venta,
      unidad: l.tipo_venta === 'variable_medida' ? l.unidad_variable : null,
      notas: l.notas,
      precioCentavos: banderas.mostrarPrecios
        ? precioConLaNota(l.precio_venta_centavos, l.tipo_venta, l.cantidad, deltaDe(l)).toString()
        : null,
      esMia: l.dispositivo_huella === huella,
      telefono: telefonos.get(l.dispositivo_huella) ?? 0,
      // DP-15 · Una línea de algo que se agotó hoy se queda en la lista, marcada: al enviar sale.
      disponible:
        l.activo && l.visible_en_menu_digital && !estaAgotado(l.agotado_hasta, new Date()),
    })),
    conectados: nConectados,
    personas,
    esperarATodos: nConectados >= 2 || personas >= 2,
    ronda: carrito?.ronda ?? 0,
    // La marca del vaciado ocupa las columnas del último envío: no es un envío (`vaciadoQueLeToca`).
    ultimoEnvio:
      carrito?.enviado_en == null || carrito.enviado_por_huella === HUELLA_DEL_VACIADO
        ? null
        : {
            en: carrito.enviado_en.toISOString(),
            porEsteTelefono: carrito.enviado_por_huella === huella,
          },
    cuentaAbierta: desde !== null,
    envio: comoSeEnvia(banderas, {
      cuentaAbierta: desde !== null,
      faltaMesero: faltaMesero(banderas, ambito.empleadoAsignadoId),
      cuentaPedida: pedida !== undefined,
    }),
    meseroAvisado: aviso !== undefined,
    cuentaPedida: pedida !== undefined,
    vaciadoPorElMesero: vaciado,
    caducado,
  };
}
