import { describe, expect, it } from 'vitest';

import { hayCambios, leidoDe, parcheDeLaSeccion } from './parche-de-la-seccion.ts';

describe('el parche de una sección de Configuración', () => {
  const leido = { portal_qr_modo_menu: 'menu_subido', portal_qr_activo: true, propinas: '5,10' };

  it('manda sólo lo que cambió, aunque el formulario traiga más campos', () => {
    const parche = parcheDeLaSeccion({ ...leido, portal_qr_modo_menu: 'productos_pos' }, leido);
    expect(parche).toEqual({ portal_qr_modo_menu: 'productos_pos' });
  });

  it('un campo que no se tocó no viaja: no pisa lo que otro aparato cambió mientras tanto', () => {
    // Otro aparato apagó el portal; aquí sólo se cambió el modo, con el portal «encendido» de lo leído.
    const parche = parcheDeLaSeccion({ ...leido, portal_qr_modo_menu: 'digital' }, leido);
    expect(parche).not.toHaveProperty('portal_qr_activo');
  });

  it('compara por valor: falso, cero y vacío también son cambios; una lista igual no', () => {
    expect(parcheDeLaSeccion({ a: false, b: 0, c: '' }, { a: true, b: 1, c: 'x' })).toEqual({
      a: false,
      b: 0,
      c: '',
    });
    expect(parcheDeLaSeccion({ lista: ['kg', 'g'] }, { lista: ['kg', 'g'] })).toEqual({});
    expect(parcheDeLaSeccion({ nuevo: 'x' }, {})).toEqual({ nuevo: 'x' });
  });

  it('sin cambios no hay nada que mandar', () => {
    expect(hayCambios(parcheDeLaSeccion(leido, leido))).toBe(false);
    expect(hayCambios({ a: 1 })).toBe(true);
  });

  it('se compara contra lo GUARDADO: lo que nunca se guardó viaja con el valor del formulario', () => {
    // La base no tiene la asignación de mesas; el formulario la enseña apagada (su valor por omisión).
    const leido = leidoDe({ portal_qr_activo: true, otra: 'x' }, [
      'portal_qr_activo',
      'asignacion_mesas_activa',
    ]);
    expect(leido).toEqual({ portal_qr_activo: true, asignacion_mesas_activa: undefined });
    expect(
      parcheDeLaSeccion({ portal_qr_activo: true, asignacion_mesas_activa: false }, leido),
    ).toEqual({
      asignacion_mesas_activa: false,
    });
    expect(leidoDe(null, ['a'])).toEqual({ a: undefined });
  });
});
