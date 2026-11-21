import { rotuloDeLaComanda } from '../restaurante/rotulo-de-la-comanda.ts';

import { inicioDeLaEspera } from './grupos';
import type { BloqueDeMesa } from './platillos-del-tablero';

/**
 * DP-24 · 4.1 · EL TÍTULO DE UN BLOQUE: «Mesa 1 · Ana · 7:30 p. m.» o «PARA LLEVAR · 3 · Don Beto».
 *
 * La mesa sale de la CUENTA y no de la comanda: en una unión de mesas las comandas conservan la
 * mesa en que se pidieron, y el bloque tiene que decir la mesa principal, que es la que atiende
 * el mesero y la que cobra la caja.
 */

export interface InfoDeLaCuenta {
  readonly mesero?: string | null;
  /** El número de la mesa de la cuenta (la principal si hay unión). */
  readonly mesaNumero?: number | null;
}

export interface EncabezadoDelBloque {
  /** «Mesa 1», «PARA LLEVAR · 3 · Don Beto» o «Mostrador». */
  readonly principal: string;
  /** «Ana · 7:30 p. m.»; vacío si no se sabe nada de ninguno de los dos. */
  readonly detalle: string;
}

export function horaDelPedido(iso: string | null, zona?: string): string {
  const t = iso === null ? Number.NaN : Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  return new Date(t).toLocaleTimeString('es-MX', {
    hour: 'numeric',
    minute: '2-digit',
    ...(zona === undefined ? {} : { timeZone: zona }),
  });
}

function primeraHora(bloque: BloqueDeMesa): string | null {
  let mejor: string | null = null;
  for (const comanda of bloque.comandas) {
    const f = inicioDeLaEspera(comanda);
    if (f !== null && (mejor === null || Date.parse(f) < Date.parse(mejor))) mejor = f;
  }
  return mejor;
}

export function encabezadoDelBloque(
  bloque: BloqueDeMesa,
  info?: InfoDeLaCuenta,
  zona?: string,
): EncabezadoDelBloque {
  const primera = bloque.comandas[0];
  if (primera === undefined) return { principal: 'Mostrador', detalle: '' };
  const principal = rotuloDeLaComanda({
    ...primera,
    mesa_numero: info?.mesaNumero ?? primera.mesa_numero ?? null,
  });
  const mesero = (info?.mesero ?? '').trim();
  const partes = [mesero, horaDelPedido(primeraHora(bloque), zona)].filter((p) => p !== '');
  return { principal, detalle: partes.join(' · ') };
}
