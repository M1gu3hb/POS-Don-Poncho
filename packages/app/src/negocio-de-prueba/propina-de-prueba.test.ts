import { describe, expect, it } from 'vitest';

import { QUIEN_ELIGE_POR_OMISION, quienPuedeElegirEn } from '../propinas/una-sola-verdad.ts';
import { PROPINA_DE_PRUEBA } from './como-nueva.ts';

/**
 * DP-21 · Bloque 4 · El restaurante de prueba enciende la casilla del mesero; un negocio nuevo, no.
 *
 * Las suites del día completo piden la cuenta con la mesera preguntando la propina. Con lo de
 * omisión (comensales y Caja) ese diálogo no existe: si alguien quita esta semilla, esas suites
 * fallan en la CI veinte minutos después y por algo que no dicen.
 */
describe('quién elige la propina en el restaurante de prueba', () => {
  it('por omisión, un negocio: comensales y Caja, sin mesero', () => {
    expect(quienPuedeElegirEn({})).toEqual(QUIEN_ELIGE_POR_OMISION);
    expect(QUIEN_ELIGE_POR_OMISION.mesero).toBe(false);
  });

  it('el restaurante de prueba: los tres', () => {
    expect(quienPuedeElegirEn({ ...PROPINA_DE_PRUEBA })).toEqual({
      comensales: true,
      mesero: true,
      caja: true,
    });
  });
});
