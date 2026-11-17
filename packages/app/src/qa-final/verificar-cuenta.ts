/**
 * DP-22 · LO QUE UNA CUENTA COBRADA TIENE QUE DECIR, contra el oráculo independiente del dinero
 * (`qa/qa-final/oraculo/dinero.ts`, que no importa nada del sistema).
 *
 * `preparar` arma el cobro de una cuenta (o de una parte) y su resultado esperado ANTES de cobrar;
 * `despues` lee lo que quedó en la base y lo compara en cuatro sitios: la fila de la cuenta, sus
 * pagos, el documento del que se imprime el ticket (`venta.ticket`) y la lectura que usa la pantalla
 * (`Venta` y `DetalleVenta`, con las mismas funciones que pintan el papel).
 */
import { obtenerDb } from '@morphiqpos/data';

import { comando } from '../produccion.ts';
import { clave } from '../pruebas/negocio-real.ts';
import { consultar } from '../puente/consultar.ts';
import { ticketDeOrden } from '../venta/consultas.ts';

import {
  calcularCuenta,
  importeDelRenglon,
  type PagoDelOraculo,
  type PropinaDelOraculo,
  type RenglonDelOraculo,
  type ResultadoDelOraculo,
} from '../../../../qa/qa-final/oraculo/dinero.ts';
import {
  propinaDelDialogo,
  propinaDeLaVentaEnPantalla,
  totalesDelPapelDeLaPantalla,
} from './pantalla.ts';
import { IVAS, PEDIDO, PRECIO_KILO_BARBACOA, type Mundo } from './mundo.ts';
import type { FilaDeDinero } from './flujo-de-dinero.ts';
import { PROPINA_A_MANO_CENTAVOS, PUNTOS_BASE_DE_PROPINA } from './flujo-de-dinero.ts';

type Falla = (texto: string) => void;

export interface PagoAsignado {
  readonly metodo: 'efectivo' | 'tarjeta';
  readonly montoCentavos: bigint;
  readonly propinaCentavos: bigint;
  readonly recibidoCentavos: bigint | null;
}

export interface CuentaCobrada {
  readonly ordenId: string;
  readonly totalDelSistema: bigint;
  readonly esperado: ResultadoDelOraculo;
  readonly asignacion: readonly PagoAsignado[];
  readonly propinaCentavos: bigint;
  readonly entradaDeCobro: {
    readonly ordenId: string;
    readonly pagos: {
      readonly metodo: 'efectivo' | 'tarjeta';
      readonly montoCentavos: number;
      readonly propinaCentavos: number;
      readonly recibidoCentavos?: number;
    }[];
    readonly totalEsperadoCentavos: number;
    readonly propinaTipo: 'sin_propina' | 'porcentaje' | 'monto_manual';
    readonly propinaPuntosBase: number;
    readonly propinaOrigen: 'caja' | 'mesero';
  };
}

/** El billete que entrega quien paga en efectivo: el siguiente múltiplo de $100 por encima. */
const billeteDe = (centavos: bigint): bigint => (centavos / 10_000n + 1n) * 10_000n;

/** Los renglones del pedido tal como el MENÚ los cobra: precio de lista × cantidad + opciones. */
export function renglonesDelPedido(): RenglonDelOraculo[] {
  return [
    { precioCentavos: PEDIDO.arrachera.precio, cantidad: PEDIDO.arrachera.cantidad },
    {
      precioCentavos: PEDIDO.guacamole.precio,
      cantidad: PEDIDO.guacamole.cantidad,
      opcionesCentavos: PEDIDO.guacamole.opcion,
      opcionesPorPieza: true,
    },
    { precioCentavos: PEDIDO.cerveza.precio, cantidad: PEDIDO.cerveza.cantidad },
    {
      precioCentavos: PRECIO_KILO_BARBACOA,
      cantidad: PEDIDO.barbacoa.cantidad,
      opcionesCentavos: PEDIDO.barbacoa.opcion,
      opcionesPorPieza: false,
    },
  ];
}

interface LineaLeida {
  readonly nombre: string;
  readonly subtotal: bigint;
  readonly descuento: bigint;
}

async function lineasDe(ordenId: string): Promise<LineaLeida[]> {
  const filas = await obtenerDb()
    .selectFrom('orden_lineas')
    .select(['producto_nombre', 'subtotal_centavos', 'descuento_centavos'])
    .where('orden_id', '=', ordenId)
    .where('anulada_en', 'is', null)
    .execute();
  return filas.map((f) => ({
    nombre: f.producto_nombre,
    subtotal: f.subtotal_centavos,
    descuento: f.descuento_centavos,
  }));
}

async function filaDeLaOrden(ordenId: string) {
  return obtenerDb()
    .selectFrom('ordenes')
    .select([
      'estado',
      'subtotal_centavos',
      'descuento_centavos',
      'impuestos_centavos',
      'total_centavos',
      'sucursal_id',
    ])
    .where('id', '=', ordenId)
    .executeTakeFirstOrThrow();
}

/** Reparte el cobro entre las formas de pago de la combinación (la propina viaja donde se pagó). */
function asignarPagos(pago: FilaDeDinero['pago'], total: bigint, propina: bigint): PagoAsignado[] {
  switch (pago) {
    case 'efectivo_exacto':
      return [
        {
          metodo: 'efectivo',
          montoCentavos: total,
          propinaCentavos: propina,
          recibidoCentavos: total + propina,
        },
      ];
    case 'efectivo_con_cambio':
      return [
        {
          metodo: 'efectivo',
          montoCentavos: total,
          propinaCentavos: propina,
          recibidoCentavos: billeteDe(total + propina),
        },
      ];
    case 'tarjeta':
      return [
        {
          metodo: 'tarjeta',
          montoCentavos: total,
          propinaCentavos: propina,
          recibidoCentavos: null,
        },
      ];
    case 'mixto': {
      const conTarjeta = total / 2n;
      const enEfectivo = total - conTarjeta;
      return [
        {
          metodo: 'tarjeta',
          montoCentavos: conTarjeta,
          propinaCentavos: propina,
          recibidoCentavos: null,
        },
        {
          metodo: 'efectivo',
          montoCentavos: enEfectivo,
          propinaCentavos: 0n,
          recibidoCentavos: billeteDe(enEfectivo),
        },
      ];
    }
  }
}

const pagosParaElOraculo = (asignacion: readonly PagoAsignado[]): PagoDelOraculo[] =>
  asignacion.map((p) => ({
    metodo: p.metodo,
    entregadoCentavos:
      p.metodo === 'efectivo'
        ? (p.recibidoCentavos ?? p.montoCentavos + p.propinaCentavos)
        : p.montoCentavos + p.propinaCentavos,
  }));

function propinaDeLaFila(
  fila: FilaDeDinero,
  indiceDeParte: number,
): { oraculo: PropinaDelOraculo; tipo: 'sin_propina' | 'porcentaje' | 'monto_manual' } {
  if (fila.propina === 'ninguna') return { oraculo: { tipo: 'ninguna' }, tipo: 'sin_propina' };
  if (fila.propina === 'monto_caja') {
    return indiceDeParte === 0
      ? { oraculo: { tipo: 'monto', centavos: PROPINA_A_MANO_CENTAVOS }, tipo: 'monto_manual' }
      : { oraculo: { tipo: 'ninguna' }, tipo: 'sin_propina' };
  }
  return {
    oraculo: { tipo: 'porcentaje', puntosBase: PUNTOS_BASE_DE_PROPINA },
    tipo: 'porcentaje',
  };
}

/** Arma el cobro de una cuenta (o parte) y lo que el oráculo dice que debe resultar. */
async function preparar(
  _mundo: Mundo,
  _terminal: number,
  fila: FilaDeDinero,
  ordenId: string,
  indice: number,
  descontadoCentavos: bigint,
  falla: Falla,
): Promise<CuentaCobrada> {
  const orden = await filaDeLaOrden(ordenId);
  const regla = IVAS[fila.iva];
  const impuesto = { puntosBase: regla.puntosBase, incluidoEnPrecio: regla.incluidoEnPrecio };

  // La cuenta sin dividir se calcula DESDE EL MENÚ (precio × cantidad + opciones); una parte, desde
  // las líneas que le tocaron (cada una con el descuento que se le repartió).
  const entera = fila.division === 'sin_dividir';
  const lineas = await lineasDe(ordenId);
  const base = entera
    ? {
        renglones: renglonesDelPedido(),
        ...(descontadoCentavos > 0n
          ? { descuentoDeLaCuenta: { tipo: 'monto' as const, centavos: descontadoCentavos } }
          : {}),
      }
    : {
        renglones: lineas.map<RenglonDelOraculo>((l) => ({
          precioCentavos: l.subtotal,
          cantidad: '1',
          descuentoCentavos: l.descuento,
        })),
      };
  const sinPropina = calcularCuenta({ ...base, impuesto });

  const comparar = (que: string, sistema: bigint, oraculo: bigint): void => {
    if (sistema !== oraculo)
      falla(`${que}: el sistema dice ${String(sistema)} y el oráculo ${String(oraculo)}`);
  };
  comparar('subtotal', orden.subtotal_centavos, sinPropina.subtotalCentavos);
  comparar('descuento', orden.descuento_centavos, sinPropina.descuentoCentavos);
  comparar('impuesto', orden.impuestos_centavos, sinPropina.impuestosCentavos);
  comparar('total', orden.total_centavos, sinPropina.totalCentavos);

  // La propina que la pantalla calcularía, contra la del oráculo.
  const decision = propinaDeLaFila(fila, indice);
  const delOraculo = calcularCuenta({
    ...base,
    impuesto,
    propina: decision.oraculo,
  }).propinaCentavos;
  const delaPantalla =
    decision.tipo === 'porcentaje'
      ? propinaDelDialogo(orden.total_centavos, PUNTOS_BASE_DE_PROPINA / 100)
      : delOraculo;
  if (delaPantalla !== delOraculo) {
    falla(
      `propina: el diálogo de propina calcula ${String(delaPantalla)} y el oráculo ${String(delOraculo)} (total ${String(orden.total_centavos)})`,
    );
  }
  const propina = delaPantalla;
  const asignacion = asignarPagos(fila.pago, orden.total_centavos, propina);
  const esperado = calcularCuenta({
    ...base,
    impuesto,
    propina: decision.oraculo,
    pagos: pagosParaElOraculo(asignacion),
  });
  return {
    ordenId,
    totalDelSistema: orden.total_centavos,
    esperado,
    asignacion,
    propinaCentavos: propina,
    entradaDeCobro: {
      ordenId,
      pagos: asignacion.map((p) => ({
        metodo: p.metodo,
        montoCentavos: Number(p.montoCentavos),
        propinaCentavos: Number(p.propinaCentavos),
        ...(p.recibidoCentavos === null ? {} : { recibidoCentavos: Number(p.recibidoCentavos) }),
      })),
      totalEsperadoCentavos: Number(orden.total_centavos),
      propinaTipo: decision.tipo,
      propinaPuntosBase: decision.tipo === 'porcentaje' ? PUNTOS_BASE_DE_PROPINA : 0,
      propinaOrigen: fila.propina === 'porcentaje_mesero' ? 'mesero' : 'caja',
    },
  };
}

const aCentavos = (pesos: unknown): bigint => BigInt(Math.round(Number(pesos) * 100));

async function verificarUna(
  mundo: Mundo,
  terminal: number,
  fila: FilaDeDinero,
  cuenta: CuentaCobrada,
  falla: Falla,
): Promise<void> {
  const { ordenId, esperado } = cuenta;
  const comparar = (que: string, sistema: bigint, oraculo: bigint): void => {
    if (sistema !== oraculo)
      falla(`${que}: el sistema dice ${String(sistema)} y el oráculo ${String(oraculo)}`);
  };
  const orden = await filaDeLaOrden(ordenId);
  if (orden.estado !== 'pagada') falla(`la cuenta quedó «${orden.estado}», no «pagada»`);

  // Los pagos: lo pagado suma el total (+ propina) y el cambio es el del oráculo.
  const pagos = await obtenerDb()
    .selectFrom('pagos')
    .select([
      'metodo',
      'monto_centavos',
      'propina_centavos',
      'recibido_centavos',
      'cambio_centavos',
    ])
    .where('orden_id', '=', ordenId)
    .execute();
  const suma = (campo: 'monto_centavos' | 'propina_centavos' | 'cambio_centavos'): bigint =>
    pagos.reduce((s, p) => s + p[campo], 0n);
  comparar('lo pagado (sin propina)', suma('monto_centavos'), esperado.totalCentavos);
  comparar('la propina de los pagos', suma('propina_centavos'), esperado.propinaCentavos);
  comparar('el cambio', suma('cambio_centavos'), esperado.cambioCentavos);

  // El documento del que se imprime el ticket.
  const ticketRes = await comando(ticketDeOrden, {
    entrada: { ordenId },
    ambito: mundo.quienes(terminal).cajera,
    idempotencyKey: clave(),
  });
  if (!ticketRes.ok) {
    falla(`venta.ticket: ${ticketRes.error.codigo} · ${ticketRes.error.mensaje}`);
  } else {
    const t = ticketRes.datos;
    comparar('ticket · subtotal', BigInt(t.subtotalCentavos), esperado.subtotalCentavos);
    comparar('ticket · descuento', BigInt(t.descuentoCentavos), esperado.descuentoCentavos);
    comparar('ticket · impuestos', BigInt(t.impuestosCentavos), esperado.impuestosCentavos);
    comparar('ticket · total', BigInt(t.totalCentavos), esperado.totalCentavos);
    comparar('ticket · propina', BigInt(t.propinaCentavos), esperado.propinaCentavos);
    comparar(
      'ticket · cambio',
      t.pagos.reduce((s, p) => s + BigInt(p.cambioCentavos), 0n),
      esperado.cambioCentavos,
    );
    comparar(
      'ticket · renglones',
      t.lineas.reduce((s, l) => s + BigInt(l.importeCentavos), 0n),
      esperado.subtotalCentavos,
    );
  }

  // La lectura que usa la pantalla, con las funciones que pintan el papel.
  const lector = {
    organizacionId: mundo.salon.negocio.organizacionId,
    rol: 'dueno',
    sucursalId: orden.sucursal_id,
  };
  const [venta] = await consultar(lector, { entidad: 'Venta', operacion: 'get', id: ordenId });
  const detalles = await consultar(lector, {
    entidad: 'DetalleVenta',
    operacion: 'filter',
    filtro: { venta_id: ordenId },
  });
  if (venta === undefined) {
    falla('pantalla: la lectura de la cuenta no devolvió la venta');
    return;
  }
  const papel = totalesDelPapelDeLaPantalla(venta, detalles);
  comparar('papel · renglones', aCentavos(papel.renglones), esperado.subtotalCentavos);
  comparar('papel · descuento', aCentavos(papel.descuento), esperado.descuentoCentavos);
  comparar('papel · IVA', aCentavos(papel.iva), esperado.impuestosCentavos);
  comparar('papel · total', aCentavos(papel.total), esperado.totalCentavos);
  const propinaDelPapel = propinaDeLaVentaEnPantalla(venta);
  comparar('papel · propina', aCentavos(propinaDelPapel), esperado.propinaCentavos);
  comparar(
    'pantalla · cambio',
    aCentavos((venta as { cambio?: unknown }).cambio ?? 0),
    esperado.cambioCentavos,
  );
  if (esperado.impuestosCentavos > 0n && papel.ivaSeSuma === IVAS[fila.iva].incluidoEnPrecio) {
    falla(
      `papel · el IVA ${papel.ivaSeSuma ? 'se suma' : 'va incluido'} en el papel y la configuración dice lo contrario`,
    );
  }
}

export interface EntradaDespues {
  readonly ordenId: string;
  readonly descontadoCentavos: bigint;
  readonly cobradas: readonly CuentaCobrada[];
  readonly falla: Falla;
}

/** Lo que se comprueba cuando todas las partes ya se cobraron. Devuelve la deriva de las partes. */
async function despues(
  mundo: Mundo,
  terminal: number,
  fila: FilaDeDinero,
  entrada: EntradaDespues,
): Promise<bigint> {
  const { falla, cobradas } = entrada;
  for (const cuenta of cobradas) await verificarUna(mundo, terminal, fila, cuenta, falla);

  const regla = IVAS[fila.iva];
  const entera = calcularCuenta({
    renglones: renglonesDelPedido(),
    ...(entrada.descontadoCentavos > 0n
      ? { descuentoDeLaCuenta: { tipo: 'monto' as const, centavos: entrada.descontadoCentavos } }
      : {}),
    impuesto: { puntosBase: regla.puntosBase, incluidoEnPrecio: regla.incluidoEnPrecio },
  });
  const sumaDeLasPartes = cobradas.reduce((s, c) => s + c.esperado.totalCentavos, 0n);
  if (fila.division === 'sin_dividir') return 0n;

  const sumaDe = (campo: 'subtotalCentavos' | 'descuentoCentavos'): bigint =>
    cobradas.reduce((s, c) => s + c.esperado[campo], 0n);
  if (sumaDe('subtotalCentavos') !== entera.subtotalCentavos) {
    falla(
      `división: las partes suman de subtotal ${String(sumaDe('subtotalCentavos'))} y la cuenta ${String(entera.subtotalCentavos)}`,
    );
  }
  if (sumaDe('descuentoCentavos') !== entera.descuentoCentavos) {
    falla(
      `división: las partes suman de descuento ${String(sumaDe('descuentoCentavos'))} y la cuenta ${String(entera.descuentoCentavos)}`,
    );
  }
  // Cada parte redondea su IVA por su cuenta (DP-D: «lo que se cobra son las partes»): puede diferir
  // un centavo por parte de la cuenta entera. Más que eso es un centavo perdido.
  const deriva = sumaDeLasPartes - entera.totalCentavos;
  const tope = BigInt(cobradas.length);
  if (deriva > tope || deriva < -tope) {
    falla(
      `división: las partes suman ${String(sumaDeLasPartes)} y la cuenta entera ${String(entera.totalCentavos)} (más de un centavo por parte)`,
    );
  }
  // Cada renglón del menú se reparte COMPLETO entre las partes.
  const porNombre = new Map<string, bigint>();
  for (const cuenta of cobradas) {
    for (const l of await lineasDe(cuenta.ordenId)) {
      porNombre.set(l.nombre, (porNombre.get(l.nombre) ?? 0n) + l.subtotal);
    }
  }
  const delMenu = renglonesDelPedido().map(importeDelRenglon);
  const esperados = [
    ['Arrachera al carbón', delMenu[0]],
    ['Guacamole con totopos', delMenu[1]],
    ['Cerveza clara', delMenu[2]],
    ['Barbacoa de horno', delMenu[3]],
  ] as const;
  for (const [nombre, importe] of esperados) {
    if ((porNombre.get(nombre) ?? 0n) !== importe) {
      falla(
        `división: «${nombre}» suma ${String(porNombre.get(nombre) ?? 0n)} entre las partes y el menú dice ${String(importe)}`,
      );
    }
  }
  return deriva;
}

export const verificarCuenta = { preparar, despues };
