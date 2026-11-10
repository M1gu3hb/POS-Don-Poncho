import { describe, expect, it } from 'vitest';

import { grupoDelCanal, NOMBRE_DEL_CANAL, referenciaParaLlevar, sumaPorGrupo } from './canales';

describe('DP-16 · mesas y para llevar por separado', () => {
  it('sólo `llevar` es para llevar; lo demás cuenta como mesas', () => {
    expect(grupoDelCanal('llevar')).toBe('llevar');
    expect(grupoDelCanal('aqui')).toBe('mesas');
    expect(grupoDelCanal(null)).toBe('mesas');
  });

  it('suma cuentas e importe de cada grupo, al centavo', () => {
    const suma = sumaPorGrupo([
      { canal: 'aqui', totalCentavos: '39750' },
      { canal: 'llevar', totalCentavos: '19875' },
      { canal: 'llevar', totalCentavos: '125' },
      { canal: 'aqui', totalCentavos: '5555' },
    ]);
    expect(suma.mesas).toEqual({ cuentas: 2, totalCentavos: 45_305n });
    expect(suma.llevar).toEqual({ cuentas: 2, totalCentavos: 20_000n });
  });

  it('«En taza» ya no existe: el canal `aqui` se dice «Aquí»', () => {
    expect(NOMBRE_DEL_CANAL['aqui']).toBe('Aquí');
    expect(Object.values(NOMBRE_DEL_CANAL)).not.toContain('En taza');
  });

  it('la referencia del pedido para llevar lleva su número y su nombre', () => {
    expect(referenciaParaLlevar(3, 'Don Beto')).toBe('Llevar 3 · Don Beto');
    expect(referenciaParaLlevar(null, '')).toBe('Llevar');
  });
});
