import 'server-only';

import { ErrorDominio, validarEntorno, type Ambito } from '@morphiqpos/contracts';
import { repoComandos, type Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';

import { ROLES_QUE_AUTORIZAN, leerAutorizacion } from '../identidad/supervisor.ts';
import { payloadDeAuditoria } from '../saneado.ts';
import { sellarTransicionDeMesa } from './sala-escrituras.ts';

/**
 * REABRIR LA CUENTA PEDIDA PARA MANDAR UN PEDIDO DEL PORTAL (DP-13.3, punto 15).
 *
 * Los comensales arman su pedido en el portal; si entre tanto alguien pidió la cuenta (`cuenta_
 * solicitada`), el pedido ya no entra por el camino de siempre: la cuenta está en manos de la caja. El
 * mesero que lo confirma desde «Pedido del portal» puede REABRIRLA, y sólo si no se ha cobrado: la
 * cuenta vuelve a `confirmada` y la mesa a `ocupada`, y el envío sigue por el camino de siempre
 * (`comandarLasLineas`), que la avanza a «pedido enviado». Todo en la misma transacción que el envío:
 * si éste falla, la cuenta sigue pedida, tal cual estaba.
 *
 * Conserva el `codigo_caja` (el comensal ya tiene ese papel en la mano; al pedirla otra vez se
 * reutiliza, `restaurante/cuenta.ts`) y sube la versión de la cuenta, como cualquier cambio de sus
 * líneas, para que una caja que la tenía abierta sepa que cambió.
 *
 * ── Quién la reabre (DP-14.6, congruente con DP-D51) ───────────────────────
 * Reabrir deshace «la cuenta ya se pidió»: es del mismo peso que cancelarla. Gerente, administrador
 * y dueño la reabren; el MESERO, sólo en sus mesas (las que atiende o tiene asignadas, o las que
 * nadie atiende: las toma al enviar). A otro mesero le hace falta el PIN de un gerente, en una
 * autorización atada a ESA cuenta y `para: 'cancelacion'` (no hay un `para` propio: lo describe la
 * entrega). Y deja su PROPIA entrada en la auditoría (`restaurante.reabrir_cuenta`), con quién la
 * reabrió y quién la autorizó: la del envío sólo dice que se reabrió.
 */

export interface CuentaPorReabrir {
  readonly organizacionId: string;
  readonly sucursalId: string;
  readonly ordenId: string;
  readonly mesaId: string;
  readonly empleoId: string;
  readonly ahora: Date;
  /** Quién reabre: su sesión (el rol decide, nunca el cuerpo). */
  readonly ambito: Ambito;
  readonly correlationId: string;
  /** La autorización firmada de un gerente, si hace falta. */
  readonly autorizacion?: string | undefined;
}

/** Lanza si quien reabre no puede; devuelve quién autorizó (`null` si no hizo falta). */
async function exigirPermisoParaReabrir(
  tx: Transaccion,
  cuenta: CuentaPorReabrir,
): Promise<string | null> {
  const { organizacionId, ordenId, mesaId, empleoId, ambito } = cuenta;
  if (ROLES_QUE_AUTORIZAN.includes(ambito.rol)) return null;
  const fila = await tx
    .selectFrom('ordenes as o')
    .innerJoin('mesas as m', (j) =>
      j.onRef('m.id', '=', 'o.mesa_id').onRef('m.organizacion_id', '=', 'o.organizacion_id'),
    )
    .select([
      'o.empleado_atiende_id as deLaCuenta',
      'm.empleado_atiende_id as atiende',
      'm.empleado_asignado_id as asignado',
    ])
    .where('o.organizacion_id', '=', organizacionId)
    .where('o.id', '=', ordenId)
    .where('m.id', '=', mesaId)
    .executeTakeFirst();
  const responsables = [fila?.deLaCuenta, fila?.atiende, fila?.asignado].filter(
    (id): id is string => id !== null && id !== undefined,
  );
  if (responsables.length === 0 || responsables.includes(empleoId)) return null;

  const carga =
    cuenta.autorizacion === undefined
      ? null
      : leerAutorizacion(
          cuenta.autorizacion,
          { organizacionId, solicitaEmpleoId: empleoId, cuenta: ordenId, para: 'cancelacion' },
          validarEntorno(process.env).SESSION_SECRET,
          cuenta.ahora,
        );
  if (carga === null) {
    throw new ErrorDominio(
      'PUESTO_NO_OTORGABLE',
      cuenta.autorizacion === undefined
        ? 'Esa mesa la atiende otro mesero: reabrir su cuenta pide el PIN de un gerente o del dueño.'
        : 'Esa autorización venció o es de otra cuenta: que el gerente teclee su PIN otra vez.',
      { pidePin: true },
    );
  }
  return carga.supervisor;
}

/** Su propia entrada en la auditoría, en la misma transacción que la reapertura. */
async function auditarLaReapertura(
  tx: Transaccion,
  cuenta: CuentaPorReabrir,
  autorizadoPor: string | null,
): Promise<void> {
  await repoComandos.escribirAuditoria(tx, {
    organizacionId: cuenta.organizacionId,
    identidadId: cuenta.ambito.identidadId,
    terminalId: cuenta.ambito.terminalId,
    accion: 'restaurante.reabrir_cuenta',
    entidad: 'orden',
    entidadId: cuenta.ordenId,
    correlationId: cuenta.correlationId,
    payload: payloadDeAuditoria({
      v: 1,
      mesaId: cuenta.mesaId,
      reabrioEmpleoId: cuenta.empleoId,
      rol: cuenta.ambito.rol,
      autorizadoPor,
    }),
  });
}

/** Lanza si la cuenta, justo ahora y con candado, ya no está pedida o ya tiene pagos. */
async function exigirQueSeaReabrible(
  tx: Transaccion,
  organizacionId: string,
  ordenId: string,
): Promise<void> {
  const cuenta = await tx
    .selectFrom('ordenes')
    .select('estado')
    .where('organizacion_id', '=', organizacionId)
    .where('id', '=', ordenId)
    .forUpdate()
    .executeTakeFirst();
  if (cuenta?.estado !== 'cuenta_solicitada') {
    throw new ErrorDominio(
      'ORDEN_NO_EDITABLE',
      'Esa cuenta cambió mientras se reabría (quizá ya se cobró). Revísala en caja antes de reintentar.',
      { estado: cuenta?.estado ?? null },
    );
  }
  const pago = await tx
    .selectFrom('pagos')
    .select('id')
    .where('organizacion_id', '=', organizacionId)
    .where('orden_id', '=', ordenId)
    .executeTakeFirst();
  if (pago !== undefined) {
    throw new ErrorDominio(
      'CARRITO_CUENTA_CON_PAGOS',
      'Esa cuenta ya tiene pagos: no se reabre para mandarle más platillos. Termina de cobrarla.',
    );
  }
}

export async function reabrirLaCuentaPedida(
  tx: Transaccion,
  cuenta: CuentaPorReabrir,
): Promise<void> {
  const { organizacionId, ordenId, mesaId } = cuenta;
  await exigirQueSeaReabrible(tx, organizacionId, ordenId);
  const autorizadoPor = await exigirPermisoParaReabrir(tx, cuenta);
  await auditarLaReapertura(tx, cuenta, autorizadoPor);
  await tx
    .updateTable('ordenes')
    .set({ estado: 'confirmada', version: sql`version + 1`, updated_at: cuenta.ahora })
    .where('organizacion_id', '=', organizacionId)
    .where('id', '=', ordenId)
    .execute();

  const mesa = await tx
    .selectFrom('mesas')
    .select('estado')
    .where('organizacion_id', '=', organizacionId)
    .where('id', '=', mesaId)
    .executeTakeFirst();
  if (mesa?.estado !== 'cuenta_solicitada') return;
  await tx
    .updateTable('mesas')
    .set({ estado: 'ocupada', updated_at: cuenta.ahora })
    .where('organizacion_id', '=', organizacionId)
    .where('id', '=', mesaId)
    .execute();
  await sellarTransicionDeMesa(tx, {
    organizacionId,
    sucursalId: cuenta.sucursalId,
    mesaId,
    ordenId,
    estadoAnterior: 'cuenta_solicitada',
    estadoNuevo: 'ocupada',
    empleadoId: cuenta.empleoId,
    ahora: cuenta.ahora,
  });
}
