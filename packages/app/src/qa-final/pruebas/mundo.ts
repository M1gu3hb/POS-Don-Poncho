/**
 * DP-22 · EL MUNDO DE LAS COMBINACIONES: el salón de prueba más lo que las cuentas de dinero
 * necesitan (un platillo por peso con una opción con precio, otro por pieza con su opción, el
 * gerente que autoriza, el dueño que fija el IVA y un mesero que elige la propina).
 *
 * Todo entra por los comandos de producción; sólo el catálogo se siembra con SQL, como hace
 * `salon-real.ts`. Los precios terminan en centavos que no se dejan dividir.
 */
import type { Ambito, Resultado } from '@morphiqpos/contracts';
import { obtenerDb } from '@morphiqpos/data';

import { firmarAutorizacion, type CargaDeAutorizacion } from '../../identidad/supervisor.ts';
import { comando } from '../../produccion.ts';
import { clave, exigirOk, sembrarCompanero } from '../../pruebas/negocio-real.ts';
import { fijarImpuesto } from '../../configuracion/impuesto.ts';
import { fijarQuienEligeLaPropina } from '../../propinas/quien-elige.ts';
import {
  descontarCuenta,
  type ResultadoDescuentoDeCuenta,
} from '../../restaurante/descuento-de-cuenta.ts';
import {
  PRECIO_ARRACHERA,
  PRECIO_CERVEZA,
  PRECIO_GUACAMOLE,
  ambitoDeCaja,
  sembrarSalon,
  type Salon,
} from '../../restaurante/pruebas/salon-real.ts';

/** El secreto con que se firman las autorizaciones en esta suite (se sustituye `validarEntorno`). */
export const SECRETO = 'secreto_de_integracion_de_las_combinaciones_de_dinero_2026';

export const PRECIO_KILO_BARBACOA = 79_500n;
export const OPCION_QUESO = 1_500n;
export const OPCION_HARINA = 2_000n;

/** Lo que se pide en cada cuenta: dos arracheras, dos guacamoles con queso, una cerveza y 0.75 kg. */
export const PEDIDO = {
  arrachera: { precio: PRECIO_ARRACHERA, cantidad: '2' },
  guacamole: { precio: PRECIO_GUACAMOLE, cantidad: '2', opcion: OPCION_QUESO },
  cerveza: { precio: PRECIO_CERVEZA, cantidad: '1' },
  barbacoa: { precio: PRECIO_KILO_BARBACOA, cantidad: '0.75', opcion: OPCION_HARINA },
} as const;

export interface Quienes {
  readonly cajera: Ambito;
  readonly mesero: Ambito;
  readonly gerente: Ambito;
  readonly administrador: Ambito;
  readonly dueno: Ambito;
}

export interface Mundo {
  readonly salon: Salon;
  readonly barbacoaId: string;
  readonly grupoTotopos: string;
  readonly opcionQueso: string;
  readonly grupoTortillas: string;
  readonly opcionHarina: string;
  readonly fondoCentavos: number;
  /** Quién es quién en la caja (terminal) de índice `terminal`: una caja por renglón de la tabla. */
  quienes(terminal: number): Quienes;
}

async function grupoDeOpciones(
  organizacionId: string,
  nombre: string,
  opciones: readonly (readonly [string, bigint])[],
  productoId: string,
): Promise<{ readonly grupo: string; readonly opciones: Readonly<Record<string, string>> }> {
  const db = obtenerDb();
  const fila = await db
    .insertInto('modificadores')
    .values({ organizacion_id: organizacionId, nombre, tipo: 'unica', obligatorio: true })
    .returning('id')
    .executeTakeFirstOrThrow();
  const ids: Record<string, string> = {};
  for (const [i, [nombreOpcion, delta]] of opciones.entries()) {
    const op = await db
      .insertInto('modificador_opciones')
      .values({
        modificador_id: fila.id,
        nombre: nombreOpcion,
        orden: i,
        delta_precio_centavos: delta,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    ids[nombreOpcion] = op.id;
  }
  await db
    .insertInto('producto_modificadores')
    .values({
      organizacion_id: organizacionId,
      producto_id: productoId,
      modificador_id: fila.id,
      orden: 0,
    })
    .execute();
  return { grupo: fila.id, opciones: ids };
}

export async function sembrarMundo(opciones: {
  readonly nombre: string;
  readonly mesas: number;
  readonly terminales?: number;
}): Promise<Mundo> {
  const salon = await sembrarSalon({
    nombre: opciones.nombre,
    mesas: opciones.mesas,
    terminales: opciones.terminales ?? 1,
  });
  const org = salon.negocio.organizacionId;
  const db = obtenerDb();
  // Existencia de sobra: 112 cuentas gastan más que el almacén inicial del salón, y aquí no se prueba el faltante.
  await db
    .updateTable('existencias')
    .set({ cantidad: '1000000' })
    .where('organizacion_id', '=', org)
    .execute();

  const barbacoa = await db
    .insertInto('productos')
    .values({
      organizacion_id: org,
      nombre: 'Barbacoa de horno',
      precio_venta_centavos: PRECIO_KILO_BARBACOA,
      costo_unitario_centavos: 30_000n,
      tipo_venta: 'variable_medida',
      unidad_venta: 'kg',
      unidad_variable: 'kg',
      precio_por_unidad_variable_centavos: PRECIO_KILO_BARBACOA,
      estrategia_consumo: 'ninguno',
      area_preparacion: 'cocina',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const totopos = await grupoDeOpciones(
    org,
    'Totopos',
    [
      ['Normales', 0n],
      ['Con queso', OPCION_QUESO],
    ],
    salon.platillos.guacamole,
  );
  const tortillas = await grupoDeOpciones(
    org,
    'Tortillas',
    [
      ['Maíz', 0n],
      ['Harina', OPCION_HARINA],
    ],
    barbacoa.id,
  );

  const gerenteId = await sembrarCompanero(salon.negocio, { nombre: 'La Gerente', rol: 'gerente' });
  const adminId = await sembrarCompanero(salon.negocio, {
    nombre: 'El Admin',
    rol: 'administrador',
  });
  const duenoId = await sembrarCompanero(salon.negocio, { nombre: 'Don Poncho', rol: 'dueno' });
  const meseroId = await sembrarCompanero(salon.negocio, { nombre: 'El Mesero', rol: 'mesero' });
  const conRol = (terminal: number, rol: string, empleoId: string): Ambito =>
    ({ ...ambitoDeCaja(salon, terminal), rol, empleoId }) as Ambito;
  return {
    salon,
    barbacoaId: barbacoa.id,
    grupoTotopos: totopos.grupo,
    opcionQueso: totopos.opciones['Con queso'] ?? '',
    grupoTortillas: tortillas.grupo,
    opcionHarina: tortillas.opciones['Harina'] ?? '',
    fondoCentavos: 50_000,
    quienes: (terminal) => ({
      cajera: ambitoDeCaja(salon, terminal),
      mesero: conRol(terminal, 'mesero', meseroId),
      gerente: conRol(terminal, 'gerente', gerenteId),
      administrador: conRol(terminal, 'administrador', adminId),
      dueno: conRol(terminal, 'dueno', duenoId),
    }),
  };
}

// ── La configuración, por sus comandos ───────────────────────────────────────

export type IvaDelModelo =
  'sin_iva' | 'iva8_incluido' | 'iva8_sumado' | 'iva16_incluido' | 'iva16_sumado';

export interface ReglaDeIva {
  readonly puntosBase: number;
  readonly incluidoEnPrecio: boolean;
}

export const IVAS: Readonly<Record<IvaDelModelo, ReglaDeIva>> = {
  sin_iva: { puntosBase: 0, incluidoEnPrecio: true },
  iva8_incluido: { puntosBase: 800, incluidoEnPrecio: true },
  iva8_sumado: { puntosBase: 800, incluidoEnPrecio: false },
  iva16_incluido: { puntosBase: 1_600, incluidoEnPrecio: true },
  iva16_sumado: { puntosBase: 1_600, incluidoEnPrecio: false },
};

export async function fijarElIva(mundo: Mundo, iva: ReglaDeIva): Promise<void> {
  exigirOk(
    await comando(fijarImpuesto, {
      entrada: iva,
      ambito: mundo.quienes(0).dueno,
      idempotencyKey: clave(),
    }),
    'configuracion.fijar_impuesto',
  );
}

export async function fijarQuienEligeLaPropinaEnElMundo(
  mundo: Mundo,
  quien: { readonly comensales: boolean; readonly mesero: boolean; readonly caja: boolean },
): Promise<void> {
  exigirOk(
    await comando(fijarQuienEligeLaPropina, {
      entrada: quien,
      ambito: mundo.quienes(0).dueno,
      idempotencyKey: clave(),
    }),
    'configuracion.fijar_quien_elige_la_propina',
  );
}

// ── Descuento con la firma de un supervisor ──────────────────────────────────

export function firmaDeDescuento(
  mundo: Mundo,
  terminal: number,
  quien: Ambito,
  ordenId: string,
  montoCentavos: number,
): string {
  const carga: CargaDeAutorizacion = {
    org: mundo.salon.negocio.organizacionId,
    supervisor: quien.empleoId,
    rol: quien.rol,
    solicita: mundo.quienes(terminal).cajera.empleoId,
    exp: Math.floor(Date.now() / 1000) + 300,
    n: clave(),
    cuenta: ordenId,
    para: 'descuento',
    monto: String(montoCentavos),
  };
  return firmarAutorizacion(carga, SECRETO);
}

export function descontarLaCuenta(
  mundo: Mundo,
  terminal: number,
  ordenId: string,
  quien: Ambito,
  montoCentavos: number,
): Promise<Resultado<ResultadoDescuentoDeCuenta>> {
  return comando(descontarCuenta, {
    entrada: {
      ordenId,
      descuentoCentavos: montoCentavos,
      motivo: 'Combinación de dinero',
      autorizacion: firmaDeDescuento(mundo, terminal, quien, ordenId, montoCentavos),
    },
    ambito: mundo.quienes(terminal).cajera,
    idempotencyKey: clave(),
  });
}
