import { propinaBase, type PropinaDelCobro } from './cuenta-del-cobro.ts';

/**
 * LA PROPINA, ENTRE LA CUENTA Y LA TARJETA DE COBRO (DP-24). Puro.
 *
 * La cuenta que sirve el puente dice la propina en pesos y en porcentaje (`propina_tipo`,
 * `propina_porcentaje`, `propina_monto`); la tarjeta la maneja en centavos y puntos base. Aquí se
 * traduce de ida y de vuelta, en un solo sitio, para que el botón que se ve encendido sea siempre la
 * propina que la cuenta trae (la que eligieron los comensales en el portal llega ya puesta).
 */

/** Lo que la cuenta del puente dice de su propina. */
export interface PropinaEnLaCuenta {
  readonly propina_tipo?: string | null | undefined;
  /** 10 = 10 %. */
  readonly propina_porcentaje?: number | string | null | undefined;
  /** En pesos. */
  readonly propina_monto?: number | string | null | undefined;
  /** La venta, en pesos. */
  readonly total?: number | string | null | undefined;
}

function numero(valor: number | string | null | undefined): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function aCentavos(pesos: number | string | null | undefined): number {
  return Math.max(0, Math.round(numero(pesos) * 100));
}

/** Cómo llega elegida la propina a la tarjeta. */
export function propinaDeLaCuenta(cuenta: PropinaEnLaCuenta | null | undefined): PropinaDelCobro {
  const tipo = cuenta?.propina_tipo;
  if (tipo === 'sin_propina') return { tipo: 'sin_propina' };
  if (tipo === 'porcentaje') {
    const puntosBase = Math.round(numero(cuenta?.propina_porcentaje) * 100);
    return puntosBase > 0 ? { tipo: 'porcentaje', puntosBase } : { tipo: 'sin_propina' };
  }
  if (tipo === 'monto_manual') {
    // El importe que la Caja ya tiene a la vista; si no hay, el que sale de los puntos base.
    const yaElegido = aCentavos(cuenta?.propina_monto);
    const centavos =
      yaElegido > 0
        ? yaElegido
        : propinaBase(aCentavos(cuenta?.total), {
            tipo: 'porcentaje',
            puntosBase: Math.round(numero(cuenta?.propina_porcentaje) * 100),
          });
    return centavos > 0 ? { tipo: 'monto', centavos } : { tipo: 'sin_propina' };
  }
  return { tipo: 'sin_elegir' };
}

/** Lo que cambia en la cuenta que la Caja tiene abierta al elegir una propina en la tarjeta. */
export function propinaParaLaCuenta(
  propina: PropinaDelCobro,
  totalCentavos: number,
): {
  readonly propina_tipo: 'sin_propina' | 'porcentaje' | 'monto_manual';
  readonly propina_porcentaje: number;
  readonly propina_monto: number;
} {
  const centavos = propinaBase(totalCentavos, propina);
  if (centavos === 0 || propina.tipo === 'sin_propina' || propina.tipo === 'sin_elegir') {
    return { propina_tipo: 'sin_propina', propina_porcentaje: 0, propina_monto: 0 };
  }
  if (propina.tipo === 'porcentaje') {
    return {
      propina_tipo: 'porcentaje',
      propina_porcentaje: propina.puntosBase / 100,
      propina_monto: centavos / 100,
    };
  }
  // Un monto: su porcentaje es el que le toca sobre la venta (tope 100 %), a dos decimales.
  const puntosBase =
    totalCentavos > 0 ? Math.min(10_000, Math.round((centavos * 10_000) / totalCentavos)) : 0;
  return {
    propina_tipo: 'monto_manual',
    propina_porcentaje: puntosBase / 100,
    propina_monto: centavos / 100,
  };
}

/** ¿Es ésta la propina que está puesta? (para encender su botón). */
export function esLaPropinaPuesta(puesta: PropinaDelCobro, opcion: PropinaDelCobro): boolean {
  if (puesta.tipo !== opcion.tipo) return false;
  if (puesta.tipo === 'porcentaje' && opcion.tipo === 'porcentaje') {
    return puesta.puntosBase === opcion.puntosBase;
  }
  return true;
}
