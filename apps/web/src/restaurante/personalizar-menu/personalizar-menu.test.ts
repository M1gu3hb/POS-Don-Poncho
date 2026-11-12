import { describe, expect, it } from 'vitest';

import {
  conLaEdicion,
  enSuOrden,
  LARGO_MAXIMO_DE_LA_DESCRIPCION,
  moverSeccion,
  ordenQueCambio,
  parcheDelPlatillo,
  problemaDeLaDescripcion,
} from './personalizar-menu.ts';

/** DP-18 · 1.3 · «Personalizar menú»: lo que se guarda y lo que se ve (sin pantalla). */
describe('personalizar el menú digital', () => {
  const taco = {
    id: 't',
    descripcion: 'De suadero',
    imagen_url: null,
    fondo_tarjeta: 'color:barro',
  };

  it('el parche del platillo lleva sólo lo que cambió (y lo vacío vuelve nulo)', () => {
    expect(parcheDelPlatillo(taco, { descripcion: 'De suadero' })).toEqual({});
    expect(parcheDelPlatillo(taco, { descripcion: '  De suadero con todo ' })).toEqual({
      descripcion: 'De suadero con todo',
    });
    expect(
      parcheDelPlatillo(taco, { descripcion: '   ', fondo_tarjeta: 'ilustracion:talavera' }),
    ).toEqual({
      descripcion: null,
      fondo_tarjeta: 'ilustracion:talavera',
    });
    expect(parcheDelPlatillo(taco, { imagen_url: '/api/archivos/x.jpg' })).toEqual({
      imagen_url: '/api/archivos/x.jpg',
    });
  });

  it('la descripción corta tiene tope', () => {
    expect(problemaDeLaDescripcion('x'.repeat(LARGO_MAXIMO_DE_LA_DESCRIPCION))).toBeNull();
    expect(problemaDeLaDescripcion('x'.repeat(LARGO_MAXIMO_DE_LA_DESCRIPCION + 1))).toMatch(
      /como máximo/,
    );
    expect(problemaDeLaDescripcion(null)).toBeNull();
  });

  it('la vista previa pinta lo que se está editando encima de lo guardado', () => {
    expect(conLaEdicion(taco, { descripcion: 'Nueva' }).descripcion).toBe('Nueva');
    expect(conLaEdicion(taco, undefined)).toBe(taco);
    expect(conLaEdicion(taco, { fondo_tarjeta: '' }).fondo_tarjeta).toBeNull();
  });

  it('las secciones se ordenan, se mueven un lugar y sólo se guarda lo que cambió de lugar', () => {
    const guardadas = [
      { id: 'c', orden: 3 },
      { id: 'a', orden: 1 },
      { id: 'b', orden: 2 },
    ];
    const ordenadas = enSuOrden(guardadas);
    expect(ordenadas.map((s) => s.id)).toEqual(['a', 'b', 'c']);
    const movidas = moverSeccion(ordenadas, 'c', 'arriba');
    expect(movidas.map((s) => s.id)).toEqual(['a', 'c', 'b']);
    expect(moverSeccion(ordenadas, 'a', 'arriba').map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(ordenQueCambio(guardadas, movidas)).toEqual([
      { id: 'c', orden: 2 },
      { id: 'b', orden: 3 },
    ]);
    // Si todas venían en 0 (sin orden), se numeran todas.
    expect(
      ordenQueCambio(
        [
          { id: 'x', orden: 0 },
          { id: 'y', orden: 0 },
        ],
        [{ id: 'x' }, { id: 'y' }],
      ),
    ).toHaveLength(2);
  });
});
