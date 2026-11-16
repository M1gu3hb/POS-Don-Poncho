import { describe, expect, it } from 'vitest';

import { textoDeLaEleccion } from './barra-lateral-del-aparato.ts';

describe('la tarjeta «Barra lateral»', () => {
  it('dice lo que este aparato recuerda, o que decide solo', () => {
    expect(textoDeLaEleccion('abierta')).toMatch(/empieza abierta/);
    expect(textoDeLaEleccion('plegada')).toMatch(/empieza plegada/);
    expect(textoDeLaEleccion(null)).toMatch(/decide solo/);
  });
});
