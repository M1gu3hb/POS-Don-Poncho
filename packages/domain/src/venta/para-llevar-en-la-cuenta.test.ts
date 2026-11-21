import { describe, expect, it } from 'vitest';

import { MARCA_PARA_LLEVAR, esParaLlevar, notaParaLlevar } from './para-llevar-en-la-cuenta.ts';

describe('lo que va para llevar dentro de la cuenta de una mesa', () => {
  it('la marca va delante de la nota, y sola si no hay nota', () => {
    expect(notaParaLlevar(null)).toBe('PARA LLEVAR');
    expect(notaParaLlevar('   ')).toBe('PARA LLEVAR');
    expect(notaParaLlevar('sin cebolla')).toBe('PARA LLEVAR · sin cebolla');
    expect(MARCA_PARA_LLEVAR).toBe('PARA LLEVAR');
  });

  it('marcar dos veces no repite la marca', () => {
    expect(notaParaLlevar(notaParaLlevar('sin cebolla'))).toBe('PARA LLEVAR · sin cebolla');
    expect(notaParaLlevar('PARA LLEVAR')).toBe('PARA LLEVAR');
  });

  it('reconoce lo marcado y no confunde una nota que sólo lo menciona', () => {
    expect(esParaLlevar('PARA LLEVAR')).toBe(true);
    expect(esParaLlevar('  PARA LLEVAR · Prepárala: Michelado ')).toBe(true);
    expect(esParaLlevar('la salsa PARA LLEVAR')).toBe(false);
    expect(esParaLlevar('PARA LLEVARSE')).toBe(false);
    expect(esParaLlevar('para llevar')).toBe(false);
    expect(esParaLlevar(null)).toBe(false);
    expect(esParaLlevar(undefined)).toBe(false);
  });
});
