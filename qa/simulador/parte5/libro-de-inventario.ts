/**
 * EL LIBRO DE INVENTARIO DE LA PARTE 5: lo que el libro (no el sistema) dice que hay de cada insumo y
 * lo que cuesta, siguiendo cada paso con sus cuentas: lo vendido baja la existencia, lo comprado la
 * sube y promedia el costo EXACTO (DP-D165: una división, un redondeo, el negativo cuenta como cero),
 * la merma y el conteo la mueven. Al final, «Valor de inventario» es Σ round(existencia × costo exacto / 10 000).
 */

export interface InsumoDelLibro {
  existencia: number;
  /** Diezmilésimas de centavo por unidad base. */
  dmc: bigint;
}

export class LibroDeInventario {
  private readonly insumos = new Map<string, InsumoDelLibro>();

  /** El punto de partida: lo que había en el almacén al empezar (se lee UNA vez, antes de operar). */
  fijar(nombre: string, existencia: number, dmc: bigint): void {
    this.insumos.set(nombre, { existencia, dmc });
  }

  existencia(nombre: string): number {
    return this.insumos.get(nombre)?.existencia ?? 0;
  }

  dmc(nombre: string): bigint {
    return this.insumos.get(nombre)?.dmc ?? 0n;
  }

  /** Mueve la existencia (con signo): ventas, mermas, conteos, devoluciones. */
  mover(nombre: string, delta: number): void {
    const i = this.insumos.get(nombre) ?? { existencia: 0, dmc: 0n };
    this.insumos.set(nombre, {
      ...i,
      existencia: Math.round((i.existencia + delta) * 10_000) / 10_000,
    });
  }

  /** Fija la existencia tras un conteo («stock final»). */
  contar(nombre: string, final: number): void {
    const i = this.insumos.get(nombre) ?? { existencia: 0, dmc: 0n };
    this.insumos.set(nombre, { ...i, existencia: final });
  }

  /** Una compra: sube la existencia y promedia el costo exacto sobre lo que había (el negativo cuenta como cero). */
  comprar(nombre: string, entrante: number, totalCentavos: number): void {
    const i = this.insumos.get(nombre) ?? { existencia: 0, dmc: 0n };
    const s = BigInt(Math.max(i.existencia, 0));
    const divisor = s + BigInt(entrante);
    const numerador = s * i.dmc + BigInt(totalCentavos) * 10_000n;
    const dmc = (numerador * 2n + divisor) / (divisor * 2n);
    this.insumos.set(nombre, {
      existencia: Math.round((i.existencia + entrante) * 10_000) / 10_000,
      dmc,
    });
  }

  /** Lo que vale una cantidad de un insumo con SU costo exacto actual, redondeado una vez a centavos. */
  valorDe(nombre: string, cantidad: number): number {
    const dmc = this.dmc(nombre);
    const x = BigInt(Math.round(cantidad * 10_000)) * dmc;
    // (cantidad en diezmilésimas × dmc) / 10 000 (por la escala de la cantidad) / 10 000 (de dmc a centavos).
    return Number((x * 2n + 100_000_000n) / 200_000_000n);
  }

  /** El «Valor de inventario» del libro: lo que está en negativo vale cero (DP-D146). */
  valorTotal(): number {
    let total = 0;
    for (const [nombre, i] of this.insumos)
      total += this.valorDe(nombre, Math.max(i.existencia, 0));
    return total;
  }

  /** El costo de una receta (insumo → cantidad por pieza) con los costos de hoy, redondeado UNA vez a centavos. */
  costoDeReceta(receta: Readonly<Record<string, number>>): number {
    let x = 0n;
    for (const [nombre, cantidad] of Object.entries(receta))
      x += BigInt(Math.round(cantidad * 10_000)) * this.dmc(nombre);
    return Number((x * 2n + 100_000_000n) / 200_000_000n);
  }

  nombres(): string[] {
    return [...this.insumos.keys()];
  }
}
