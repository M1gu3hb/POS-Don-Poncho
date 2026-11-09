import { LARGO_MINIMO_DEL_MOTIVO_DE_RETIRO } from '@morphiqpos/contracts';

/**
 * EL IMPORTE QUE SE TECLEA EN LA CAJA, y el retiro que sale de él.
 *
 * Vivía dentro de la caja de la tienda (`abarrotes/Caja.tsx`) y ahí sólo lo usaba ella. El
 * salón necesita el mismo retiro en su «Caja y corte» (D.1 de la 2.4), y dos copias de la
 * misma cuenta de dinero son dos cuentas que un día dicen cosas distintas: aquí está una.
 *
 * Centavos como TEXTO: el dinero no pasa por punto flotante en el navegador. La coma es
 * sólo de MILES —«1,500» es mil quinientos— y el punto es el decimal; un importe admite hasta siete
 * cifras de pesos, uno vacío es cero y uno mal escrito o ambiguo («1,5») es `null`.
 */

/**
 * Las dos formas que se entienden. Sin `Number` ni `parseFloat` de por medio:
 *  - llano: hasta siete cifras de pesos y, si acaso, un punto con uno o dos centavos;
 *  - con miles: grupos de TRES tras cada coma («1,500», «1,500.50», «1,234,567»).
 * La coma NUNCA es decimal: «1,5» puede ser mil quinientos tecleado a medias o uno con cincuenta
 * a la europea, y adivinar mal en una caja es dinero. Se rechaza y se dice cómo escribirlo.
 */
const IMPORTE_LLANO = /^\d{1,7}(?:\.\d{1,2})?$/;
const IMPORTE_CON_MILES = /^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/;
const SOLO_CIFRAS_Y_SEPARADORES = /^[\d.,]+$/;

export function aCentavos(texto: string): number | null {
  const limpio = texto.trim();
  if (limpio === '') return 0;
  const llano = limpio.replaceAll(',', '');
  const valido =
    IMPORTE_LLANO.test(limpio) || (IMPORTE_CON_MILES.test(limpio) && IMPORTE_LLANO.test(llano));
  if (!valido) return null;
  const [enteros = '0', decimales = ''] = llano.split('.');
  return Number(enteros) * 100 + Number(decimales.padEnd(2, '0'));
}

/**
 * Por qué no se entendió un importe, en palabras de caja. Los que traen coma mal puesta ameritan
 * la explicación; el resto (letras, signos, de más) sigue con el recordatorio de siempre.
 */
function tropiezoDelImporte(texto: string, recordatorio: string): string {
  const limpio = texto.trim();
  if (limpio.includes(',') && SOLO_CIFRAS_Y_SEPARADORES.test(limpio)) {
    return `No entiendo «${limpio}». Los miles van con coma y los centavos con punto: 1,500 son mil quinientos; 1,500.50 lleva centavos; 15.50 son quince con cincuenta.`;
  }
  return recordatorio;
}

/** Lo que viaja a `caja.movimiento` por un retiro. */
export interface RetiroAEnviar {
  readonly tipo: 'retiro';
  /** Negativo: sale del cajón. */
  readonly montoCentavos: number;
  readonly motivo: string;
}

/**
 * El retiro listo para mandarse, o por qué no se manda.
 *
 * Un retiro sin motivo es la única salida de dinero que puede esconder un faltante: no se
 * guarda sin explicación (el servidor pide cinco letras, las mismas, y aquí se dice antes).
 */
export function retiroParaEnviar(
  importe: string,
  motivo: string,
): { readonly cuerpo: RetiroAEnviar } | { readonly tropiezo: string } {
  const centavos = aCentavos(importe);
  if (centavos === null) return { tropiezo: tropiezoDelImporte(importe, 'Pon cuánto se retira.') };
  if (centavos === 0) return { tropiezo: 'Pon cuánto se retira.' };
  if (motivo.trim().length < LARGO_MINIMO_DEL_MOTIVO_DE_RETIRO) {
    return {
      tropiezo: `Escribe a dónde va ese dinero: al menos ${String(LARGO_MINIMO_DEL_MOTIVO_DE_RETIRO)} letras.`,
    };
  }
  return { cuerpo: { tipo: 'retiro', montoCentavos: -centavos, motivo: motivo.trim() } };
}

/** DP-15 · De dónde llega el cambio que entra al cajón (los de `caja.entrada_cambio`). */
export const ORIGENES_DEL_CAMBIO = [
  { valor: 'banco', etiqueta: 'Del banco' },
  { valor: 'caja_chica', etiqueta: 'De la caja chica' },
  { valor: 'dueno', etiqueta: 'Del dueño' },
  { valor: 'otra_caja', etiqueta: 'De la otra caja' },
] as const;

export type OrigenDelCambio = (typeof ORIGENES_DEL_CAMBIO)[number]['valor'];

/** Lo que viaja a `caja.entrada_cambio`: el importe completo como billetes chicos. */
export interface EntradaAEnviar {
  readonly chicosCentavos: number;
  readonly monedasCentavos: 0;
  readonly origen: OrigenDelCambio;
  readonly motivo: string | null;
}

/**
 * DP-15 · Una entrada de efectivo al cajón (cambio para empezar, o el que trae el dueño), con su
 * origen. Sin importe no se manda nada; el motivo es opcional (el servidor pone uno con el origen).
 */
export function entradaParaEnviar(
  importe: string,
  origen: OrigenDelCambio,
  motivo: string,
): { readonly cuerpo: EntradaAEnviar } | { readonly tropiezo: string } {
  const centavos = aCentavos(importe);
  if (centavos === null) {
    return { tropiezo: tropiezoDelImporte(importe, 'Pon cuánto entra al cajón.') };
  }
  if (centavos === 0) return { tropiezo: 'Pon cuánto entra al cajón.' };
  const nota = motivo.trim();
  return {
    cuerpo: {
      chicosCentavos: centavos,
      monedasCentavos: 0,
      origen,
      motivo: nota === '' ? null : nota,
    },
  };
}
