import { NEGOCIOS_AJENOS } from '@morphiqpos/contracts/negocios';
import { describe, expect, it } from 'vitest';

import { prepararPrimerAcceso } from './primer-acceso.ts';

/**
 * `db:bootstrap` sobre un negocio ajeno crearía un dueño o le rotaría el PIN al que hay
 * (bloque B.4 de la 2.4). La función se niega ANTES de calcular el hash y de abrir una
 * transacción: sin base, esto sólo puede pasar si la negativa va primero. Sin la
 * guarda, falla por otra cosa —la transacción contra una base que no existe—.
 *
 * Don Poncho NO está aquí a propósito (DP-2): su primer acceso sí procede, una sola vez.
 * Lo cuida `exigirPrimerAcceso`, que se niega si ya tiene un dueño activo con PIN; eso lo
 * prueba la integración, que tiene base.
 */
describe('prepararPrimerAcceso · la guarda', () => {
  it.each(NEGOCIOS_AJENOS.map((n) => [n.slug] as const))('se niega sobre «%s»', async (slug) => {
    await expect(
      prepararPrimerAcceso({
        organizacionSlug: slug,
        nombrePersona: 'Quien sea',
        pin: '4821',
        pimienta: 'una-pimienta-de-prueba-larga',
      }),
    ).rejects.toThrow(/negocio AJENO/);
  });
});
