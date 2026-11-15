import { guardarArnes } from './empaquetar.ts';

/**
 * Antes de las pruebas del ticket: empaqueta el arnés UNA vez (tarda unos segundos; hacerlo en
 * cada trabajador los ponía a todos a empaquetar lo mismo a la vez).
 */
export default async function preparar(): Promise<void> {
  await guardarArnes();
}
