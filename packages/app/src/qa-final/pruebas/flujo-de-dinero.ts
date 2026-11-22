/**
 * DP-22 · EL FLUJO COMPLETO DE UNA COMBINACIÓN DE DINERO, a nivel de comandos, contra Postgres.
 *
 * Abre su caja → abre la cuenta (mesa o para llevar) → pide platillos (uno por peso con opción con
 * precio, uno con opción por pieza, receta y artículo) → cocina → cuenta con propina del mesero →
 * descuento con firma → divide → cobra → entrega → cierra con su corte.
 *
 * Cada renglón de la tabla usa SU caja y SU mesa: un renglón que se rompe a medias no estorba a los
 * demás. Nada aquí lanza por una afirmación: junta las FALLAS en una lista, para que el informe
 * diga todas las que tiene una combinación y no sólo la primera.
 */
import type { Ambito, Resultado } from '@morphiqpos/contracts';
import { obtenerDb } from '@morphiqpos/data';

import { cerrarCaja } from '../../caja/sesion.ts';
import { hojaDelCorte } from '../../caja/corte/documento.ts';
import { comando } from '../../produccion.ts';
import { clave, abrirCajaReal } from '../../pruebas/negocio-real.ts';
import { solicitarCuenta } from '../../restaurante/cuenta.ts';
import { dividirCuentaComando } from '../../restaurante/division.ts';
import { abrirMesa } from '../../restaurante/mesas.ts';
import { armarParaLlevar } from '../../restaurante/para-llevar.ts';
import { entregarParaLlevar } from '../../restaurante/para-llevar-entregar.ts';
import { enviarPedido } from '../../restaurante/pedido.ts';
import { entregarPedidos, transicionarPedido } from '../../restaurante/preparacion.ts';
import {
  consumoEsperado,
  existenciasDelSalon,
  lineasDe,
  mesaDe,
} from '../../restaurante/pruebas/salon-real.ts';
import { cobrarOrden } from '../../venta/cobrar.ts';

import { IVAS, descontarLaCuenta, fijarElIva, fijarQuienEligeLaPropinaEnElMundo } from './mundo.ts';
import type { IvaDelModelo, Mundo } from './mundo.ts';
import { verificarCuenta, type CuentaCobrada } from './verificar-cuenta.ts';
import { verificarCorte } from './verificar-corte.ts';

export interface FilaDeDinero {
  readonly iva: IvaDelModelo;
  readonly propina: 'ninguna' | 'porcentaje_caja' | 'porcentaje_mesero' | 'monto_caja';
  readonly descuento:
    'ninguno' | 'gerente_dentro_del_tope' | 'dueno_arriba_del_gerente' | 'pasa_el_tope';
  readonly division: 'sin_dividir' | 'por_platillo' | 'por_unidades';
  readonly pago: 'efectivo_exacto' | 'efectivo_con_cambio' | 'tarjeta' | 'mixto';
  readonly canal: 'mesa' | 'para_llevar';
}

export interface OpcionesDeLaFila {
  /** `false` si quien llama ya puso la configuración de la combinación (la tabla de pares). */
  readonly configurar?: boolean;
  /** Un gancho con la cuenta ya pedida y la caja abierta, antes de descontar y cobrar. */
  readonly antesDeCobrar?: (ordenId: string) => Promise<void>;
}

export interface ResultadoDeFila {
  readonly fallas: string[];
  /** La sesión de caja de la fila, para leer su corte después (`null` si no llegó a abrirse). */
  readonly sesionCajaId: string | null;
  /** Cuánto difieren las partes de la cuenta entera, en centavos (IVA que se redondea por parte). */
  readonly deriva: bigint;
}

export const PUNTOS_BASE_DE_PROPINA = 1_000;
export const PROPINA_A_MANO_CENTAVOS = 3_750n;
export const DESCUENTO_DEL_GERENTE = 15_333;
export const DESCUENTO_ARRIBA_DEL_GERENTE = 70_000;

type Falla = (texto: string) => void;

/** El resultado del comando o `null` con la falla anotada. */
export function sacar<T>(resultado: Resultado<T>, que: string, falla: Falla): T | null {
  if (resultado.ok) return resultado.datos;
  falla(`${que}: ${resultado.error.codigo} · ${resultado.error.mensaje}`);
  return null;
}

const lineasDelPedido = (mundo: Mundo) => [
  { productoId: mundo.salon.platillos.arrachera, cantidad: '2' },
  {
    productoId: mundo.salon.platillos.guacamole,
    cantidad: '2',
    opciones: [{ grupoId: mundo.grupoTotopos, opcionIds: [mundo.opcionQueso] }],
  },
  { productoId: mundo.salon.platillos.cerveza, cantidad: '1' },
  {
    productoId: mundo.barbacoaId,
    cantidad: '0.75',
    opciones: [{ grupoId: mundo.grupoTortillas, opcionIds: [mundo.opcionHarina] }],
  },
];

async function pasarPorCocina(caja: Ambito, ordenId: string, falla: Falla): Promise<void> {
  const comandas = await obtenerDb()
    .selectFrom('comandas')
    .select('id')
    .where('orden_id', '=', ordenId)
    .execute();
  if (comandas.length === 0) falla('cocina: la cuenta no generó comandas');
  for (const { id } of comandas) {
    for (const estado of ['en_preparacion', 'listo'] as const) {
      sacar(
        await comando(transicionarPedido, {
          entrada: { comandaId: id, estado },
          ambito: caja,
          idempotencyKey: clave(),
        }),
        `cocina → ${estado}`,
        falla,
      );
    }
  }
}

/** Abre la cuenta y manda el pedido; devuelve su id (o `null` con la falla anotada). */
export async function abrirYPedir(
  mundo: Mundo,
  terminal: number,
  indiceDeMesa: number,
  fila: FilaDeDinero,
  falla: Falla,
  pedirLaCuenta = true,
): Promise<string | null> {
  const { cajera } = mundo.quienes(terminal);
  const lineas = lineasDelPedido(mundo);
  if (fila.canal === 'para_llevar') {
    const armada = sacar(
      await comando(armarParaLlevar, {
        entrada: { nombrePedido: `Combinación ${String(indiceDeMesa)}`, lineas },
        ambito: cajera,
        idempotencyKey: clave(),
      }),
      'restaurante.armar_para_llevar',
      falla,
    );
    return armada?.ordenId ?? null;
  }
  const abierta = sacar(
    await comando(abrirMesa, {
      entrada: { mesaId: mesaDe(mundo.salon, indiceDeMesa), personas: 2 },
      ambito: cajera,
      idempotencyKey: clave(),
    }),
    'restaurante.abrir_mesa',
    falla,
  );
  if (abierta === null) return null;
  const enviada = sacar(
    await comando(enviarPedido, {
      entrada: { ordenId: abierta.ordenId, lineas },
      ambito: cajera,
      idempotencyKey: clave(),
    }),
    'restaurante.enviar_pedido',
    falla,
  );
  if (enviada === null) return null;
  await pasarPorCocina(cajera, abierta.ordenId, falla);
  if (!pedirLaCuenta) return abierta.ordenId;
  const pideElMesero = fila.propina === 'porcentaje_mesero';
  sacar(
    await comando(solicitarCuenta, {
      entrada: pideElMesero
        ? {
            ordenId: abierta.ordenId,
            propinaTipo: 'porcentaje',
            propinaPuntosBase: PUNTOS_BASE_DE_PROPINA,
            aunConPendientes: true,
          }
        : { ordenId: abierta.ordenId, aunConPendientes: true },
      ambito: pideElMesero ? mundo.quienes(terminal).mesero : cajera,
      idempotencyKey: clave(),
    }),
    'restaurante.solicitar_cuenta',
    falla,
  );
  return abierta.ordenId;
}

/** Aplica el descuento de la fila; devuelve lo que de verdad quedó descontado, en centavos. */
async function descontar(
  mundo: Mundo,
  terminal: number,
  ordenId: string,
  fila: FilaDeDinero,
  falla: Falla,
): Promise<number> {
  if (fila.descuento === 'ninguno') return 0;
  const quienes = mundo.quienes(terminal);
  const dueno = fila.descuento === 'dueno_arriba_del_gerente';
  const monto =
    fila.descuento === 'gerente_dentro_del_tope'
      ? DESCUENTO_DEL_GERENTE
      : DESCUENTO_ARRIBA_DEL_GERENTE;
  const resultado = await descontarLaCuenta(
    mundo,
    terminal,
    ordenId,
    dueno ? quienes.dueno : quienes.gerente,
    monto,
  );
  if (fila.descuento === 'pasa_el_tope') {
    // El tope del gerente es el 30 %: pedir el 45 % tiene que NEGARSE, y la cuenta queda como estaba.
    if (resultado.ok) {
      falla('descuento: el servidor dejó pasar un descuento por encima del tope del gerente');
      return monto;
    }
    if (!JSON.stringify(resultado.error).includes('PUESTO_NO_OTORGABLE')) {
      falla(`descuento: se negó con otro motivo: ${JSON.stringify(resultado.error)}`);
    }
    return 0;
  }
  return sacar(resultado, 'restaurante.descontar_cuenta', falla) === null ? 0 : monto;
}

/** Parte la cuenta; devuelve los ids de las partes (o la cuenta sola si no se divide). */
export async function dividir(
  mundo: Mundo,
  terminal: number,
  ordenId: string,
  fila: FilaDeDinero,
  falla: Falla,
): Promise<readonly string[]> {
  if (fila.division === 'sin_dividir') return [ordenId];
  const lineas = await lineasDe(ordenId);
  const de = (nombre: string): string => {
    const id = lineas.get(nombre)?.[0];
    if (id === undefined) throw new Error(`La cuenta no tiene «${nombre}».`);
    return id;
  };
  const arrachera = de('Arrachera al carbón');
  const guacamole = de('Guacamole con totopos');
  const cerveza = de('Cerveza clara');
  const barbacoa = de('Barbacoa de horno');
  const particiones =
    fila.division === 'por_platillo'
      ? [
          {
            tomas: [
              { lineaId: arrachera, cantidad: 2 },
              { lineaId: cerveza, cantidad: 1 },
            ],
          },
          {
            tomas: [
              { lineaId: guacamole, cantidad: 2 },
              { lineaId: barbacoa, cantidad: 1 },
            ],
          },
        ]
      : [
          {
            tomas: [
              { lineaId: arrachera, cantidad: 1 },
              { lineaId: guacamole, cantidad: 1 },
              { lineaId: cerveza, cantidad: 1 },
              { lineaId: barbacoa, cantidad: 1 },
            ],
          },
          {
            tomas: [
              { lineaId: arrachera, cantidad: 1 },
              { lineaId: guacamole, cantidad: 1 },
            ],
          },
        ];
  const dividida = sacar(
    await comando(dividirCuentaComando, {
      entrada: { ordenId, particiones },
      ambito: mundo.quienes(terminal).cajera,
      idempotencyKey: clave(),
    }),
    'restaurante.dividir_cuenta',
    falla,
  );
  return dividida === null ? [] : dividida.hijas.map((h) => h.ordenId);
}

export interface Extra {
  readonly mundo: Mundo;
  readonly terminal: number;
}

/**
 * Un renglón que se rompió a medias deja su caja abierta: se cierra por SQL (andamiaje de la
 * prueba, no un camino de la app) para que el siguiente renglón pueda abrir la suya.
 */
async function liberarCajaHuerfana(mundo: Mundo, terminal: number): Promise<void> {
  const terminalId = mundo.salon.sucursal.terminales[terminal];
  if (terminalId === undefined) return;
  await obtenerDb()
    .updateTable('sesiones_caja')
    .set({
      estado: 'cerrada',
      cerrada_en: new Date(),
      efectivo_contado_centavos: 0n,
      folio: BigInt(Date.now()),
    })
    .where('terminal_id', '=', terminalId)
    .where('estado', '=', 'abierta')
    .execute();
}

/** Corre una combinación de punta a punta y devuelve todas las fallas que encontró. */
export async function correrFila(
  mundo: Mundo,
  indice: number,
  fila: FilaDeDinero,
  opciones: OpcionesDeLaFila = {},
): Promise<ResultadoDeFila> {
  // Una sola caja (el cupo máximo de una sucursal es 4): cada renglón abre la suya y la cierra.
  const terminal = 0;
  const fallas: string[] = [];
  const falla: Falla = (texto) => fallas.push(texto);
  const { cajera } = mundo.quienes(terminal);
  const salon = mundo.salon;

  // 1 · La configuración de ESTA combinación, por sus comandos.
  if (opciones.configurar !== false) {
    await fijarElIva(mundo, IVAS[fila.iva]);
    await fijarQuienEligeLaPropinaEnElMundo(mundo, {
      comensales: true,
      mesero: fila.propina === 'porcentaje_mesero',
      caja: true,
    });
  }

  // 2 · Caja abierta e inventario de antes.
  await liberarCajaHuerfana(mundo, terminal);
  const sesion = await abrirCajaReal(cajera, mundo.fondoCentavos);
  const antes = await existenciasDelSalon(salon);

  // 3 · La cuenta, la cocina, el descuento y la división.
  const ordenId = await abrirYPedir(mundo, terminal, indice, fila, falla);
  if (ordenId === null) return { fallas, deriva: 0n, sesionCajaId: sesion };
  if (opciones.antesDeCobrar !== undefined) await opciones.antesDeCobrar(ordenId);
  const descontado = await descontar(mundo, terminal, ordenId, fila, falla);
  const partes = await dividir(mundo, terminal, ordenId, fila, falla);
  if (partes.length === 0) return { fallas, deriva: 0n, sesionCajaId: sesion };

  // 4 · Lo que dice el oráculo de la cuenta entera y de cada parte, y el cobro de cada una.
  const cobradas: CuentaCobrada[] = [];
  for (const [indice, parteId] of partes.entries()) {
    const cuenta = await verificarCuenta.preparar(
      mundo,
      terminal,
      fila,
      parteId,
      indice,
      BigInt(descontado),
      falla,
    );
    const cobro = sacar(
      await comando(cobrarOrden, {
        entrada: cuenta.entradaDeCobro,
        ambito: cajera,
        idempotencyKey: clave(),
      }),
      `venta.cobrar (${String(indice + 1)}/${String(partes.length)})`,
      falla,
    );
    if (cobro !== null) cobradas.push({ ...cuenta, ordenId: parteId });
  }

  // 5 · Lo que sale de cocina y se entrega, y el papel contra la pantalla.
  if (fila.canal === 'para_llevar') {
    await pasarPorCocina(cajera, ordenId, falla);
    sacar(
      await comando(entregarParaLlevar, {
        entrada: { ordenId },
        ambito: cajera,
        idempotencyKey: clave(),
      }),
      'restaurante.entregar_para_llevar',
      falla,
    );
  } else {
    sacar(
      await comando(entregarPedidos, {
        entrada: { ordenId },
        ambito: cajera,
        idempotencyKey: clave(),
      }),
      'restaurante.entregar_pedidos',
      falla,
    );
  }
  const deriva = await verificarCuenta.despues(mundo, terminal, fila, {
    ordenId,
    descontadoCentavos: BigInt(descontado),
    cobradas,
    falla,
  });

  // 6 · Inventario: lo que bajó es lo que dicen las recetas, al gramo.
  const despues = await existenciasDelSalon(salon);
  const gasto = consumoEsperado([
    { platillo: 'arrachera', cantidad: '2' },
    { platillo: 'guacamole', cantidad: '2' },
    { platillo: 'cerveza', cantidad: '1' },
  ]);
  for (const insumo of Object.keys(gasto) as (keyof typeof gasto)[]) {
    const bajo = Number(antes[insumo]) - Number(despues[insumo]);
    if (bajo !== gasto[insumo]) {
      falla(`inventario: ${insumo} bajó ${String(bajo)} y la receta dice ${String(gasto[insumo])}`);
    }
  }

  // 7 · El corte de la caja.
  const cierre = await comando(cerrarCaja, {
    entrada: { efectivoContadoCentavos: verificarCorte.efectivoQueDebeHaber(mundo, cobradas) },
    ambito: cajera,
    idempotencyKey: clave(),
  });
  const cerrada = sacar(cierre, 'caja.cerrar', falla);
  const hoja = sacar(
    await comando(hojaDelCorte, {
      entrada: { sesionCajaId: sesion },
      ambito: mundo.quienes(terminal).dueno,
      idempotencyKey: clave(),
    }),
    'caja.hoja_del_corte',
    falla,
  );
  if (cerrada !== null && hoja !== null) {
    verificarCorte.comparar(mundo, cobradas, cerrada, hoja, falla);
  }
  return { fallas, deriva, sesionCajaId: sesion };
}
