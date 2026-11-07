import { describe, expect, it } from 'vitest';

import { sePuedeMarcarLibre, tieneVentaPorCobrar } from './mesas-pendientes-del-cierre';

describe('qué mesas se sueltan desde el cierre del día', () => {
  it('en limpieza sí, aunque conserve el id de su cuenta cobrada', () => {
    const mesa = { id: 'm', estado: 'limpieza', venta_activa_id: 'v' };
    expect(sePuedeMarcarLibre(mesa)).toBe(true);
    expect(tieneVentaPorCobrar(mesa)).toBe(false);
  });

  it('ocupada sin cuenta (huérfana) sí', () => {
    expect(sePuedeMarcarLibre({ id: 'm', estado: 'ocupada', venta_activa_id: null })).toBe(true);
  });

  it('con una cuenta por cobrar no: se cobra o se cancela, no se marca libre', () => {
    const mesa = { id: 'm', estado: 'cuenta_solicitada', venta_activa_id: 'v' };
    expect(sePuedeMarcarLibre(mesa)).toBe(false);
    expect(tieneVentaPorCobrar(mesa)).toBe(true);
  });

  it('una mesa libre no necesita nada', () => {
    expect(sePuedeMarcarLibre({ id: 'm', estado: 'libre' })).toBe(false);
  });
});
