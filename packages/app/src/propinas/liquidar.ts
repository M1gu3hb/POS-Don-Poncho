import 'server-only';

import { ErrorDominio, PAQUETES_RESTAURANTE, validarEntorno } from '@morphiqpos/contracts';
import { repoCaja, type Transaccion } from '@morphiqpos/data';

import { definirComando } from '../definicion.ts';
import { ROLES_QUE_AUTORIZAN, leerAutorizacion } from '../identidad/supervisor.ts';
import { gastarLaAutorizacion } from '../venta/autorizacion-de-un-uso.ts';
import {
  desglosarPagos,
  servirDesglose,
  type DesgloseServible,
  type PropinaDeMesero,
} from './desglose.ts';
import { entradaLiquidarPropinas } from './esquemas.ts';
import { tomarFolioDeLiquidacion } from './folio.ts';
import {
  desgloseDeOrdenes,
  ordenesDeOtraLiquidacion,
  propinasPorMeseroDeOrdenes,
  reclamarOrdenes,
} from './liquidadas.ts';
import { repartirLiquidacion, type RepartoEscrito } from './pool.ts';
import { resolverRango } from './rango.ts';
import { explicarReclamo } from './reclamo.ts';

/**
 * `propinas.liquidar` — E6-7, una de las 14 operaciones transaccionales.
 *
 * UNA transacción crea la liquidación con su folio de la serie `LIQ` y marca las
 * N órdenes del periodo. O las dos cosas, o ninguna.
 *
 * ── Qué se arregla exactamente ─────────────────────────────────────────────
 * `LiquidarPropinasDialog.jsx:93-126` hace tres cosas mal a la vez:
 *
 *   · crea la `LiquidacionPropina` y DESPUÉS marca las ventas en lotes de cinco,
 *     así que un fallo a mitad deja la liquidación hecha y ventas sin marcar;
 *   · en `:122` se traga esos errores con un `console.error`, de modo que la
 *     pantalla dice «liquidado» y la propina se vuelve a liquidar mañana;
 *   · manda `total_liquidado` calculado en el navegador (`:103`) sobre una lista
 *     que lleva minutos abierta.
 *
 * Aquí el total lo suma el servidor de `pagos.propina_centavos`, y lo suma sobre
 * las órdenes que ESTA transacción reclamó, no sobre las que una lectura anterior
 * vio. Y `propina_liquidada` no se guarda: se deriva de
 * `propina_liquidacion_id is not null` (F1-04 §6.4). Un booleano que puede
 * desincronizarse del puntero acaba desincronizándose.
 */

/** La serie del folio de liquidación. `folios.serie` exige `^[A-Z]{1,6}$`. */
export const SERIE_LIQUIDACION = 'LIQ';

export interface ResultadoLiquidacion {
  readonly liquidacionId: string;
  /** `LIQ-000042`. Sustituye a `LIQ-AAAAMMDD-HHMMSS` de `:92` (D-20). */
  readonly folio: string;
  readonly totalCentavos: string;
  readonly numeroVentas: number;
  readonly desglose: DesgloseServible;
  readonly meseros: readonly PropinaDeMesero[];
  /** F-242 · Nulo cuando la liquidación reparte directo al mesero. */
  readonly reparto: RepartoEscrito | null;
  /** DP-24 · Lo que salió del cajón de esta caja al entregarla; «0» si no se entregó de la caja. */
  readonly entregadoDeLaCajaCentavos: string;
}

/** El movimiento del cajón que deja una liquidación entregada desde la caja (135). */
const SALIDA_DE_PROPINA = 'propina_entregada';

/**
 * DP-24 · Liquidar es de gerencia (dueño, administrador y gerente), como siempre. La CAJERA entra
 * sólo por un camino: desde el corte (`entregarDeLaCaja`) y con el PIN de un gerente, porque es
 * quien cierra la caja y quien tiene los billetes en la mano; sin las dos cosas, se le rechaza.
 */
const ROLES = ['dueno', 'administrador', 'gerente', 'cajero'] as const;

/**
 * Quien liquida POR SU CUENTA, sin el PIN de nadie: la dirección. A ellos —y sólo a ellos— el puente
 * les enseña si una propina ya se liquidó (`puente/autorizacion.test.ts`, §7.5): la cajera entrega
 * lo que el corte le lista, autorizada, pero no consulta ese estado.
 */
export const LIQUIDAN_POR_SU_CUENTA: readonly (typeof ROLES)[number][] = ROLES.filter((rol) =>
  ROLES_QUE_AUTORIZAN.includes(rol),
);

const SOLO_CON_PIN =
  'Entregar propinas de la caja lo autoriza un gerente, administrador o dueño con su PIN.';

export const liquidarPropinas = definirComando<
  Transaccion,
  typeof entradaLiquidarPropinas,
  ResultadoLiquidacion
>({
  nombre: 'propinas.liquidar',
  entidad: 'liquidacion_propina',
  escribe: true,
  // Sólo el administrador liquida, como hoy: el diálogo vive en Dashboard y en
  // Registros, y `permissions.js:5,19` reserva las dos a `ROLES.ADMIN`. En el
  // modelo nuevo ese rol son tres (`F1-04` §12.3): dueño, administrador y gerente.
  roles: ROLES,
  // La propina es dinero de meseros: existe donde se sirve comida en mesa.
  paquetes: PAQUETES_RESTAURANTE,
  sucursal: {
    meseroId: 'empleos',
    'ordenIds[]': 'ordenes',
    esquemaId: 'esquemas_propina',
    'beneficiarios[].empleoId': 'empleos',
  },
  entrada: entradaLiquidarPropinas,
  async ejecutar(ctx, entrada) {
    const { organizacionId, sucursalId, empleoId, terminalId, rol } = ctx.ambito;
    const pidePin = !ROLES_QUE_AUTORIZAN.includes(rol);
    if (pidePin && entrada.entregarDeLaCaja !== true) {
      throw new ErrorDominio(
        'PUESTO_NO_OTORGABLE',
        'Liquidar propinas es de gerencia. Desde el corte, la caja las entrega con el PIN de un gerente.',
      );
    }
    if (pidePin && entrada.autorizacion === undefined) {
      throw new ErrorDominio('PUESTO_NO_OTORGABLE', SOLO_CON_PIN, { pidePin: true });
    }
    if (sucursalId === null) {
      throw new ErrorDominio(
        'LIQUIDACION_INVALIDA',
        'Para liquidar propinas hace falta estar en una sucursal.',
      );
    }

    // 0 · DP-24 · Si se entrega DE LA CAJA, tiene que haber una caja abierta en este aparato: es
    //     de su cajón de donde salen los billetes. Se comprueba antes de escribir nada.
    const cajaQueEntrega =
      entrada.entregarDeLaCaja === true
        ? await ctx.paso('cargar_caja', () =>
            terminalId === null
              ? Promise.resolve(null)
              : repoCaja.sesionAbiertaDeTerminal(ctx.tx, organizacionId, terminalId),
          )
        : null;
    if (entrada.entregarDeLaCaja === true && cajaQueEntrega === null) {
      throw new ErrorDominio(
        'CAJA_CERRADA',
        'Para entregar las propinas en efectivo hace falta la caja abierta en este aparato.',
      );
    }

    const rango = resolverRango(entrada.desde, entrada.hasta);
    const meseroId = entrada.meseroId ?? null;
    // Sin repetidos. Un identificador repetido —una lista construida por
    // concatenación, un doble render— hacía `solicitadas.length` 2 contra
    // `reclamadas.length` 1, y `explicarReclamo` abortaba con
    // LIQUIDACION_INVALIDA una liquidación que estaba perfectamente bien.
    const solicitadas = [...new Set(entrada.ordenIds ?? [])];
    // `undefined` (no `length === 0`) es lo único que significa «sin filtro de
    // ids». Colapsar `[]` en `null` liquidaba TODO el periodo cuando la pantalla
    // mandaba una lista vacía, que es exactamente lo contrario de lo que una
    // lista vacía pide. Hoy el esquema ya rechaza `[]` con `.min(1)`
    // (`esquemas.ts`), y esto lo vuelve a decir aquí para que quitar una de las
    // dos guardas no reabra el hueco en silencio.
    const filtroIds = entrada.ordenIds === undefined ? null : solicitadas;

    // 1 · El folio, DENTRO de la transacción y consecutivo POR ORGANIZACIÓN,
    //     que es lo que exige `liquidaciones_folio_unico`. El porqué —y por qué
    //     no puede salir de `folios`— está en `folio.ts`.
    const folio = await ctx.paso('tomar_folio', () =>
      tomarFolioDeLiquidacion(ctx.tx, organizacionId, SERIE_LIQUIDACION),
    );

    // 2 · La cabecera nace con total cero a propósito: el importe se sabe DESPUÉS
    //     de reclamar, y el reclamo necesita este id para apuntar las órdenes.
    const liquidacion = await ctx.paso('crear_liquidacion', () =>
      ctx.tx
        .insertInto('liquidaciones_propina')
        .values({
          organizacion_id: organizacionId,
          sucursal_id: sucursalId,
          serie: folio.serie,
          folio: folio.folio,
          liquidada_en: ctx.ahora,
          rango_inicio: rango.inicio,
          rango_fin: rango.fin,
          rango_tipo: entrada.rangoTipo,
          empleado_id: meseroId,
          total_centavos: 0n,
          empleado_liquida_id: empleoId,
          notas: entrada.notas ?? null,
        })
        .returning('id')
        .executeTakeFirstOrThrow(),
    );

    // 3 · El reclamo. Es la protección, y es un solo `UPDATE`: la guarda
    //     `propina_liquidacion_id is null` va en el `WHERE`, así que dos
    //     liquidaciones simultáneas del mismo periodo se serializan en la fila y
    //     la segunda no vuelve a reclamar lo que la primera ya marcó. No hay un
    //     `if` previo que otra transacción pueda invalidar.
    const ids = await ctx.paso('reclamar_ordenes', () =>
      reclamarOrdenes(ctx.tx, {
        // `sucursalId` va en el filtro y no sólo en la cabecera: la fila se
        // sella con la sucursal de la SESIÓN, así que reclamar órdenes de otra
        // sucursal dejaba las ventas de Norte apuntando a una liquidación de
        // Centro — sus meseros veían «$0.00 pendiente» y su propina figuraba en
        // la caja de la otra sucursal.
        filtro: { organizacionId, sucursalId, meseroId, ...rango },
        liquidacionId: liquidacion.id,
        ahora: ctx.ahora,
        ordenIds: filtroIds,
      }),
    );

    // 4 · Explicar la diferencia, si la hay. La base ya decidió; esto sólo
    //     traduce su decisión a algo que el administrador entienda, y aborta la
    //     transacción entera en vez de liquidar «casi todas».
    const yaLiquidadas =
      solicitadas.length > 0 && ids.length !== solicitadas.length
        ? await ordenesDeOtraLiquidacion(ctx.tx, organizacionId, solicitadas, liquidacion.id)
        : [];
    const problema = explicarReclamo({ solicitadas, reclamadas: ids, yaLiquidadas });
    if (problema !== null) throw problema;

    // 5 · El importe, del servidor y sobre lo reclamado. Exacto por método: cada
    //     fila de `pagos` trae su `metodo` y su `propina_centavos`, así que esto
    //     es una suma por grupo y nunca un reparto proporcional (regla 3).
    const renglones = await ctx.paso('sumar_propinas', () =>
      desgloseDeOrdenes(ctx.tx, organizacionId, ids),
    );
    const desglose = desglosarPagos(renglones);

    await ctx.paso('fijar_total', () =>
      ctx.tx
        .updateTable('liquidaciones_propina')
        .set({ total_centavos: desglose.propinasCentavos })
        .where('organizacion_id', '=', organizacionId)
        .where('id', '=', liquidacion.id)
        .executeTakeFirstOrThrow(),
    );

    // `venta_ids` y `desglose_meseros` NO se guardan como JSON (F1-04 §30.1):
    // se derivan de `ordenes.propina_liquidacion_id`, que además hace
    // consultable qué ventas entraron, que es lo que hace falta para revertirla.
    //
    // Va envuelta en `ctx.paso` como todo lo demás: era la única lectura del
    // comando sin nombre, y sin nombre no se puede interrumpir desde
    // `peticion.interrumpirEn` (`comando.ts:170-176`), que es el mecanismo con
    // el que este repositorio prueba que la reversión se lleva TODO.
    const meseros = await ctx.paso('desglose_meseros', () =>
      propinasPorMeseroDeOrdenes(ctx.tx, organizacionId, ids),
    );

    // 5.5 · DP-24 · LO ENTREGADO SALE DEL CAJÓN. La propina cobrada con tarjeta también se entrega
    //       en billetes: lo que sale es el total de la liquidación, no sólo la parte en efectivo.
    //       Va como movimiento propio (`propina_entregada`, negativo) y NO como gasto ni retiro:
    //       no es dinero del negocio, sólo lo custodiaba. El arqueo espera la SUMA de los
    //       movimientos, así que el esperado del corte baja solo y el conteo cuadra.
    const entregado = cajaQueEntrega === null ? 0n : desglose.propinasCentavos;

    // 5.4 · DP-24 · El PIN de quien autoriza a la cajera, atado a ESTE importe y de un solo uso. Va
    //       aquí, ya con el total sumado por el servidor: si entró otra propina desde que se pidió
    //       el PIN, la autorización es de otro monto y no pasa (se revierte todo).
    let autorizadoPor: string | null = null;
    let autorizacionGastada: string | null = null;
    if (pidePin) {
      const leida = leerAutorizacion(
        entrada.autorizacion ?? '',
        { organizacionId, solicitaEmpleoId: empleoId, para: 'retiro', montoCentavos: entregado },
        validarEntorno(process.env).SESSION_SECRET,
        ctx.ahora,
      );
      if (leida === null) {
        throw new ErrorDominio(
          'PUESTO_NO_OTORGABLE',
          'La autorización venció o es de otro monto: que quien autoriza teclee su PIN otra vez.',
          { pidePin: true },
        );
      }
      await ctx.paso('gastar_autorizacion', () =>
        gastarLaAutorizacion(ctx.tx, organizacionId, leida),
      );
      autorizadoPor = leida.supervisor;
      autorizacionGastada = leida.n;
    }
    if (cajaQueEntrega !== null && entregado > 0n) {
      const sesionCajaId = cajaQueEntrega.id;
      await ctx.paso('salida_de_la_caja', () =>
        repoCaja.registrarMovimiento(ctx.tx, {
          organizacionId,
          sesionCajaId,
          tipo: SALIDA_DE_PROPINA,
          montoCentavos: -entregado,
          referenciaTipo: 'liquidacion',
          referenciaId: liquidacion.id,
          empleadoId: empleoId,
          motivo: `Propinas entregadas · ${folioVisible(folio.serie, folio.folio)}`,
        }),
      );
      await ctx.paso('sellar_la_caja', () =>
        ctx.tx
          .updateTable('liquidaciones_propina')
          .set({ sesion_caja_id: sesionCajaId })
          .where('organizacion_id', '=', organizacionId)
          .where('id', '=', liquidacion.id)
          .executeTakeFirstOrThrow(),
      );
    }

    // 6 · F-242 · El reparto por puntos, si esta liquidación lo lleva. Va
    //     DESPUÉS de fijar el total: reparte lo que de verdad entró, no lo que
    //     una lectura anterior creía que iba a entrar.
    const esquemaId = entrada.esquemaId;
    const reparto =
      esquemaId === undefined
        ? null
        : await ctx.paso('repartir_por_puntos', () =>
            repartirLiquidacion(ctx.tx, {
              organizacionId,
              sucursalId,
              liquidacionId: liquidacion.id,
              esquemaId,
              totalCentavos: desglose.propinasCentavos,
              pedidos: entrada.beneficiarios ?? [],
              liquidadaEn: ctx.ahora,
            }),
          );

    ctx.auditar({
      entidadId: liquidacion.id,
      payload: {
        folio: folioVisible(folio.serie, folio.folio),
        totalCentavos: desglose.propinasCentavos.toString(),
        numeroVentas: ids.length,
        rangoTipo: entrada.rangoTipo,
        meseroId,
        ...(entregado > 0n ? { entregadoDeLaCajaCentavos: entregado.toString() } : {}),
        // Quién autorizó a la cajera, y la autorización que gastó (no se reusa).
        ...(autorizadoPor === null ? {} : { autorizadoPor, autorizacion: autorizacionGastada }),
      },
    });

    return {
      liquidacionId: liquidacion.id,
      folio: folioVisible(folio.serie, folio.folio),
      totalCentavos: desglose.propinasCentavos.toString(),
      numeroVentas: ids.length,
      desglose: servirDesglose(desglose),
      meseros,
      reparto,
      entregadoDeLaCajaCentavos: entregado.toString(),
    };
  },
});

/** `LIQ` + consecutivo a seis cifras, igual que el folio de venta (§6.2). */
export function folioVisible(serie: string, folio: bigint): string {
  return `${serie}-${folio.toString().padStart(6, '0')}`;
}
