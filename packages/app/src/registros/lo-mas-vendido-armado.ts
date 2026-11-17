/**
 * «LO MÁS VENDIDO» · EL ARMADO (DP-22 · DP-D160). Puro: sin base de datos.
 *
 * Recibe lo que el servidor sumó por platillo —lo VENDIDO del periodo (por el día de su venta) y lo
 * DEVUELTO del periodo (por el día de su devolución, como el corte: «el histórico no se toca»)— y arma
 * la lista: cada platillo con su cantidad, su importe, lo devuelto y lo que dejó (neto), de más a menos.
 *
 * Todo el dinero va en `bigint` de centavos y las cantidades en diezmilésimas enteras (la misma
 * precisión de `orden_lineas.cantidad`): nada se suma en coma flotante. Sale como texto.
 */

/** Lo vendido de un platillo en el periodo (líneas no anuladas de cuentas vendidas). */
export interface VendidoDelPlatillo {
  /** El id del producto, o su nombre si la línea ya no apunta a uno. */
  readonly clave: string;
  readonly nombre: string;
  readonly categoria: string | null;
  readonly lineas: number;
  /** Piezas, o kilos (lo que se vende por peso cuenta su peso, no la pieza de la línea). */
  readonly cantidad: string;
  readonly unidad: string;
  readonly importeCentavos: bigint;
}

/** Lo devuelto de un platillo en el periodo (por el día de la devolución). */
export interface DevueltoDelPlatillo {
  readonly clave: string;
  readonly nombre: string;
  readonly categoria: string | null;
  readonly unidad: string;
  readonly cantidad: string;
  readonly montoCentavos: bigint;
}

export interface PlatilloDeLoMasVendido {
  readonly nombre: string;
  readonly categoria: string | null;
  readonly lineas: number;
  readonly unidad: string;
  /** Lo vendido, sin descontar devoluciones. */
  readonly cantidad: string;
  readonly importeCentavos: string;
  readonly devueltoCantidad: string;
  readonly devueltoCentavos: string;
  /** Lo que quedó: vendido − devuelto. */
  readonly cantidadNeta: string;
  readonly netoCentavos: string;
}

export interface LoMasVendidoArmado {
  readonly platillos: readonly PlatilloDeLoMasVendido[];
  /** Lo vendido por platillo, SIN descontar devoluciones. */
  readonly vendidoCentavos: string;
  readonly devueltoCentavos: string;
  readonly netoCentavos: string;
}

const DECIMALES = 4;
const ESCALA = 10n ** BigInt(DECIMALES);

/** «1.75» → 17500n (diezmilésimas). Una cantidad rota es un error: no se adivina. */
export function enDiezmilesimas(texto: string): bigint {
  const limpio = texto.trim();
  if (!/^-?\d+(\.\d+)?$/.test(limpio))
    throw new Error(`Cantidad que no es un decimal: «${texto}».`);
  const negativo = limpio.startsWith('-');
  const [entera = '0', fraccion = ''] = limpio.replace('-', '').split('.');
  const valor =
    BigInt(entera) * ESCALA + BigInt(fraccion.padEnd(DECIMALES, '0').slice(0, DECIMALES));
  return negativo ? -valor : valor;
}

/** 17500n → «1.75» (sin ceros de sobra). */
export function deDiezmilesimas(valor: bigint): string {
  const negativo = valor < 0n;
  const absoluto = negativo ? -valor : valor;
  const entera = absoluto / ESCALA;
  const fraccion = (absoluto % ESCALA).toString().padStart(DECIMALES, '0').replace(/0+$/, '');
  return `${negativo ? '-' : ''}${entera.toString()}${fraccion === '' ? '' : `.${fraccion}`}`;
}

interface Acumulado {
  nombre: string;
  categoria: string | null;
  unidad: string;
  lineas: number;
  cantidad: bigint;
  importe: bigint;
  devueltoCantidad: bigint;
  devuelto: bigint;
}

export function armarLoMasVendido(
  vendidos: readonly VendidoDelPlatillo[],
  devueltos: readonly DevueltoDelPlatillo[],
): LoMasVendidoArmado {
  const porClave = new Map<string, Acumulado>();
  const de = (
    clave: string,
    nombre: string,
    categoria: string | null,
    unidad: string,
  ): Acumulado => {
    const previo = porClave.get(clave);
    if (previo !== undefined) return previo;
    const nuevo: Acumulado = {
      nombre,
      categoria,
      unidad,
      lineas: 0,
      cantidad: 0n,
      importe: 0n,
      devueltoCantidad: 0n,
      devuelto: 0n,
    };
    porClave.set(clave, nuevo);
    return nuevo;
  };
  for (const v of vendidos) {
    const a = de(v.clave, v.nombre, v.categoria, v.unidad);
    a.lineas += v.lineas;
    a.cantidad += enDiezmilesimas(v.cantidad);
    a.importe += v.importeCentavos;
  }
  for (const d of devueltos) {
    const a = de(d.clave, d.nombre, d.categoria, d.unidad);
    a.devueltoCantidad += enDiezmilesimas(d.cantidad);
    a.devuelto += d.montoCentavos;
  }
  const filas = [...porClave.values()].map((a) => ({ ...a, neto: a.importe - a.devuelto }));
  filas.sort((x, y) =>
    x.neto === y.neto ? x.nombre.localeCompare(y.nombre, 'es') : x.neto > y.neto ? -1 : 1,
  );
  let vendido = 0n;
  let devuelto = 0n;
  for (const f of filas) {
    vendido += f.importe;
    devuelto += f.devuelto;
  }
  return {
    platillos: filas.map((f) => ({
      nombre: f.nombre,
      categoria: f.categoria,
      lineas: f.lineas,
      unidad: f.unidad,
      cantidad: deDiezmilesimas(f.cantidad),
      importeCentavos: f.importe.toString(),
      devueltoCantidad: deDiezmilesimas(f.devueltoCantidad),
      devueltoCentavos: f.devuelto.toString(),
      cantidadNeta: deDiezmilesimas(f.cantidad - f.devueltoCantidad),
      netoCentavos: f.neto.toString(),
    })),
    vendidoCentavos: vendido.toString(),
    devueltoCentavos: devuelto.toString(),
    netoCentavos: (vendido - devuelto).toString(),
  };
}
