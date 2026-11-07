import 'server-only';

import { ErrorDominio, PAQUETES_MOSTRADOR, validarEntorno } from '@morphiqpos/contracts';
import { repoOrdenes, type Transaccion } from '@morphiqpos/data';
import { centavos, repartirPorPesos } from '@morphiqpos/domain/dinero';
import { puedeAutorizar } from '@morphiqpos/domain/venta';
import { z } from 'zod';

import { definirComando, type ContextoComando } from '../definicion.ts';
import { leerAutorizacion } from '../identidad/supervisor.ts';

import { gastarLaAutorizacion } from './autorizacion-de-un-uso.ts';
import { exigirBorrador } from './carrito.ts';
import { cotizar } from './cotizar.ts';
import { topeDe } from './descuento.ts';
import { exigirDescuentosPermitidos } from './descuentos-permitidos.ts';

/**
 * EL DESCUENTO DEL MOSTRADOR, con su tope y su supervisor (F-205, D-28 de la 2.4).
 *
 * Cada `02-DINERO-Y-CAJA §3` de los giros de mostrador dice lo mismo con sus cifras: el
 * dueño sin tope, el encargado hasta un tope chico, la cajera casi nada; por encima de
 * su tope, el PIN de un supervisor, y el PIN queda en la bitácora. Hasta la 2.4 el
 * mostrador no tenía descuento NINGUNO —el cobro de la tienda no tenía dónde ponerlo— y
 * `venta.autorizar_descuento` escribía autorizaciones que nadie aplicaba.
 *
 * ── Cómo se aplica ───────────────────────────────────────────────────────────
 * Al borrador, antes de cobrar, como un importe sobre toda la venta. Se reparte entre
 * las líneas en proporción a su importe, EXACTO —`repartirPorPesos`, sin centavo que
 * sobre ni que falte— y los totales salen de `cotizar`, la misma del cobro: el IVA se
 * calcula sobre lo ya descontado y el costo no baja (un descuento baja la venta, no lo
 * que costó, y el margen lo enseña). Volver a aplicar REEMPLAZA el anterior.
 *
 * ── La clave (DP-14.2, decisión DP-D61) ──────────────────────────────────────
 * TODO descuento pide la autorización firmada que emite `/api/identidad/supervisor` cuando
 * un gerente, administrador o dueño teclea SU PIN en esta terminal, aunque sea de $1 y aunque
 * quien tiene la sesión sea gerente (vuelve a teclear el suyo): el cajero y el mesero nunca
 * descuentan solos, y una tableta olvidada con sesión no sirve para regalar. La autorización
 * tiene que ser vigente, de este negocio, pedida por esta persona, para ESTA cuenta y por ESTE
 * monto, y se gasta al usarla (`autorizacion-de-un-uso.ts`). El límite es el tope del puesto de
 * quien autoriza (`topeDe`): tiene que cubrir el descuento ENTERO. Si el negocio apagó los
 * descuentos, nada de esto llega a mirarse (`DESCUENTOS_APAGADOS`).
 *
 * La bitácora: la fila de `autorizaciones_descuento` cuando autoriza otro (la base prohíbe ahí
 * que sea uno mismo), y siempre la auditoría del comando, con quién autorizó y el nonce gastado.
 */

const ROLES_DE_VENTA = ['cajero', 'mesero', 'gerente', 'administrador', 'dueno'] as const;

export const entradaAplicarDescuento = z.object({
  ordenId: z.uuid(),
  descuentoCentavos: z.number().int().min(1).max(100_000_000),
  motivo: z.string().trim().min(4).max(200),
  /** La autorización firmada del supervisor: desde DP-14.2 la pide TODO descuento. */
  autorizacion: z.string().min(20).max(2_000).optional(),
});

export interface ResultadoDescuentoDeMostrador {
  readonly descuentoCentavos: string;
  readonly totalCentavos: string;
  /** El empleo de quien autorizó (desde DP-14.2, siempre alguien). */
  readonly autorizadoPor: string | null;
}

/** El secreto se lee por invocación, no al cargar el módulo (igual que la pimienta). */
function secreto(): string {
  return validarEntorno(process.env).SESSION_SECRET;
}

export const aplicarDescuento = definirComando<
  Transaccion,
  typeof entradaAplicarDescuento,
  ResultadoDescuentoDeMostrador
>({
  nombre: 'venta.aplicar_descuento',
  entidad: 'orden',
  escribe: true,
  roles: [...ROLES_DE_VENTA],
  paquetes: PAQUETES_MOSTRADOR,
  sucursal: { ordenId: 'ordenes' },
  entrada: entradaAplicarDescuento,
  async ejecutar(ctx, entrada) {
    await ctx.paso('exigir_borrador', () =>
      exigirBorrador(ctx.tx, ctx.ambito.organizacionId, entrada.ordenId),
    );
    const hecho = await descontarLaOrden(ctx, entrada.ordenId, entrada);

    ctx.auditar({
      entidadId: entrada.ordenId,
      payload: {
        descuentoCentavos: hecho.descuentoCentavos.toString(),
        baseCentavos: hecho.baseCentavos.toString(),
        motivo: entrada.motivo,
        autorizadoPor: hecho.autorizadoPor,
        autorizadoRol: hecho.autorizadoRol,
        // DP-14.2 · El nonce gastado: `gastarLaAutorizacion` lo busca aquí.
        autorizacion: hecho.autorizacion,
      },
    });
    return {
      descuentoCentavos: hecho.descuentoCentavos.toString(),
      totalCentavos: hecho.totalCentavos.toString(),
      autorizadoPor: hecho.autorizadoPor,
    };
  },
});

/** Lo que se pide descontar: cuánto, por qué y, si pasa del tope, quién lo autorizó. */
export interface PedidoDeDescuento {
  readonly descuentoCentavos: number;
  readonly motivo: string;
  readonly autorizacion?: string | undefined;
}

export interface DescuentoAplicado {
  readonly descuentoCentavos: bigint;
  /** Lo que valía la orden antes del descuento: la base del porcentaje del tope. */
  readonly baseCentavos: bigint;
  readonly totalCentavos: bigint;
  /** El empleo de quien autorizó (desde DP-14.2, siempre alguien). */
  readonly autorizadoPor: string | null;
  readonly autorizadoRol: string | null;
  /** DP-14.2 · El nonce de la autorización gastada: va a la auditoría del comando. */
  readonly autorizacion: string | null;
}

/**
 * EL DESCUENTO SOBRE UNA ORDEN, con su tope y su supervisor: el cuerpo de
 * `venta.aplicar_descuento`, en UN sitio (bloque D de la 2.4).
 *
 * Lo usan dos llamadores con la misma regla y la misma bitácora: el carrito de la tienda
 * —un borrador, que el comando exige antes de llamar— y la NOTA de la ferretería, que el
 * mostradorista negocia con el cliente enfrente y nace `confirmada` al mandarse a caja
 * (`ferreteria.crear_nota_mostrador`). Una segunda copia del tope y de la autorización
 * sería la que se queda atrás el día que el tope cambie.
 *
 * No exige el estado: eso lo decide quien llama. No audita: `definirComando` guarda sólo
 * la primera entrada del rastro, y cada llamador anota la suya.
 */
export async function descontarLaOrden(
  ctx: ContextoComando<Transaccion>,
  ordenId: string,
  pedido: PedidoDeDescuento,
): Promise<DescuentoAplicado> {
  const { organizacionId, sucursalId, empleoId } = ctx.ambito;
  const lineas = await ctx.paso('leer_lineas', () =>
    repoOrdenes.lineasDeOrden(ctx.tx, organizacionId, ordenId),
  );
  if (lineas.length === 0) {
    throw new ErrorDominio('ORDEN_VACIA', 'No hay nada en la venta a qué descontarle.');
  }
  const base = lineas.reduce((suma, l) => suma + l.subtotalCentavos, 0n);
  const descuento = BigInt(pedido.descuentoCentavos);
  if (descuento >= base) {
    throw new ErrorDominio(
      'CONFIGURACION_INVALIDA',
      'Un descuento no puede llevarse la venta entera: eso es una cortesía, y se registra aparte.',
      { baseCentavos: base.toString() },
    );
  }

  await ctx.paso('descuentos_permitidos', () => exigirDescuentosPermitidos(ctx.tx, organizacionId));
  const carga = await ctx.paso('autorizar', async () => {
    const leida =
      pedido.autorizacion === undefined
        ? null
        : leerAutorizacion(
            pedido.autorizacion,
            // DP-13.2 (D-5) y DP-14.2: firmada para ESTA cuenta, para un descuento y por ESTE monto.
            {
              organizacionId,
              solicitaEmpleoId: empleoId,
              cuenta: ordenId,
              para: 'descuento',
              montoCentavos: descuento,
            },
            secreto(),
            ctx.ahora,
          );
    if (leida === null) {
      throw new ErrorDominio(
        'PUESTO_NO_OTORGABLE',
        pedido.autorizacion === undefined
          ? 'Todo descuento lo autoriza un gerente, administrador o dueño con su PIN.'
          : 'La autorización venció o es de otra cuenta u otro monto: que quien autoriza teclee su PIN otra vez.',
      );
    }
    const topeDeQuienAutoriza = await topeDe(ctx, leida.rol);
    if (!puedeAutorizar(descuento, base, topeDeQuienAutoriza)) {
      throw new ErrorDominio(
        'PUESTO_NO_OTORGABLE',
        'Ese descuento pasa del tope de quien lo autoriza: tiene que ser alguien por encima.',
        {
          topeCentavos: topeDeQuienAutoriza.topeCentavos.toString(),
          topeBp: topeDeQuienAutoriza.topeBp,
        },
      );
    }
    await gastarLaAutorizacion(ctx.tx, organizacionId, leida);
    // La base prohíbe aquí que quien autoriza sea quien pide (078): la gerente que vuelve a
    // teclear su propio PIN queda sólo en la auditoría del comando, que sí lo dice.
    if (leida.supervisor !== empleoId) {
      await ctx.tx
        .insertInto('autorizaciones_descuento')
        .values({
          organizacion_id: organizacionId,
          sucursal_id: sucursalId,
          orden_id: ordenId,
          solicita_empleo_id: empleoId,
          autoriza_empleo_id: leida.supervisor,
          autoriza_rol: leida.rol,
          descuento_centavos: descuento,
          // DP-14.2 · El tope propio de quien pide es CERO: nadie descuenta solo. Con las dos
          // ramas en cero, el `check` de la 180 (supera el tope) se cumple con cualquier monto.
          tope_centavos: 0n,
          base_centavos: base,
          tope_bp: 0,
          motivo: pedido.motivo,
          created_at: ctx.ahora,
        })
        .execute();
    }
    return leida;
  });
  const autorizadoPor = carga.supervisor;

  // El reparto EXACTO entre líneas, en proporción a lo que cada una vale.
  const partes = repartirPorPesos(
    centavos(descuento),
    lineas.map((l) => Number(l.subtotalCentavos)),
  );
  await ctx.paso('repartir', async () => {
    for (const [i, linea] of lineas.entries()) {
      const parte = BigInt(partes[i] ?? 0n);
      await ctx.tx
        .updateTable('orden_lineas')
        .set({
          descuento_centavos: parte,
          total_centavos: linea.subtotalCentavos - parte,
          updated_at: ctx.ahora,
        })
        .where('organizacion_id', '=', organizacionId)
        .where('orden_id', '=', ordenId)
        .where('id', '=', linea.id)
        .execute();
    }
  });

  const { totales } = await ctx.paso('recalcular', () => cotizar(ctx.tx, organizacionId, ordenId));
  await ctx.paso('anotar_totales', () =>
    repoOrdenes.anotarTotales(ctx.tx, organizacionId, ordenId, totales),
  );

  return {
    descuentoCentavos: descuento,
    baseCentavos: base,
    totalCentavos: totales.totalCentavos,
    autorizadoPor,
    autorizadoRol: carga.rol,
    autorizacion: carga.n,
  };
}

export const entradaTopeDeDescuento = z.object({});

export interface QuienAutoriza {
  readonly empleoId: string;
  readonly nombre: string;
  readonly rol: string;
}

export interface ResultadoTopeDeDescuento {
  readonly topeCentavos: string;
  readonly topeBp: number;
  /**
   * Los supervisores del negocio que pueden teclear su PIN aquí. Desde DP-14.2 incluye a la
   * persona que pregunta, si autoriza, y va primero: vuelve a teclear el suyo.
   */
  readonly quienesAutorizan: readonly QuienAutoriza[];
}

/**
 * Lo que la pantalla necesita ANTES de cobrar: el tope de quien cobra —para decidir si
 * pide el PIN de un supervisor o no— y a quién se le puede pedir. El servidor vuelve a
 * comprobar todo al aplicar; esto sólo evita preguntar de más o de menos.
 */
export const topeDeDescuento = definirComando<
  Transaccion,
  typeof entradaTopeDeDescuento,
  ResultadoTopeDeDescuento
>({
  nombre: 'venta.tope_de_descuento',
  entidad: 'orden',
  escribe: false,
  roles: [...ROLES_DE_VENTA],
  paquetes: PAQUETES_MOSTRADOR,
  entrada: entradaTopeDeDescuento,
  async ejecutar(ctx) {
    const { organizacionId, empleoId, rol } = ctx.ambito;
    const tope = await topeDe(ctx, rol);
    const supervisores = await ctx.paso('leer_supervisores', () =>
      ctx.tx
        .selectFrom('empleos')
        .innerJoin('personas', 'personas.id', 'empleos.persona_id')
        .select(['empleos.id as empleoId', 'personas.nombre as nombre', 'empleos.rol as rol'])
        .where('empleos.organizacion_id', '=', organizacionId)
        .where('empleos.activo', '=', true)
        .where('empleos.rol', 'in', ['gerente', 'administrador', 'dueno'])
        .orderBy('personas.nombre')
        .execute(),
    );
    // DP-14.2 · Quien tiene la sesión, si autoriza, va PRIMERO: vuelve a teclear su propio PIN.
    const propio = supervisores.filter((s) => s.empleoId === empleoId);
    const otros = supervisores.filter((s) => s.empleoId !== empleoId);
    return {
      topeCentavos: tope.topeCentavos.toString(),
      topeBp: tope.topeBp,
      quienesAutorizan: [...propio, ...otros],
    };
  },
});
