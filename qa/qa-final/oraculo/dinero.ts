/**
 * DP-22 · EL ORÁCULO DEL DINERO: un cálculo INDEPENDIENTE de lo que debe cobrar una cuenta.
 *
 * Las combinaciones de configuración (Parte 4) y el día de bots (Parte 10) comparan al centavo lo
 * que dice el sistema contra esto. Por eso no importa NADA de `packages/`: si reusara el código
 * que cobra, sólo comprobaría que el código es igual a sí mismo. Aquí las reglas están escritas
 * otra vez, desde las decisiones (`DECISIONES.md`) y con otra aritmética: fracciones exactas
 * (numerador y denominador enteros) que se redondean una sola vez, donde la regla dice.
 *
 * Las reglas:
 *   1. El importe de un renglón es precio × cantidad, al centavo más cercano (medio centavo sube).
 *      La cantidad puede traer decimales (lo que va por peso: «0.25» kg).
 *   2. Las opciones con precio suman por pieza en lo que va por pieza y una sola vez por renglón
 *      en lo que va por peso o por porción (DP-D104). Un renglón nunca baja de cero.
 *   3. El descuento (de renglón, de cuenta y la cortesía, que es el renglón entero) se resta del
 *      subtotal y nunca lo deja en negativo.
 *   4. El IVA incluido se EXTRAE del total: total × tasa / (100 % + tasa). El IVA sumado se pone
 *      encima: total × tasa / 100 %. Con tasa 0 no hay impuesto (DP-D129).
 *   5. La propina en porcentaje es sobre el total de la cuenta (lo que el comensal ve), al
 *      centavo; la de monto es ese monto. Nunca entra en la venta: va aparte.
 *   6. El cambio es lo entregado en efectivo menos lo que el efectivo tenía que cubrir. Con
 *      tarjeta y transferencia no hay cambio.
 */

/** Una fracción exacta. El denominador siempre es positivo. */
interface Fraccion {
  readonly n: bigint;
  readonly d: bigint;
}

const entero = (n: bigint): Fraccion => ({ n, d: 1n });
const por = (a: Fraccion, b: Fraccion): Fraccion => ({ n: a.n * b.n, d: a.d * b.d });
const entre = (a: Fraccion, b: Fraccion): Fraccion => {
  if (b.n === 0n) throw new Error('El oráculo no divide entre cero.');
  return b.n < 0n ? { n: -a.n * b.d, d: a.d * -b.n } : { n: a.n * b.d, d: a.d * b.n };
};

/** Al centavo más cercano; justo a la mitad, se aleja de cero. */
function alCentavo({ n, d }: Fraccion): bigint {
  const negativo = n < 0n;
  const magnitud = negativo ? -n : n;
  const piso = magnitud / d;
  const sobra = magnitud % d;
  const redondeado = sobra * 2n >= d ? piso + 1n : piso;
  return negativo ? -redondeado : redondeado;
}

/** «2», «0.5», «1.250» → fracción exacta. Sin notación científica ni signos. */
export function cantidadExacta(texto: string): Fraccion {
  const limpio = texto.trim();
  if (!/^\d+(?:\.\d+)?$/u.test(limpio)) {
    throw new Error(`El oráculo no entiende la cantidad «${texto}».`);
  }
  const [enteros = '0', decimales = ''] = limpio.split('.');
  return { n: BigInt(enteros + decimales), d: 10n ** BigInt(decimales.length) };
}

export interface RenglonDelOraculo {
  /** Precio de lista en centavos: por pieza, por kilo o por porción. */
  readonly precioCentavos: bigint;
  /** Cuánto se pidió, como se teclea: «3», «0.25». */
  readonly cantidad: string;
  /** Lo que suman (o restan) las opciones elegidas, en centavos. */
  readonly opcionesCentavos?: bigint;
  /** `true` si las opciones se cobran por pieza; `false` si una vez por renglón (peso, porción). */
  readonly opcionesPorPieza?: boolean;
  /** Descuento del renglón, en centavos. */
  readonly descuentoCentavos?: bigint;
  /** Cortesía: el renglón se regala entero. */
  readonly cortesia?: boolean;
}

export type MetodoDePago = 'efectivo' | 'tarjeta' | 'transferencia';

export interface PagoDelOraculo {
  readonly metodo: MetodoDePago;
  /** Lo que el comensal ENTREGÓ por ese método (en efectivo puede ser de más). */
  readonly entregadoCentavos: bigint;
}

export type PropinaDelOraculo =
  | { readonly tipo: 'ninguna' }
  | { readonly tipo: 'porcentaje'; readonly puntosBase: number }
  | { readonly tipo: 'monto'; readonly centavos: bigint };

export interface CuentaDelOraculo {
  readonly renglones: readonly RenglonDelOraculo[];
  /** Descuento sobre toda la cuenta: en puntos base del subtotal ya descontado, o en centavos. */
  readonly descuentoDeLaCuenta?:
    | { readonly tipo: 'porcentaje'; readonly puntosBase: number }
    | { readonly tipo: 'monto'; readonly centavos: bigint };
  readonly impuesto: { readonly puntosBase: number; readonly incluidoEnPrecio: boolean };
  readonly propina?: PropinaDelOraculo;
  readonly pagos?: readonly PagoDelOraculo[];
}

export interface ResultadoDelOraculo {
  readonly renglonesCentavos: readonly bigint[];
  readonly subtotalCentavos: bigint;
  readonly descuentoCentavos: bigint;
  readonly impuestosCentavos: bigint;
  /** La venta: lo que entra a ventas, con su IVA y sin propina. */
  readonly totalCentavos: bigint;
  readonly propinaCentavos: bigint;
  /** Lo que el comensal paga: venta más propina. */
  readonly totalACobrarCentavos: bigint;
  /** Lo que se queda cada método (sin el cambio). */
  readonly cobradoPorMetodo: Readonly<Record<MetodoDePago, bigint>>;
  readonly cambioCentavos: bigint;
  /** Lo que falta por cubrir si lo entregado no alcanza (0 si alcanza). */
  readonly faltanteCentavos: bigint;
}

const DIEZ_MIL = 10_000n;

function exigirPuntosBase(valor: number, que: string): bigint {
  if (!Number.isInteger(valor) || valor < 0) {
    throw new Error(`El oráculo espera ${que} en puntos base enteros y no negativos.`);
  }
  return BigInt(valor);
}

/** El importe de un renglón, antes de su descuento (reglas 1 y 2). */
export function importeDelRenglon(renglon: RenglonDelOraculo): bigint {
  const cantidad = cantidadExacta(renglon.cantidad);
  const opciones = renglon.opcionesCentavos ?? 0n;
  const porPieza = renglon.opcionesPorPieza ?? true;
  const base = porPieza
    ? alCentavo(por(entero(renglon.precioCentavos + opciones), cantidad))
    : alCentavo(por(entero(renglon.precioCentavos), cantidad)) + opciones;
  return base < 0n ? 0n : base;
}

export function calcularCuenta(cuenta: CuentaDelOraculo): ResultadoDelOraculo {
  const renglonesCentavos = cuenta.renglones.map(importeDelRenglon);
  const subtotal = renglonesCentavos.reduce((suma, importe) => suma + importe, 0n);

  // Regla 3 · Descuentos: los de renglón (y la cortesía) primero; el de cuenta, sobre lo que queda.
  let descuento = 0n;
  cuenta.renglones.forEach((renglon, indice) => {
    const importe = renglonesCentavos[indice] ?? 0n;
    const pedido = renglon.cortesia === true ? importe : (renglon.descuentoCentavos ?? 0n);
    descuento += pedido > importe ? importe : pedido;
  });
  const trasRenglones = subtotal - descuento;
  const deLaCuenta = cuenta.descuentoDeLaCuenta;
  if (deLaCuenta !== undefined) {
    const pedido =
      deLaCuenta.tipo === 'monto'
        ? deLaCuenta.centavos
        : alCentavo(
            entre(
              por(
                entero(trasRenglones),
                entero(exigirPuntosBase(deLaCuenta.puntosBase, 'el descuento')),
              ),
              entero(DIEZ_MIL),
            ),
          );
    descuento += pedido > trasRenglones ? trasRenglones : pedido;
  }
  const conDescuento = subtotal - descuento;

  // Regla 4 · El IVA.
  const tasa = exigirPuntosBase(cuenta.impuesto.puntosBase, 'la tasa de IVA');
  const impuestos =
    tasa === 0n
      ? 0n
      : cuenta.impuesto.incluidoEnPrecio
        ? alCentavo(entre(por(entero(conDescuento), entero(tasa)), entero(DIEZ_MIL + tasa)))
        : alCentavo(entre(por(entero(conDescuento), entero(tasa)), entero(DIEZ_MIL)));
  const total = cuenta.impuesto.incluidoEnPrecio ? conDescuento : conDescuento + impuestos;

  // Regla 5 · La propina.
  const propina = cuenta.propina ?? { tipo: 'ninguna' };
  const propinaCentavos =
    propina.tipo === 'ninguna'
      ? 0n
      : propina.tipo === 'monto'
        ? propina.centavos
        : alCentavo(
            entre(
              por(entero(total), entero(exigirPuntosBase(propina.puntosBase, 'la propina'))),
              entero(DIEZ_MIL),
            ),
          );
  const totalACobrar = total + propinaCentavos;

  // Regla 6 · Los pagos: tarjeta y transferencia cubren lo suyo; el efectivo, lo que falte.
  const cobrado: Record<MetodoDePago, bigint> = { efectivo: 0n, tarjeta: 0n, transferencia: 0n };
  let pendiente = totalACobrar;
  let entregadoEnEfectivo = 0n;
  for (const pago of cuenta.pagos ?? []) {
    if (pago.entregadoCentavos < 0n) throw new Error('Un pago no puede ser negativo.');
    if (pago.metodo === 'efectivo') {
      entregadoEnEfectivo += pago.entregadoCentavos;
      continue;
    }
    if (pago.entregadoCentavos > pendiente) {
      throw new Error('Con tarjeta o transferencia no se cobra de más: no hay cambio que dar.');
    }
    cobrado[pago.metodo] += pago.entregadoCentavos;
    pendiente -= pago.entregadoCentavos;
  }
  const delEfectivo = entregadoEnEfectivo > pendiente ? pendiente : entregadoEnEfectivo;
  cobrado.efectivo = delEfectivo;
  pendiente -= delEfectivo;

  return {
    renglonesCentavos,
    subtotalCentavos: subtotal,
    descuentoCentavos: descuento,
    impuestosCentavos: impuestos,
    totalCentavos: total,
    propinaCentavos,
    totalACobrarCentavos: totalACobrar,
    cobradoPorMetodo: cobrado,
    cambioCentavos: entregadoEnEfectivo - delEfectivo,
    faltanteCentavos: pendiente,
  };
}

/**
 * Partes iguales de un importe: la suma de las partes es el importe exacto; los centavos que no
 * caben se dan de uno en uno a las primeras partes.
 */
export function partesIguales(importeCentavos: bigint, partes: number): bigint[] {
  if (!Number.isInteger(partes) || partes < 1) throw new Error('Se divide en una parte o más.');
  const cuantas = BigInt(partes);
  const base = importeCentavos / cuantas;
  const sobran = Number(importeCentavos % cuantas);
  return Array.from({ length: partes }, (_, indice) => (indice < sobran ? base + 1n : base));
}
