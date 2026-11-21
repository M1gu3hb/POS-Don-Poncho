import 'server-only';

import { ErrorDominio } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';

import { moverElCarrito } from './carrito-del-salon.ts';
import { llevarLasNotasALaPrincipal } from './notas-de-la-union.ts';
import { registrarEventoMesa, type MesaEnSala } from './sala-escrituras.ts';

/**
 * EL NÚCLEO DE UNIR (F-302, DP-9.6) que comparten «Unir mesas» y «Agregar mesas» (DP-24 · P5):
 * meter mesas a una unión que ya existe en la tabla, moviendo lo suyo a la cuenta de la principal.
 * Hay UN solo camino: agregar no reescribe ninguna regla de unir, la reusa.
 *
 * ── El consumo se MUEVE, no se copia ───────────────────────────────────────
 * Las líneas y las comandas de la cuenta absorbida cambian de `orden_id`. Copiarlas dejaría el
 * mismo platillo en dos cuentas y el comensal lo pagaría dos veces; y la cuenta absorbida pasa a
 * `absorbida`, un estado que el trigger de la 071 impide cobrar por la misma razón.
 *
 * ── Las mesas miembro se quedan SIN cuenta propia ──────────────────────────
 * `orden_activa_id` a nulo: es lo que hace imposible comandar en la 5 mientras el grupo se cobra
 * en la 4.
 */

/** Estados de cuenta que todavía están sobre una mesa. */
export const CUENTAS_VIVAS = [
  'borrador',
  'confirmada',
  'en_preparacion',
  'lista',
  'cuenta_solicitada',
] as const;

export interface MiembroPorUnir {
  readonly mesa: MesaEnSala;
  readonly ordenId: string | null;
}

export interface DatosDeMiembros {
  readonly organizacionId: string;
  readonly unionId: string;
  readonly principal: MesaEnSala;
  /** `null`: una unión sin cuenta todavía (DP-9.6); ninguna absorbida puede traer consumo. */
  readonly ordenPrincipalId: string | null;
  readonly miembros: readonly MiembroPorUnir[];
  readonly empleadoId: string;
  readonly ahora: Date;
  /** Dónde estaba cada mesa antes de unir: separar la regresa ahí. */
  readonly originales: ReadonlyMap<string, { readonly x: number; readonly y: number }>;
}

export interface MiembrosSumados {
  readonly lineasMovidas: number;
  readonly cuentasAbsorbidas: number;
  /** La gente de las mesas que entraron (sin la de la principal). */
  readonly personas: number;
}

export async function sumarMiembros(
  tx: Transaccion,
  datos: DatosDeMiembros,
): Promise<MiembrosSumados> {
  let lineasMovidas = 0;
  let cuentasAbsorbidas = 0;
  let personas = 0;

  for (const { mesa, ordenId } of datos.miembros) {
    if (ordenId !== null) {
      lineasMovidas += await absorberLaCuenta(tx, datos, mesa, ordenId);
      cuentasAbsorbidas += 1;
    }

    await tx
      .insertInto('union_mesa_miembros')
      .values({
        union_id: datos.unionId,
        mesa_id: mesa.id,
        orden_absorbida_id: ordenId,
        union_abierta: true,
        posicion_x_original: datos.originales.get(mesa.id)?.x ?? null,
        posicion_y_original: datos.originales.get(mesa.id)?.y ?? null,
      })
      .execute();

    await tx
      .updateTable('mesas')
      .set({
        estado: datos.principal.estado,
        orden_activa_id: null,
        ocupada_desde: mesa.ocupadaDesde ?? datos.ahora,
        empleado_atiende_id: datos.principal.empleadoAtiendeId,
        // DP-9.6: el mapa la oculta y su QR cae en la principal.
        unida_a_mesa_id: datos.principal.id,
      })
      .where('organizacion_id', '=', datos.organizacionId)
      .where('id', '=', mesa.id)
      .execute();

    await registrarEventoMesa(tx, {
      organizacionId: datos.organizacionId,
      sucursalId: mesa.sucursalId,
      mesaId: mesa.id,
      ordenId: datos.ordenPrincipalId,
      estadoAnterior: mesa.estado,
      estadoNuevo: datos.principal.estado,
      personas: mesa.personas,
      empleadoId: datos.empleadoId,
      ahora: datos.ahora,
    });

    // DP-12.2: el carrito del portal de la absorbida (y sus teléfonos) pasa a la principal: su QR
    // ya cae ahí, y lo que habían armado no se queda huérfano hasta separar.
    await moverElCarrito(tx, datos.organizacionId, mesa.id, datos.principal.id, datos.ahora);
    // DP-12.3: y sus alergias y su celebración, que se quedaban ocultas en la absorbida.
    await llevarLasNotasALaPrincipal(
      tx,
      datos.organizacionId,
      { mesaId: datos.principal.id, ordenId: datos.ordenPrincipalId },
      { mesaId: mesa.id, ordenId },
    );

    personas += mesa.personas;
  }

  return { lineasMovidas, cuentasAbsorbidas, personas };
}

/** Mueve comandas y líneas de la cuenta absorbida a la de la principal y la sella. */
async function absorberLaCuenta(
  tx: Transaccion,
  datos: DatosDeMiembros,
  mesa: MesaEnSala,
  ordenId: string,
): Promise<number> {
  if (datos.ordenPrincipalId === null) {
    throw new ErrorDominio(
      'ORDEN_NO_EDITABLE',
      `La cuenta de la mesa ${String(mesa.numero)} necesita una cuenta en la principal que la absorba.`,
    );
  }
  // Lo que cocina tiene en marcha para esta mesa pasa a la cuenta del grupo (D-3): así
  // «Marcar entregado» en la principal alcanza lo que se pidió en la unida.
  await tx
    .updateTable('comandas')
    .set({ orden_id: datos.ordenPrincipalId, updated_at: datos.ahora })
    .where('organizacion_id', '=', datos.organizacionId)
    .where('orden_id', '=', ordenId)
    .execute();
  const movidas = await tx
    .updateTable('orden_lineas')
    .set({ orden_id: datos.ordenPrincipalId, updated_at: datos.ahora })
    .where('organizacion_id', '=', datos.organizacionId)
    .where('orden_id', '=', ordenId)
    .executeTakeFirst();

  // Se sella DESPUÉS de mover: mientras las líneas viajaban, la cuenta absorbida seguía siendo su
  // dueña y el `where` de estado seguía valiendo.
  const sellada = await tx
    .updateTable('ordenes')
    .set({
      estado: 'absorbida',
      union_id: datos.unionId,
      subtotal_centavos: 0n,
      descuento_centavos: 0n,
      impuestos_centavos: 0n,
      total_centavos: 0n,
      costo_total_centavos: 0n,
      utilidad_centavos: 0n,
      margen_bp: 0,
      updated_at: datos.ahora,
    })
    .where('organizacion_id', '=', datos.organizacionId)
    .where('id', '=', ordenId)
    .where('estado', 'in', [...CUENTAS_VIVAS])
    .executeTakeFirst();

  if (Number(sellada.numUpdatedRows) !== 1) {
    throw new ErrorDominio(
      'ORDEN_NO_EDITABLE',
      `La cuenta de la mesa ${mesa.numero} cambió mientras se unían las mesas.`,
    );
  }
  return Number(movidas.numUpdatedRows);
}

export interface DatosDeUnion {
  readonly organizacionId: string;
  readonly principal: MesaEnSala;
  /** `null`: una unión del salón sin cuenta todavía (DP-9.6); la toma al abrirse una. */
  readonly ordenPrincipalId: string | null;
  readonly miembros: readonly MiembroPorUnir[];
  readonly empleadoId: string;
  readonly ahora: Date;
  /** DP-9.6 · Dónde estaba cada mesa del grupo antes de unir: separar la regresa ahí. */
  readonly originales: ReadonlyMap<string, { readonly x: number; readonly y: number }>;
}

export interface UnionEscrita {
  readonly unionId: string;
  readonly lineasMovidas: number;
  readonly cuentasAbsorbidas: number;
}

/**
 * F-302 · Diez personas juntan las mesas 4 y 5, y el sistema deja de ver dos: se abre la unión y
 * se le suman las mesas (`sumarMiembros`). Las líneas de las cuentas absorbidas cambian de
 * `orden_id` —el consumo se MUEVE, no se copia— y las mesas miembro se quedan sin cuenta propia.
 */
export async function unirMesas(tx: Transaccion, datos: DatosDeUnion): Promise<UnionEscrita> {
  const union = await tx
    .insertInto('uniones_mesa')
    .values({
      organizacion_id: datos.organizacionId,
      sucursal_id: datos.principal.sucursalId,
      mesa_principal_id: datos.principal.id,
      orden_id: datos.ordenPrincipalId,
      abierta_en: datos.ahora,
      empleado_id: datos.empleadoId,
      principal_x_original: datos.originales.get(datos.principal.id)?.x ?? null,
      principal_y_original: datos.originales.get(datos.principal.id)?.y ?? null,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const sumados = await sumarMiembros(tx, { ...datos, unionId: union.id });

  if (datos.ordenPrincipalId !== null) {
    await tx
      .updateTable('ordenes')
      .set({ union_id: union.id, updated_at: datos.ahora })
      .where('organizacion_id', '=', datos.organizacionId)
      .where('id', '=', datos.ordenPrincipalId)
      .execute();
  }

  // La principal recibe a toda la gente: es la que va a decir «mesa de diez».
  await tx
    .updateTable('mesas')
    .set({ personas_actuales: datos.principal.personas + sumados.personas })
    .where('organizacion_id', '=', datos.organizacionId)
    .where('id', '=', datos.principal.id)
    .execute();

  const resultado = {
    unionId: union.id,
    lineasMovidas: sumados.lineasMovidas,
    cuentasAbsorbidas: sumados.cuentasAbsorbidas,
  };
  // Sin cuenta no hay movimiento de cuenta que registrar: la unión queda en su tabla.
  if (datos.ordenPrincipalId === null) return resultado;
  await anotarElMovimientoDeUnion(tx, datos, datos.ordenPrincipalId);
  return resultado;
}

/** El renglón de `movimientos_cuenta` de una unión (o de una ampliación del grupo). */
export async function anotarElMovimientoDeUnion(
  tx: Transaccion,
  datos: Pick<DatosDeUnion, 'organizacionId' | 'principal' | 'miembros' | 'empleadoId' | 'ahora'>,
  ordenPrincipalId: string,
): Promise<void> {
  await tx
    .insertInto('movimientos_cuenta')
    .values({
      organizacion_id: datos.organizacionId,
      sucursal_id: datos.principal.sucursalId,
      tipo: 'union',
      orden_origen_id: ordenPrincipalId,
      mesa_origen_id: datos.principal.id,
      lineas: JSON.stringify(
        datos.miembros.map((m) => ({
          mesa: m.mesa.numero,
          orden_absorbida_id: m.ordenId,
          personas: m.mesa.personas,
        })),
      ),
      empleado_id: datos.empleadoId,
      created_at: datos.ahora,
    })
    .execute();
}
