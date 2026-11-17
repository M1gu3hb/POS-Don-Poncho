import { describe, expect, it } from 'vitest';

import { nombresDichos, RUTA_DEL_AVISO, textoDelAviso } from './aviso-de-insumos-bajos.ts';

const insumo = (nombre: string) => ({ nombre, agotado: false });

describe('textoDelAviso', () => {
  it('sin insumos bajos no hay tarjeta', () => {
    expect(textoDelAviso({ total: 0, primeros: [] })).toBeNull();
  });

  it('uno: en singular', () => {
    expect(textoDelAviso({ total: 1, primeros: [insumo('Carne')] })).toEqual({
      titulo: '1 insumo por debajo de su mínimo',
      nombres: 'Carne',
      ayuda: 'Toca para verlos en Inventario.',
    });
  });

  it('varios: la cuenta es la del servidor, no la de los nombres que llegan', () => {
    const texto = textoDelAviso({
      total: 1300,
      primeros: [insumo('Carne'), insumo('Crema'), insumo('Pan')],
    });
    expect(texto?.titulo).toBe('1300 insumos por debajo de su mínimo');
    expect(texto?.nombres).toBe('Carne, Crema, Pan y 1297 más');
  });

  it('el toque lleva a Inventario ya filtrado', () => {
    expect(RUTA_DEL_AVISO).toBe('/inventario?estado=alerta');
  });
});

describe('nombresDichos', () => {
  it('dos y tres nombres se unen con «y» sin «más» si no hay más', () => {
    expect(nombresDichos([insumo('Carne'), insumo('Pan')], 2)).toBe('Carne y Pan');
    expect(nombresDichos([insumo('Carne'), insumo('Pan'), insumo('Sal')], 3)).toBe(
      'Carne, Pan y Sal',
    );
  });

  it('sin nombres, vacío', () => {
    expect(nombresDichos([], 0)).toBe('');
  });
});
