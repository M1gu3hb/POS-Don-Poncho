import { describe, expect, it } from 'vitest';

import { fraseDeLaComandaDeEjemplo } from './comanda-de-ejemplo';

describe('«Así se oye una comanda» (Configuración → Sonidos)', () => {
  it('el ejemplo junta los renglones, dice las cantidades, la opción y el peso', () => {
    expect(fraseDeLaComandaDeEjemplo()).toBe(
      'Nuevo pedido mesa 4: tres Consomés de carnero; dos Mixiotes, Sin picante; medio kilo de Barbacoa de horno.',
    );
  });
});
