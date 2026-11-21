import {
  cuentaDelCobro,
  type CuentaDelCobro,
  type ModoDePago,
  type PagoAEnviar,
  type PagosTecleados,
  type PropinaDelCobro,
} from './cuenta-del-cobro.ts';
import { aCentavos } from './importe-tecleado.ts';

/**
 * LO QUE LA CAJERA VA TECLEANDO EN LA TARJETA DE COBRO (DP-24). Puro: el estado y sus cambios.
 *
 * Los importes viven como TEXTO (lo que se ve en el campo) y los lee `aCentavos`, el mismo de los
 * retiros: el dinero no pasa por punto flotante. Cada cambio devuelve un estado nuevo; la cuenta
 * (`cuentaDelCobro`) se deriva de él, nunca se guarda.
 */

/** El campo al que escribe el teclado de la tarjeta. */
export type CampoDelCobro = 'recibido' | 'transferencia' | 'otro-monto' | `tarjeta-${string}`;

export type TeclaDeImporte =
  '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '00' | '.' | 'borrar' | 'limpiar';

export interface CobroEnPantalla {
  readonly modo: ModoDePago;
  readonly recibido: string;
  /** En `tarjeta`: «Dividir en tarjetas» encendido. */
  readonly dividida: boolean;
  readonly tarjetas: readonly string[];
  readonly transferencia: string;
  readonly cambioComoPropina: boolean;
  /** Con qué se pagó la propina, si quien cobra lo dijo. */
  readonly propinaCon: PagoAEnviar['metodo'] | null;
  readonly campoActivo: CampoDelCobro | null;
  /** «Otro monto» de propina: lo que se va tecleando antes de ponerlo. */
  readonly otroMonto: string;
  readonly otroMontoAbierto: boolean;
}

export const MAXIMO_DE_TARJETAS = 10;

export const COBRO_INICIAL: CobroEnPantalla = {
  modo: 'efectivo',
  recibido: '',
  dividida: false,
  tarjetas: [],
  transferencia: '',
  cambioComoPropina: false,
  propinaCon: null,
  campoActivo: 'recibido',
  otroMonto: '',
  otroMontoAbierto: false,
};

/** «506» o «506.50»: como se escribe un importe en un campo. */
export function textoDeCentavos(centavos: number): string {
  const entero = Math.max(0, Math.trunc(centavos));
  return entero % 100 === 0 ? String(entero / 100) : (entero / 100).toFixed(2);
}

export function elegirModo(estado: CobroEnPantalla, modo: ModoDePago): CobroEnPantalla {
  if (estado.modo === modo) return estado;
  const comun = {
    ...estado,
    modo,
    cambioComoPropina: false,
    propinaCon: null,
    otroMontoAbierto: false,
  };
  if (modo === 'efectivo') return { ...comun, campoActivo: 'recibido' };
  if (modo === 'mixto') {
    const tarjetas = estado.tarjetas.length > 0 ? estado.tarjetas : [''];
    return { ...comun, dividida: false, tarjetas, campoActivo: 'tarjeta-0' };
  }
  // Una tarjeta o una transferencia con todo: no hay nada que teclear.
  return { ...comun, dividida: false, tarjetas: [], campoActivo: null };
}

export function dividirEnTarjetas(estado: CobroEnPantalla): CobroEnPantalla {
  return {
    ...estado,
    modo: 'tarjeta',
    dividida: true,
    tarjetas: ['', ''],
    campoActivo: 'tarjeta-0',
  };
}

export function unaSolaTarjeta(estado: CobroEnPantalla): CobroEnPantalla {
  return { ...estado, modo: 'tarjeta', dividida: false, tarjetas: [], campoActivo: null };
}

export function agregarTarjeta(estado: CobroEnPantalla): CobroEnPantalla {
  if (estado.tarjetas.length >= MAXIMO_DE_TARJETAS) return estado;
  return {
    ...estado,
    tarjetas: [...estado.tarjetas, ''],
    campoActivo: `tarjeta-${String(estado.tarjetas.length)}`,
  };
}

export function quitarTarjeta(estado: CobroEnPantalla, indice: number): CobroEnPantalla {
  const tarjetas = estado.tarjetas.filter((_, i) => i !== indice);
  // Dividir pide al menos dos; con una, vuelve a ser «una sola tarjeta».
  if (estado.modo === 'tarjeta' && tarjetas.length < 2) return unaSolaTarjeta(estado);
  return { ...estado, tarjetas, campoActivo: tarjetas.length > 0 ? 'tarjeta-0' : null };
}

function indiceDeTarjeta(campo: CampoDelCobro): number | null {
  if (!campo.startsWith('tarjeta-')) return null;
  const indice = Number(campo.slice('tarjeta-'.length));
  return Number.isInteger(indice) && indice >= 0 ? indice : null;
}

export function textoDe(estado: CobroEnPantalla, campo: CampoDelCobro): string {
  if (campo === 'recibido') return estado.recibido;
  if (campo === 'transferencia') return estado.transferencia;
  if (campo === 'otro-monto') return estado.otroMonto;
  const indice = indiceDeTarjeta(campo);
  return indice === null ? '' : (estado.tarjetas[indice] ?? '');
}

/** Pone un texto en un campo. Tocar un importe deshace «dejar el cambio»: era para otro cambio. */
export function escribir(
  estado: CobroEnPantalla,
  campo: CampoDelCobro,
  texto: string,
): CobroEnPantalla {
  if (campo === 'otro-monto') return { ...estado, otroMonto: texto };
  const comun = { ...estado, cambioComoPropina: false };
  if (campo === 'recibido') return { ...comun, recibido: texto };
  if (campo === 'transferencia') return { ...comun, transferencia: texto };
  const indice = indiceDeTarjeta(campo);
  if (indice === null || indice >= estado.tarjetas.length) return estado;
  return { ...comun, tarjetas: estado.tarjetas.map((t, i) => (i === indice ? texto : t)) };
}

const ENTEROS_MAXIMOS = 7;

/** Lo que queda al tocar una tecla sobre un texto: sólo importes bien formados. */
export function trasLaTecla(texto: string, tecla: TeclaDeImporte): string {
  if (tecla === 'limpiar') return '';
  if (tecla === 'borrar') return texto.slice(0, -1);
  // Lo que venía con comas (tecleado a mano) se sigue sin ellas.
  const llano = texto.replaceAll(',', '');
  const [enteros = '', decimales] = llano.split('.');
  if (tecla === '.') return decimales === undefined ? `${enteros === '' ? '0' : enteros}.` : llano;
  if (decimales !== undefined) {
    const nuevos = `${decimales}${tecla}`;
    return nuevos.length > 2 ? llano : `${enteros}.${nuevos}`;
  }
  const nuevos = `${enteros}${tecla}`.replace(/^0+(?=\d)/, '');
  return nuevos.length > ENTEROS_MAXIMOS ? llano : nuevos;
}

/** Una tecla del teclado de la tarjeta, sobre el campo activo. */
export function teclear(estado: CobroEnPantalla, tecla: TeclaDeImporte): CobroEnPantalla {
  const campo = estado.campoActivo;
  if (campo === null) return estado;
  return escribir(estado, campo, trasLaTecla(textoDe(estado, campo), tecla));
}

export interface LecturaDelCobro {
  readonly cuenta: CuentaDelCobro;
  /** Algún importe tecleado no se entiende: no se cobra hasta corregirlo. */
  readonly ilegible: boolean;
}

/** La cuenta que sale de lo tecleado. Un importe que no se entiende detiene el cobro. */
export function leerElCobro(
  estado: CobroEnPantalla,
  totalCentavos: number,
  propina: PropinaDelCobro,
): LecturaDelCobro {
  const usaTarjetas = estado.modo === 'mixto' || (estado.modo === 'tarjeta' && estado.dividida);
  const hayEfectivo = estado.modo === 'efectivo' || estado.modo === 'mixto';
  const recibido = hayEfectivo ? aCentavos(estado.recibido) : 0;
  const tarjetas = usaTarjetas ? estado.tarjetas.map((texto) => aCentavos(texto)) : [];
  const transferencia = estado.modo === 'mixto' ? aCentavos(estado.transferencia) : 0;
  const ilegible =
    recibido === null || transferencia === null || tarjetas.some((importe) => importe === null);
  const pagos: PagosTecleados = {
    modo: estado.modo,
    // Vacío es «exacto»; un cero tecleado es un cero.
    recibidoCentavos: hayEfectivo && estado.recibido.trim() !== '' ? (recibido ?? 0) : null,
    tarjetasCentavos: tarjetas.map((importe) => importe ?? 0),
    transferenciaCentavos: transferencia ?? 0,
    cambioComoPropina: estado.cambioComoPropina,
    propinaCon: estado.propinaCon ?? undefined,
  };
  const cuenta = cuentaDelCobro(totalCentavos, propina, pagos);
  if (!ilegible) return { cuenta, ilegible: false };
  return {
    ilegible: true,
    cuenta: {
      ...cuenta,
      cambioCentavos: 0,
      pagos: [],
      tropiezo:
        'Hay un importe que no se entiende: sólo números, con punto para los centavos (15.50).',
    },
  };
}

/** Lo que le falta a una tarjeta para que todo cuadre (el botón «Resto» de su renglón). */
export function restoParaLaTarjeta(
  estado: CobroEnPantalla,
  indice: number,
  aCobrarCentavos: number,
): number {
  const otras = estado.tarjetas.reduce(
    (suma, texto, i) => (i === indice ? suma : suma + (aCentavos(texto) ?? 0)),
    0,
  );
  const transferencia = estado.modo === 'mixto' ? (aCentavos(estado.transferencia) ?? 0) : 0;
  return Math.max(0, aCobrarCentavos - otras - transferencia);
}
