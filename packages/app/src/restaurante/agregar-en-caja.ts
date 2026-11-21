import 'server-only';

import { ErrorDominio, PAQUETES_RESTAURANTE } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { MARCA_PARA_LLEVAR, notaParaLlevar } from '@morphiqpos/domain/venta';
import { z } from 'zod';

import { definirComando } from '../definicion.ts';
import { cotizar } from '../venta/cotizar.ts';
import { insertarComandas, insertarItems } from './comandas.ts';
import { ordenDeMesa } from './datos.ts';
import { agruparEnComandas } from './estaciones.ts';
import { entradaEnviarPedido } from './esquemas.ts';
import { insertarLineas } from './lineas.ts';
import { prepararLasOpciones } from './opciones-de-la-linea.ts';
import { comandarLasLineas, prepararTodas, type ComandaEmitida } from './pedido.ts';
import { lineaConLasOpciones } from './precio-de-las-opciones.ts';

/**
 * `restaurante.agregar_en_caja` · LA CAJA AGREGA PRODUCTOS A LA CUENTA QUE ESTÁ COBRANDO (DP-24).
 *
 * «Y dos tamales para llevar», con la cuenta ya en la mano. La cuenta PEDIDA no se editaba: había
 * que cobrarla y abrir otra venta, o pedirle al mesero que reabriera la mesa. Ahora la Caja le
 * agrega a ESA cuenta —«Agregar a la cuenta» y «Para llevar»— y lo agregado sale a cocina como
 * cualquier pedido, por las mismas piezas que `restaurante.enviar_pedido`: el precio del catálogo,
 * las opciones validadas, las comandas por estación. Lo de «para llevar» va MARCADO en la nota del
 * platillo y en la de su comanda («PARA LLEVAR»), que es lo que leen cocina, el ticket y la cuenta.
 *
 * ── La cuenta sigue PEDIDA ─────────────────────────────────────────────────────
 * No se «reabre»: la mesa no vuelve a manos del mesero y la cuenta no sale de la lista de la
 * Caja. Sólo cambian sus renglones y su total (que recalcula el servidor), y sube su `version`:
 * otra caja que la tuviera abierta, o los comensales en el portal, se enteran de que cambió, y un
 * cobro con el total de antes se rechaza en vez de cobrar de menos.
 *
 * Si la cuenta todavía no se pide (la Caja la buscó por su folio), va por el camino de siempre.
 *
 * ── Lo que NO se puede ─────────────────────────────────────────────────────────
 * A una PARTE de una cuenta dividida no se le agrega: sus importes están atados a los de la cuenta
 * madre (`division_cuadra`). Lo que falte se agrega antes de dividir, o se cobra aparte.
 */

const ROLES_DE_CAJA = ['cajero', 'gerente', 'administrador', 'dueno'] as const;

/** La cuenta que la Caja tiene en «Pendientes». */
const CUENTA_PEDIDA = 'cuenta_solicitada';
/** Las que todavía van por el camino del mesero (`comandarLasLineas`). */
const AUN_ABIERTA: readonly string[] = ['borrador', 'confirmada'];

export const entradaAgregarEnCaja = z.object({
  ordenId: z.uuid(),
  lineas: entradaEnviarPedido.shape.lineas,
  /** Lo agregado es para llevar: va marcado a cocina y en la cuenta. */
  paraLlevar: z.boolean().default(false),
});

export interface ResultadoAgregarEnCaja {
  readonly ordenId: string;
  readonly lineas: number;
  readonly comandas: readonly ComandaEmitida[];
  /** El total lo calcula el servidor sobre las líneas que acaba de escribir. */
  readonly totalCentavos: string;
  /** La versión nueva de la cuenta: la Caja la manda al cobrar. */
  readonly version: number;
}

export const agregarEnCaja = definirComando<
  Transaccion,
  typeof entradaAgregarEnCaja,
  ResultadoAgregarEnCaja
>({
  nombre: 'restaurante.agregar_en_caja',
  entidad: 'orden',
  escribe: true,
  roles: [...ROLES_DE_CAJA],
  paquetes: PAQUETES_RESTAURANTE,
  sucursal: { ordenId: 'ordenes' },
  entrada: entradaAgregarEnCaja,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;
    const pedido = {
      ordenId: entrada.ordenId,
      lineas: entrada.paraLlevar
        ? entrada.lineas.map((linea) => ({ ...linea, notas: notaParaLlevar(linea.notas) }))
        : entrada.lineas,
      ...(entrada.paraLlevar ? { notas: MARCA_PARA_LLEVAR } : {}),
    };

    // Con candado (`for update`): un cobro o un pedido simultáneos de la misma cuenta esperan aquí.
    const orden = await ctx.paso('cargar_orden', () =>
      ordenDeMesa(ctx.tx, organizacionId, entrada.ordenId),
    );
    const cuenta = await ctx.paso('leer_cuenta', () =>
      ctx.tx
        .selectFrom('ordenes')
        .select(['version', 'orden_padre_id as ordenPadreId'])
        .where('organizacion_id', '=', organizacionId)
        .where('id', '=', entrada.ordenId)
        .executeTakeFirstOrThrow(),
    );
    if (cuenta.ordenPadreId !== null) {
      throw new ErrorDominio(
        'ORDEN_NO_EDITABLE',
        'Esta es una parte de una cuenta dividida: no se le agregan productos. Cóbralos aparte.',
        { estado: orden.estado },
      );
    }

    const auditar = (resultado: ResultadoAgregarEnCaja): ResultadoAgregarEnCaja => {
      ctx.auditar({
        entidadId: entrada.ordenId,
        payload: {
          lineas: resultado.lineas,
          paraLlevar: entrada.paraLlevar,
          comandas: resultado.comandas.length,
          estaciones: resultado.comandas.map((c) => c.estacionNombre),
          totalCentavos: resultado.totalCentavos,
        },
      });
      return resultado;
    };

    // La cuenta que aún no se pide: el camino del mesero, que además mueve la mesa.
    if (AUN_ABIERTA.includes(orden.estado)) {
      const enviado = await comandarLasLineas(ctx, pedido);
      const version = await ctx.paso('subir_version', () =>
        subirLaVersion(ctx.tx, organizacionId, entrada.ordenId, cuenta.version),
      );
      return auditar({ ...enviado, version });
    }
    if (orden.estado !== CUENTA_PEDIDA) {
      throw new ErrorDominio(
        'ORDEN_NO_EDITABLE',
        'Esa cuenta ya se cerró; no se le pueden agregar productos.',
        { estado: orden.estado },
      );
    }

    // El precio sale del catálogo DENTRO de esta transacción: el endpoint no recibe importes.
    const valoradas = await ctx.paso('valorar_lineas', () =>
      prepararTodas(ctx.tx, organizacionId, pedido, ctx.ahora),
    );
    const elegidas = await ctx.paso('opciones', () =>
      prepararLasOpciones(
        ctx.tx,
        organizacionId,
        valoradas.map((l, i) => ({
          productoId: l.producto.id,
          productoNombre: l.producto.nombre,
          notas: l.notas,
          opciones: pedido.lineas[i]?.opciones,
        })),
      ),
    );
    // Lo que se agrega en la caja sale YA: no se retiene por tiempos (la mesa está por irse).
    const preparadas = valoradas.map((l, i) => ({
      ...lineaConLasOpciones(l, elegidas[i] ?? []),
      marchaEstado: 'inmediata' as const,
    }));
    await ctx.paso('escribir_lineas', () =>
      insertarLineas(ctx.tx, organizacionId, entrada.ordenId, preparadas),
    );

    const comandas = agruparEnComandas(preparadas).map((grupo) => ({
      id: crypto.randomUUID(),
      grupo,
    }));
    if (comandas.length > 0) {
      await ctx.paso('escribir_comandas', () =>
        insertarComandas(ctx.tx, {
          organizacionId,
          orden,
          notas: pedido.notas ?? null,
          comandas,
          marchadaEn: ctx.ahora,
        }),
      );
      await ctx.paso('escribir_items', () => insertarItems(ctx.tx, organizacionId, comandas));
    }

    // Los totales, sobre las líneas persistidas. El estado NO cambia: la cuenta sigue pedida.
    const { totales } = await ctx.paso('cotizar', () =>
      cotizar(ctx.tx, organizacionId, entrada.ordenId),
    );
    const version = cuenta.version + 1;
    const escrita = await ctx.paso('escribir_totales', () =>
      ctx.tx
        .updateTable('ordenes')
        .set({
          subtotal_centavos: totales.subtotalCentavos,
          descuento_centavos: totales.descuentoCentavos,
          impuestos_centavos: totales.impuestosCentavos,
          // La venta SIN propina: la propina vive en `pagos`.
          total_centavos: totales.totalCentavos,
          costo_total_centavos: totales.costoTotalCentavos,
          utilidad_centavos: totales.utilidadCentavos,
          margen_bp: totales.margenBp,
          version,
        })
        .where('organizacion_id', '=', organizacionId)
        .where('id', '=', entrada.ordenId)
        // Si entre tanto se cobró o se canceló, aquí no se escribe encima.
        .where('estado', '=', CUENTA_PEDIDA)
        .where('version', '=', cuenta.version)
        .returning('id')
        .executeTakeFirst(),
    );
    if (escrita === undefined) {
      throw new ErrorDominio(
        'ORDEN_NO_EDITABLE',
        'Esa cuenta cambió mientras se agregaba. Revísala antes de reintentar.',
      );
    }

    return auditar({
      ordenId: entrada.ordenId,
      lineas: preparadas.length,
      comandas: comandas.map(({ id, grupo }) => ({
        id,
        area: grupo.area,
        estacionId: grupo.estacion.id,
        estacionNombre: grupo.estacion.nombre,
        items: grupo.lineas.length,
      })),
      totalCentavos: totales.totalCentavos.toString(),
      version,
    });
  },
});

/** Sube la versión de una cuenta que cambió por el camino de siempre (que no la toca). */
async function subirLaVersion(
  tx: Transaccion,
  organizacionId: string,
  ordenId: string,
  versionLeida: number,
): Promise<number> {
  const version = versionLeida + 1;
  await tx
    .updateTable('ordenes')
    .set({ version })
    .where('organizacion_id', '=', organizacionId)
    .where('id', '=', ordenId)
    .where('version', '=', versionLeida)
    .execute();
  return version;
}
