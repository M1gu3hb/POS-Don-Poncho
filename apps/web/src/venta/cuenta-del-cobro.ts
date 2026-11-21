import { aplicarPorcentaje, type Centavos } from '@morphiqpos/domain/dinero';

/**
 * LA CUENTA DEL COBRO (DP-24 · la tarjeta de cobro nueva). Puro, y todo en CENTAVOS enteros.
 *
 * La Caja vieja hacía esta cuenta en pesos y en punto flotante, repartida entre el diálogo y
 * `handleCobrar`, y tenía dos huecos: un «Recibido» menor al total se cobraba como efectivo exacto
 * (con «Cambio $0.00»), y el pago mixto pedía teclear la venta y la propina por separado, por método.
 *
 * Aquí la cajera teclea lo que de verdad pasa: cuánto se le cobra a cada tarjeta, cuánto se
 * transfirió y cuánto efectivo recibió; todo con la propina dentro. De ahí sale:
 *
 *   · cuánto toca en efectivo (el resto), el cambio, y el cambio que se puede dejar de propina;
 *   · por qué NO se puede cobrar, si no cuadra (el botón se apaga y lo dice);
 *   · los renglones que viajan a `venta.cobrar`: la venta por un lado (suma EXACTAMENTE el total) y
 *     la propina por otro, por método. La propina sale primero del efectivo y, si no cabe, de la
 *     última tarjeta hacia atrás y al final de la transferencia: lo normal es «la cuenta con tarjeta
 *     y la propina en billete». Nunca un reparto proporcional.
 *
 * El total SIEMPRE lo recalcula el servidor; esto sólo decide qué se le enseña a quien cobra y qué se manda.
 */

/** Cómo está elegida la propina en la tarjeta. */
export type PropinaDelCobro =
  /** Nadie la ha decidido (pendiente, «decidir en caja»…): cuenta como cero hasta que se elija. */
  | { readonly tipo: 'sin_elegir' }
  | { readonly tipo: 'sin_propina' }
  /** 10 % es 1000. */
  | { readonly tipo: 'porcentaje'; readonly puntosBase: number }
  | { readonly tipo: 'monto'; readonly centavos: number };

export type ModoDePago = 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto';

/** Lo que la cajera tecleó en la tarjeta. */
export interface PagosTecleados {
  readonly modo: ModoDePago;
  /** El efectivo que entregó el cliente. `null` = no se tecleó: importe exacto. */
  readonly recibidoCentavos: number | null;
  /**
   * Lo que se le cobra a cada tarjeta, con la propina dentro. En `tarjeta` sin dividir va vacío
   * (una sola tarjeta con todo); dividida, tiene que sumar lo que se cobra. En `mixto`, el resto
   * es efectivo.
   */
  readonly tarjetasCentavos: readonly number[];
  /** Sólo en `mixto`. */
  readonly transferenciaCentavos: number;
  /** «Dejar el cambio como propina». */
  readonly cambioComoPropina: boolean;
  /**
   * Con qué se pagó la propina, si quien cobra lo dice (sólo importa con más de un método). Sin
   * decirlo: primero del efectivo. Lo que no quepa en ese método sigue por los demás.
   */
  readonly propinaCon?: PagoAEnviar['metodo'] | undefined;
}

/** Un renglón de `venta.cobrar`. `montoCentavos` es la VENTA; la propina va aparte. */
export interface PagoAEnviar {
  readonly metodo: 'efectivo' | 'tarjeta' | 'transferencia';
  readonly montoCentavos: number;
  readonly propinaCentavos?: number;
  readonly recibidoCentavos?: number;
}

export interface CuentaDelCobro {
  /** La venta, sin propina. */
  readonly totalCentavos: number;
  /** La propina que se va a cobrar (con el cambio, si se dejó). */
  readonly propinaCentavos: number;
  /** Total + propina. */
  readonly aCobrarCentavos: number;
  /** Lo que toca pagar en efectivo, con su propina. */
  readonly efectivoCentavos: number;
  readonly tarjetaCentavos: number;
  readonly transferenciaCentavos: number;
  /** Lo que se le devuelve al cliente. */
  readonly cambioCentavos: number;
  /** El cambio que hay (o había) para dejar de propina: no cambia al dejarlo. */
  readonly cambioOfrecidoCentavos: number;
  /** Positivo: falta. Negativo: sobra. Cero: cuadra. */
  readonly faltaCentavos: number;
  /** Por qué no se puede cobrar, o `null` si se puede. */
  readonly tropiezo: string | null;
  /** Vacío si hay tropiezo. */
  readonly pagos: readonly PagoAEnviar[];
  /** Cómo queda escrito en la cuenta que se decidió la propina. */
  readonly propinaAEnviar: {
    readonly tipo: 'sin_propina' | 'porcentaje' | 'monto_manual';
    readonly puntosBase: number;
  };
}

const PUNTOS_BASE_100 = 10_000;
/** Sin que nadie diga otra cosa: la propina sale del efectivo, luego de las tarjetas y al final de la transferencia. */
const ORDEN_DE_LA_PROPINA: readonly PagoAEnviar['metodo'][] = [
  'efectivo',
  'tarjeta',
  'transferencia',
];

function entero(valor: number): number {
  return Number.isFinite(valor) ? Math.max(0, Math.trunc(valor)) : 0;
}

/** «$1,234.50», para los avisos de la tarjeta. */
export function enPesos(centavos: number): string {
  return (centavos / 100).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

/** La propina elegida, en centavos, sin el cambio. El porcentaje redondea como el servidor. */
export function propinaBase(totalCentavos: number, propina: PropinaDelCobro): number {
  if (propina.tipo === 'monto') return entero(propina.centavos);
  if (propina.tipo !== 'porcentaje') return 0;
  const puntos = entero(propina.puntosBase);
  if (puntos === 0 || entero(totalCentavos) === 0) return 0;
  return Number(aplicarPorcentaje(BigInt(entero(totalCentavos)) as Centavos, puntos));
}

function puntosBaseDe(propinaCentavos: number, totalCentavos: number): number {
  if (totalCentavos <= 0) return 0;
  return Math.min(PUNTOS_BASE_100, Math.round((propinaCentavos * PUNTOS_BASE_100) / totalCentavos));
}

function comoSeDecidio(
  propina: PropinaDelCobro,
  propinaCentavos: number,
  totalCentavos: number,
  conCambio: boolean,
): CuentaDelCobro['propinaAEnviar'] {
  if (propinaCentavos === 0) return { tipo: 'sin_propina', puntosBase: 0 };
  if (propina.tipo === 'porcentaje' && !conCambio) {
    return { tipo: 'porcentaje', puntosBase: entero(propina.puntosBase) };
  }
  return { tipo: 'monto_manual', puntosBase: puntosBaseDe(propinaCentavos, totalCentavos) };
}

/** Lo que no es efectivo, según el modo. */
function loQueNoEsEfectivo(
  pagos: PagosTecleados,
  aCobrar: number,
): { readonly tarjetas: readonly number[]; readonly transferencia: number } {
  const tecleadas = pagos.tarjetasCentavos.map(entero).filter((importe) => importe > 0);
  if (pagos.modo === 'efectivo') return { tarjetas: [], transferencia: 0 };
  if (pagos.modo === 'transferencia') return { tarjetas: [], transferencia: aCobrar };
  if (pagos.modo === 'tarjeta') {
    // Sin dividir: una tarjeta con todo. Dividida: lo que se tecleó (aunque todavía no cuadre).
    const dividida = pagos.tarjetasCentavos.length > 0;
    return { tarjetas: dividida ? tecleadas : [aCobrar], transferencia: 0 };
  }
  return { tarjetas: tecleadas, transferencia: entero(pagos.transferenciaCentavos) };
}

function sumar(importes: readonly number[]): number {
  return importes.reduce((suma, importe) => suma + importe, 0);
}

/**
 * La propina por renglón: primero del efectivo, luego de la última tarjeta hacia atrás y al final
 * de la transferencia. Devuelve cuánto lleva cada uno.
 */
function repartirLaPropina(
  propina: number,
  efectivo: number,
  tarjetas: readonly number[],
  transferencia: number,
  primero: PagoAEnviar['metodo'] = 'efectivo',
): {
  readonly efectivo: number;
  readonly tarjetas: readonly number[];
  readonly transferencia: number;
} {
  let resto = propina;
  let delEfectivo = 0;
  let deLaTransferencia = 0;
  const deLasTarjetas = tarjetas.map(() => 0);
  const orden = [primero, ...ORDEN_DE_LA_PROPINA.filter((metodo) => metodo !== primero)];
  for (const metodo of orden) {
    if (metodo === 'efectivo') {
      delEfectivo = Math.min(resto, efectivo);
      resto -= delEfectivo;
    } else if (metodo === 'transferencia') {
      deLaTransferencia = Math.min(resto, transferencia);
      resto -= deLaTransferencia;
    } else {
      for (let i = tarjetas.length - 1; i >= 0 && resto > 0; i -= 1) {
        const toma = Math.min(resto, tarjetas[i] ?? 0);
        deLasTarjetas[i] = toma;
        resto -= toma;
      }
    }
  }
  return { efectivo: delEfectivo, tarjetas: deLasTarjetas, transferencia: deLaTransferencia };
}

function renglon(
  metodo: PagoAEnviar['metodo'],
  importe: number,
  propina: number,
  recibido?: number,
): PagoAEnviar {
  return {
    metodo,
    montoCentavos: importe - propina,
    ...(propina > 0 ? { propinaCentavos: propina } : {}),
    ...(recibido === undefined ? {} : { recibidoCentavos: recibido }),
  };
}

export function cuentaDelCobro(
  totalDeLaVenta: number,
  propina: PropinaDelCobro,
  pagos: PagosTecleados,
): CuentaDelCobro {
  const total = entero(totalDeLaVenta);
  const base = propinaBase(total, propina);

  // 1 · Sin el cambio: cuánto toca en efectivo y cuánto cambio habría.
  const sinCambio = loQueNoEsEfectivo(pagos, total + base);
  const noEfectivoBase = sumar(sinCambio.tarjetas) + sinCambio.transferencia;
  const efectivoBase = Math.max(0, total + base - noEfectivoBase);
  const hayEfectivo = pagos.modo === 'efectivo' || pagos.modo === 'mixto';
  const recibido =
    hayEfectivo && pagos.recibidoCentavos !== null ? entero(pagos.recibidoCentavos) : null;
  const cambioOfrecido = recibido === null ? 0 : Math.max(0, recibido - efectivoBase);

  // 2 · El cambio que se deja pasa a la propina (y entonces el efectivo crece lo mismo).
  const extra = pagos.cambioComoPropina ? cambioOfrecido : 0;
  const propinaCentavos = base + extra;
  const aCobrar = total + propinaCentavos;
  const { tarjetas, transferencia } = loQueNoEsEfectivo(pagos, aCobrar);
  const tarjetaCentavos = sumar(tarjetas);
  const noEfectivo = tarjetaCentavos + transferencia;
  const efectivo = hayEfectivo ? Math.max(0, aCobrar - noEfectivo) : 0;
  const cambio = recibido === null ? 0 : Math.max(0, recibido - efectivo);

  const comun = {
    totalCentavos: total,
    propinaCentavos,
    aCobrarCentavos: aCobrar,
    efectivoCentavos: efectivo,
    tarjetaCentavos,
    transferenciaCentavos: transferencia,
    cambioOfrecidoCentavos: cambioOfrecido,
    propinaAEnviar: comoSeDecidio(propina, propinaCentavos, total, extra > 0),
  };
  const noSeCobra = (tropiezo: string, faltaCentavos: number): CuentaDelCobro => ({
    ...comun,
    cambioCentavos: 0,
    faltaCentavos,
    tropiezo,
    pagos: [],
  });

  // 3 · Por qué no se puede cobrar.
  if (total === 0) return noSeCobra('Esta cuenta está en $0.00: no se puede cobrar.', 0);
  const diferencia = aCobrar - noEfectivo;
  if (pagos.modo === 'tarjeta' && diferencia > 0) {
    return noSeCobra(`Faltan ${enPesos(diferencia)} por repartir entre las tarjetas.`, diferencia);
  }
  if (diferencia < 0) {
    const quienes = pagos.modo === 'mixto' ? 'Las tarjetas y la transferencia' : 'Las tarjetas';
    return noSeCobra(`${quienes} suman ${enPesos(-diferencia)} de más.`, diferencia);
  }
  if (recibido !== null && recibido < efectivo) {
    return noSeCobra(`Faltan ${enPesos(efectivo - recibido)} en efectivo.`, efectivo - recibido);
  }

  // 4 · Los renglones: la venta por un lado y la propina por otro.
  const reparto = repartirLaPropina(
    propinaCentavos,
    efectivo,
    tarjetas,
    transferencia,
    pagos.propinaCon,
  );
  const renglones: PagoAEnviar[] = [];
  if (efectivo > 0) {
    renglones.push(renglon('efectivo', efectivo, reparto.efectivo, recibido ?? undefined));
  }
  tarjetas.forEach((importe, i) => {
    renglones.push(renglon('tarjeta', importe, reparto.tarjetas[i] ?? 0));
  });
  if (transferencia > 0) {
    renglones.push(renglon('transferencia', transferencia, reparto.transferencia));
  }

  return { ...comun, cambioCentavos: cambio, faltaCentavos: 0, tropiezo: null, pagos: renglones };
}
