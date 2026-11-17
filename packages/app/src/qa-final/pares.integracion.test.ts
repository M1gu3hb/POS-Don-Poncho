import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { IDS_DE_CAMPOS } from '@morphiqpos/domain/venta';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { Modelo } from '../../../../qa/qa-final/combinaciones/nucleo.ts';
import { revisarTabla, tablaCompleta } from '../../../../qa/qa-final/combinaciones/nucleo.ts';
import { fijarCajasSimultaneas } from '../caja/cajas-a-la-vez.ts';
import { fijarCopiasDeImpresion } from '../caja/copias-de-impresion.ts';
import { fijarAjustesDelCorte } from '../caja/corte-de-la-caja.ts';
import { hojaDelCorte } from '../caja/corte/documento.ts';
import { fijarPapelATuGusto } from '../caja/papel-a-tu-gusto.ts';
import { cerrarCaja } from '../caja/sesion.ts';
import { fijarCandadoDeMando } from '../configuracion/candado-de-mando.ts';
import { comando } from '../produccion.ts';
import { abrirCajaReal, clave } from '../pruebas/negocio-real.ts';
import { guardarConfiguracionParcial } from '../puente/configuracion.ts';
import { fijarPropina } from '../propinas/fijar-propina.ts';
import { permitirDescuentos } from '../venta/descuentos-permitidos.ts';

import { correrFila, type FilaDeDinero } from './pruebas/flujo-de-dinero.ts';
import {
  IVAS,
  SECRETO,
  fijarElIva,
  fijarQuienEligeLaPropinaEnElMundo,
  sembrarMundo,
  type IvaDelModelo,
  type Mundo,
} from './pruebas/mundo.ts';

/**
 * DP-22 · FASE D · LA TABLA DE PARES: los ajustes que cambian el flujo, de dos en dos.
 *
 * Cada renglón de `ajustes.pares.json` pone TODOS los ajustes por sus comandos (o por el guardado de
 * configuración donde no hay comando), comprueba que quedaron guardados tal cual y corre un flujo
 * corto —mesa → pedido → cocina → cuenta → propina → cobro → corte— contra el oráculo, más las
 * pruebas de lo que el servidor sí hace con el ajuste (descuentos, cupo de cajas, quién elige la
 * propina, comisión y costos del corte). Lo que sólo se ve en una pantalla (portal, estaciones en
 * Cocina, asignación de mesas, candado, «PIN al despertar», campos del ticket) se anota como «por
 * ver en navegador»: aquí se comprueba que el ajuste se guarda y no estorba al dinero.
 */

vi.mock('@morphiqpos/contracts', async (original) => ({
  ...(await original<typeof import('@morphiqpos/contracts')>()),
  validarEntorno: () => ({ SESSION_SECRET: SECRETO }),
}));

const DATOS = fileURLToPath(
  new URL('../../../../qa/qa-final/datos/combinaciones/', import.meta.url),
);
const leer = (archivo: string): unknown => JSON.parse(readFileSync(`${DATOS}${archivo}`, 'utf8'));
const modelo = leer('ajustes.modelo.json') as Modelo;
const tabla = leer('ajustes.pares.json') as Record<string, string>[];

const QUIEN_ELIGE = {
  comensales_y_caja: { comensales: true, mesero: false, caja: true },
  mesero_y_caja: { comensales: false, mesero: true, caja: true },
  solo_caja: { comensales: false, mesero: false, caja: true },
  nadie: { comensales: false, mesero: false, caja: false },
} as const;

let mundo: Mundo;

beforeAll(async () => {
  mundo = await sembrarMundo({ nombre: 'Pares de ajustes', mesas: tabla.length, terminales: 2 });
}, 600_000);

/** JSON con las llaves en orden: `jsonb` no guarda el orden en que se escribieron. */
const estable = (valor: unknown): string =>
  JSON.stringify(valor, (_k, x: unknown) =>
    typeof x === 'object' && x !== null && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x,
  );

const v = (fila: Record<string, string>, parametro: string): string => fila[parametro] ?? '';
const si = (fila: Record<string, string>, parametro: string): boolean =>
  v(fila, parametro) === 'si';

/** Pone cada ajuste de la fila por su comando (o por el guardado de configuración). */
async function aplicar(fila: Record<string, string>): Promise<void> {
  const org = mundo.salon.negocio.organizacionId;
  const q = mundo.quienes(0);
  const ok = async (resultado: Promise<{ readonly ok: boolean }>, que: string): Promise<void> => {
    const r = await resultado;
    if (!r.ok) throw new Error(`${que} falló: ${JSON.stringify(r)}`);
  };
  await fijarElIva(mundo, IVAS[v(fila, 'iva') as IvaDelModelo]);
  await fijarQuienEligeLaPropinaEnElMundo(
    mundo,
    QUIEN_ELIGE[v(fila, 'quien_elige_la_propina') as keyof typeof QUIEN_ELIGE],
  );
  await ok(
    comando(permitirDescuentos, {
      entrada: { permitir: si(fila, 'descuentos_permitidos') },
      ambito: q.dueno,
      idempotencyKey: clave(),
    }),
    'descuentos',
  );
  const copias = Number(v(fila, 'copias_de_impresion'));
  await ok(
    comando(fijarCopiasDeImpresion, {
      entrada: { ticket: copias, precuenta: copias, corte: copias },
      ambito: q.dueno,
      idempotencyKey: clave(),
    }),
    'copias',
  );
  const completo = v(fila, 'campos_del_ticket') === 'completo';
  const papel = Object.fromEntries(IDS_DE_CAMPOS.map((id) => [id, completo])) as Record<
    (typeof IDS_DE_CAMPOS)[number],
    boolean
  >;
  await ok(
    comando(fijarPapelATuGusto, {
      entrada: { precuenta: papel, ticket: papel },
      ambito: q.dueno,
      idempotencyKey: clave(),
    }),
    'papel a tu gusto',
  );
  await ok(
    comando(fijarCandadoDeMando, {
      entrada: { minutos: Number(v(fila, 'minutos_del_candado')) },
      ambito: q.dueno,
      idempotencyKey: clave(),
    }),
    'candado',
  );
  await ok(
    comando(fijarAjustesDelCorte, {
      entrada: {
        mostrarCostosACaja: si(fila, 'costos_a_la_caja'),
        comisionTerminalBp: v(fila, 'comision_de_la_terminal') === 'comision_3_6' ? 360 : null,
      },
      ambito: q.dueno,
      idempotencyKey: clave(),
    }),
    'ajustes del corte',
  );
  await ok(
    comando(fijarCajasSimultaneas, {
      entrada: { cajas: Number(v(fila, 'cupo_de_cajas')) },
      ambito: q.dueno,
      idempotencyKey: clave(),
    }),
    'cupo',
  );
  await conTransaccion((tx) =>
    guardarConfiguracionParcial(tx, org, {
      portal_qr_activo: si(fila, 'portal_activo'),
      portal_qr_permitir_pedidos_cliente: si(fila, 'pedidos_de_comensales'),
      portal_qr_envia_a_cocina: v(fila, 'quien_manda_a_cocina'),
      portal_qr_comensales_abren_mesa: si(fila, 'comensales_abren_mesa'),
      portal_qr_cuenta_modo: v(fila, 'modo_de_la_cuenta'),
      estaciones_preparacion_activas: si(fila, 'estaciones_activas'),
      asignacion_mesas_activa: si(fila, 'asignacion_de_mesas'),
      portal_qr_modo_menu: v(fila, 'modo_del_menu_del_portal'),
    }),
  );
}

/** Lo que quedó guardado, tal cual lo dijo la fila. */
async function guardado(fila: Record<string, string>): Promise<string[]> {
  const raw = await obtenerDb()
    .selectFrom('configuracion')
    .select('valores')
    .where('organizacion_id', '=', mundo.salon.negocio.organizacionId)
    .executeTakeFirstOrThrow();
  const d = raw.valores as Record<string, unknown>;
  const falta: string[] = [];
  const igual = (clave: string, esperado: unknown): void => {
    if (estable(d[clave]) !== estable(esperado)) {
      falta.push(`${clave}: guardado ${estable(d[clave])}, la fila decía ${estable(esperado)}`);
    }
  };
  const iva = IVAS[v(fila, 'iva') as IvaDelModelo];
  igual('impuesto', iva);
  igual('portal_qr_activo', si(fila, 'portal_activo'));
  igual('portal_qr_permitir_pedidos_cliente', si(fila, 'pedidos_de_comensales'));
  igual('portal_qr_envia_a_cocina', v(fila, 'quien_manda_a_cocina'));
  igual('portal_qr_comensales_abren_mesa', si(fila, 'comensales_abren_mesa'));
  igual('portal_qr_cuenta_modo', v(fila, 'modo_de_la_cuenta'));
  igual('estaciones_preparacion_activas', si(fila, 'estaciones_activas'));
  igual('asignacion_mesas_activa', si(fila, 'asignacion_de_mesas'));
  igual('portal_qr_modo_menu', v(fila, 'modo_del_menu_del_portal'));
  igual('descuentos_permitidos', si(fila, 'descuentos_permitidos'));
  const copias = Number(v(fila, 'copias_de_impresion'));
  igual('copias_de_impresion', { ticket: copias, precuenta: copias, corte: copias });
  igual('candado_de_mando_min', Number(v(fila, 'minutos_del_candado')));
  igual('mostrar_costos_a_caja', si(fila, 'costos_a_la_caja'));
  igual('comision_terminal_bp', v(fila, 'comision_de_la_terminal') === 'comision_3_6' ? 360 : null);
  const quien = QUIEN_ELIGE[v(fila, 'quien_elige_la_propina') as keyof typeof QUIEN_ELIGE];
  igual('propina_la_elige_mesero', quien.mesero);
  igual('propina_la_elige_caja', quien.caja);
  igual('portal_qr_permitir_propina_cliente', quien.comensales);
  return falta;
}

function filaDeDinero(fila: Record<string, string>): FilaDeDinero {
  const quien = QUIEN_ELIGE[v(fila, 'quien_elige_la_propina') as keyof typeof QUIEN_ELIGE];
  return {
    iva: v(fila, 'iva') as IvaDelModelo,
    propina: quien.mesero ? 'porcentaje_mesero' : quien.caja ? 'porcentaje_caja' : 'ninguna',
    descuento: si(fila, 'descuentos_permitidos') ? 'gerente_dentro_del_tope' : 'ninguno',
    division: 'sin_dividir',
    pago: 'efectivo_con_cambio',
    canal: 'mesa',
  };
}

describe('la tabla de pares de los ajustes', () => {
  it('cubre TODOS los pares válidos del modelo, sin renglones prohibidos ni repetidos', () => {
    const revision = revisarTabla(modelo, tabla);
    expect(revision.sinCubrir).toEqual([]);
    expect(tablaCompleta(revision)).toBe(true);
  });
});

describe('cada par de ajustes, con su flujo corto y lo que el servidor hace con ellos', () => {
  it.each(tabla.map((fila, indice) => ({ fila, indice })))(
    '#$indice',
    { timeout: 240_000 },
    async ({ fila, indice }) => {
      await aplicar(fila);
      const dicho = await guardado(fila);
      expect(dicho, dicho.join('\n')).toEqual([]);

      const q = mundo.quienes(0);
      const sondeos: string[] = [];
      const resultado = await correrFila(mundo, indice, filaDeDinero(fila), {
        configurar: false,
        antesDeCobrar: async (ordenId) => {
          // Descuentos: apagados el servidor los niega aunque haya firma.
          if (!si(fila, 'descuentos_permitidos')) {
            const { descontarLaCuenta } = await import('./pruebas/mundo.ts');
            const r = await descontarLaCuenta(mundo, 0, ordenId, q.gerente, 1_000);
            if (r.ok || !JSON.stringify(r.error).includes('DESCUENTOS_APAGADOS')) {
              sondeos.push('descuentos apagados: el servidor no los negó con DESCUENTOS_APAGADOS');
            }
          }
          // Cupo de cajas: la segunda abre sólo con cupo 2.
          const otra = { ...mundo.quienes(1).cajera };
          const abrio = await abrirCajaReal(otra, mundo.fondoCentavos).then(
            () => true,
            () => false,
          );
          if (abrio !== (v(fila, 'cupo_de_cajas') === '2')) {
            sondeos.push(
              `cupo ${v(fila, 'cupo_de_cajas')}: la segunda caja ${abrio ? 'abrió' : 'no abrió'}`,
            );
          }
          if (abrio) {
            await comando(cerrarCaja, {
              entrada: { efectivoContadoCentavos: mundo.fondoCentavos },
              ambito: otra,
              idempotencyKey: clave(),
            });
          }
          // Quién elige la propina: la Caja sólo guarda su elección si puede.
          if (!QUIEN_ELIGE[v(fila, 'quien_elige_la_propina') as keyof typeof QUIEN_ELIGE].mesero) {
            const version = (
              await obtenerDb()
                .selectFrom('ordenes')
                .select('version')
                .where('id', '=', ordenId)
                .executeTakeFirstOrThrow()
            ).version;
            const r = await comando(fijarPropina, {
              entrada: {
                ordenId,
                version,
                propinaTipo: 'porcentaje',
                propinaPuntosBase: 1000,
                cambiar: false,
              },
              ambito: q.cajera,
              idempotencyKey: clave(),
            });
            const puede =
              QUIEN_ELIGE[v(fila, 'quien_elige_la_propina') as keyof typeof QUIEN_ELIGE].caja;
            if (r.ok !== puede)
              sondeos.push(
                `la Caja ${puede ? 'debía poder' : 'no debía poder'} fijar la propina y ${r.ok ? 'pudo' : 'no pudo'}`,
              );
          }
        },
      });
      // El corte, leído por la cajera: costos y comisión según los ajustes.
      if (resultado.sesionCajaId !== null) {
        const hoja = await comando(hojaDelCorte, {
          entrada: { sesionCajaId: resultado.sesionCajaId },
          ambito: q.cajera,
          idempotencyKey: clave(),
        });
        if (!hoja.ok) sondeos.push(`hoja del corte: ${JSON.stringify(hoja.error)}`);
        else {
          if (hoja.datos.verCostos !== si(fila, 'costos_a_la_caja'))
            sondeos.push(
              `costos a la caja: la cajera ${hoja.datos.verCostos ? 've' : 'no ve'} costos`,
            );
          const tasa = v(fila, 'comision_de_la_terminal') === 'comision_3_6' ? 360 : null;
          if (hoja.datos.negocio.comisionTerminalBp !== tasa)
            sondeos.push(`comisión: la hoja dice ${String(hoja.datos.negocio.comisionTerminalBp)}`);
        }
      }
      expect(
        [...resultado.fallas, ...sondeos],
        [...resultado.fallas, ...sondeos].join('\n'),
      ).toEqual([]);
    },
  );
});
