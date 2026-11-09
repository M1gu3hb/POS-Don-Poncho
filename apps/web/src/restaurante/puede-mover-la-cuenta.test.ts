import { describe, expect, it } from 'vitest';

import { puedeMoverLaCuenta, textoDelEnlaceParaMoverLaCuenta } from './puede-mover-la-cuenta.ts';

/**
 * DP-15.1 · Quién ve el enlace «Cambiar de mesa» en el panel de la mesa del mapa.
 *
 * Dirección, siempre. El MESERO, sólo en las mesas que él atiende: el servidor (`cambio-de-mesa.ts`)
 * deja al mesero mover una cuenta —no hace desaparecer dinero—, pero «sus mesas» es la regla de la
 * pantalla: no se ofrece mover la cuenta de otro mesero. Quien aún no se sabe quién es, nadie.
 */
describe('quién puede mover la cuenta desde el mapa', () => {
  it.each(['dueno', 'administrador', 'gerente'])('%s, en cualquier mesa', (puesto) => {
    expect(puedeMoverLaCuenta({ puesto, yoId: 'u1', atiendeId: 'u2' })).toBe(true);
    expect(puedeMoverLaCuenta({ puesto, yoId: 'u1', atiendeId: null })).toBe(true);
  });

  it('el mesero, en la mesa que él atiende', () => {
    expect(puedeMoverLaCuenta({ puesto: 'mesero', yoId: 'u1', atiendeId: 'u1' })).toBe(true);
  });

  it('el mesero NO en la de otro, ni en una que nadie atiende, ni sin saber quién es', () => {
    expect(puedeMoverLaCuenta({ puesto: 'mesero', yoId: 'u1', atiendeId: 'u2' })).toBe(false);
    expect(puedeMoverLaCuenta({ puesto: 'mesero', yoId: 'u1', atiendeId: null })).toBe(false);
    expect(puedeMoverLaCuenta({ puesto: 'mesero', yoId: null, atiendeId: null })).toBe(false);
    expect(puedeMoverLaCuenta({ puesto: 'mesero', yoId: undefined, atiendeId: undefined })).toBe(
      false,
    );
  });

  it.each(['cajero', 'cocina', 'almacen', null])('%s, nunca', (puesto) => {
    expect(puedeMoverLaCuenta({ puesto, yoId: 'u1', atiendeId: 'u1' })).toBe(false);
  });

  it('al mesero el enlace le dice sólo «Cambiar de mesa»: unir y dividir no son suyos desde ahí', () => {
    expect(textoDelEnlaceParaMoverLaCuenta('mesero')).toBe('Cambiar de mesa');
    expect(textoDelEnlaceParaMoverLaCuenta('gerente')).toBe('Cambiar de mesa, unir o dividir');
  });
});
