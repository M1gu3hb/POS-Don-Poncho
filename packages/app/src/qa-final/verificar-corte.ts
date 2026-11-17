/**
 * DP-22 · EL CORTE DE LA CAJA SUMA EXACTAMENTE LAS CUENTAS COBRADAS, por forma de pago.
 *
 * El efectivo que debe haber en el cajón es el fondo más lo que el efectivo se quedó (sin el cambio,
 * con la propina que se dejó en efectivo); lo que cuenta cada forma de pago en la hoja del corte es
 * lo que se cobró con ella. Todo se compara contra el oráculo de cada cuenta.
 */
import type { ResultadoCorte } from '../caja/sesion.ts';
import type { HojaDelCorte } from '../caja/corte/documento.ts';

import type { Mundo } from './mundo.ts';
import type { CuentaCobrada } from './verificar-cuenta.ts';

type Falla = (texto: string) => void;

const suma = (cuentas: readonly CuentaCobrada[], f: (c: CuentaCobrada) => bigint): bigint =>
  cuentas.reduce((s, c) => s + f(c), 0n);

/** Lo que el contador cuenta al cerrar: fondo + efectivo cobrado (con su propina, sin el cambio). */
function efectivoQueDebeHaber(mundo: Mundo, cobradas: readonly CuentaCobrada[]): number {
  return Number(
    BigInt(mundo.fondoCentavos) + suma(cobradas, (c) => c.esperado.cobradoPorMetodo.efectivo),
  );
}

function comparar(
  mundo: Mundo,
  cobradas: readonly CuentaCobrada[],
  cerrada: ResultadoCorte,
  hoja: HojaDelCorte,
  falla: Falla,
): void {
  const igual = (que: string, sistema: string | bigint | number, oraculo: bigint): void => {
    if (BigInt(sistema) !== oraculo) {
      falla(`corte · ${que}: el sistema dice ${String(sistema)} y el oráculo ${String(oraculo)}`);
    }
  };
  const efectivo = suma(cobradas, (c) => c.esperado.cobradoPorMetodo.efectivo);
  igual(
    'efectivo esperado',
    cerrada.efectivoEsperadoCentavos,
    BigInt(mundo.fondoCentavos) + efectivo,
  );
  igual('diferencia', cerrada.diferenciaCentavos, 0n);
  igual(
    'ventas del corte',
    cerrada.ventasCentavos,
    suma(cobradas, (c) => c.esperado.totalCentavos),
  );
  igual('número de ventas', cerrada.numeroVentas, BigInt(cobradas.length));

  for (const metodo of ['efectivo', 'tarjeta'] as const) {
    const fila = hoja.metodos.find((m) => m.metodo === metodo);
    const ventas = suma(cobradas, (c) =>
      c.asignacion.filter((p) => p.metodo === metodo).reduce((s, p) => s + p.montoCentavos, 0n),
    );
    const propinas = suma(cobradas, (c) =>
      c.asignacion.filter((p) => p.metodo === metodo).reduce((s, p) => s + p.propinaCentavos, 0n),
    );
    igual(`${metodo} · ventas`, fila?.ventasCentavos ?? '0', ventas);
    igual(`${metodo} · propinas`, fila?.propinasCentavos ?? '0', propinas);
  }
  igual(
    'hoja · total',
    hoja.resumen.totalCentavos,
    suma(cobradas, (c) => c.esperado.totalCentavos),
  );
  igual(
    'hoja · impuestos',
    hoja.resumen.impuestosCentavos,
    suma(cobradas, (c) => c.esperado.impuestosCentavos),
  );
  igual(
    'hoja · descuento',
    hoja.resumen.descuentoCentavos,
    suma(cobradas, (c) => c.esperado.descuentoCentavos),
  );
  igual('hoja · tickets', hoja.resumen.tickets, BigInt(cobradas.length));
}

export const verificarCorte = { efectivoQueDebeHaber, comparar };
