import { describe, expect, it } from 'vitest';

import {
  detallesDeEjemplo,
  FOLIO_DE_EJEMPLO,
  RENGLONES_DEL_TICKET_CORTO,
  RENGLONES_DEL_TICKET_LARGO,
  ventaDeEjemplo,
} from './datos-de-ejemplo.ts';

describe('DP-20 · el ticket de ejemplo', () => {
  it('dice EJEMPLO en el folio y no pretende ser una venta', () => {
    const venta = ventaDeEjemplo(detallesDeEjemplo(RENGLONES_DEL_TICKET_CORTO));
    expect(venta.folio).toBe('EJEMPLO');
    expect(FOLIO_DE_EJEMPLO).toBe('EJEMPLO');
    expect(venta.cliente_nombre).toContain('ejemplo');
  });

  it('trae acentos, ñ y la fracción', () => {
    const texto = detallesDeEjemplo(RENGLONES_DEL_TICKET_CORTO)
      .map((d) => `${d.producto_nombre} ${d.notas_producto ?? ''}`)
      .join(' ');
    expect(texto).toContain('Barbacoa de borrego ½ kg');
    expect(texto).toContain('Consomé con garbanzo');
    expect(texto).toContain('Agua de piña');
    expect(texto).toMatch(/limón/);
  });

  it('trae una nota larga y una opción con precio', () => {
    const detalles = detallesDeEjemplo(RENGLONES_DEL_TICKET_CORTO);
    expect(detalles.some((d) => (d.notas_producto ?? '').length > 60)).toBe(true);
    const opcion = detalles
      .flatMap((d) => d.opciones_snapshot ?? [])
      .at(0)
      ?.opciones.at(0);
    expect(opcion).toEqual({ nombre: 'Queso extra', precioCentavos: 1500 });
  });

  it('el total es la suma exacta de los renglones, al centavo', () => {
    for (const cuantos of [1, 6, 7, RENGLONES_DEL_TICKET_LARGO]) {
      const detalles = detallesDeEjemplo(cuantos);
      const venta = ventaDeEjemplo(detalles);
      const centavos = detalles.reduce((s, d) => s + Math.round(d.subtotal * 100), 0);
      expect(Math.round(venta.total * 100)).toBe(centavos);
      expect(venta.subtotal).toBe(venta.total);
    }
  });

  it('el ticket largo tiene 40 renglones y repite los de ejemplo', () => {
    const largo = detallesDeEjemplo(RENGLONES_DEL_TICKET_LARGO);
    expect(largo).toHaveLength(40);
    expect(largo[6]?.producto_nombre).toBe(largo[0]?.producto_nombre);
  });

  it('es fijo: dos veces da lo mismo', () => {
    expect(detallesDeEjemplo(10)).toEqual(detallesDeEjemplo(10));
    expect(ventaDeEjemplo(detallesDeEjemplo(10))).toEqual(ventaDeEjemplo(detallesDeEjemplo(10)));
  });

  it('pedir cero o menos renglones da una lista vacía', () => {
    expect(detallesDeEjemplo(0)).toEqual([]);
    expect(detallesDeEjemplo(-3)).toEqual([]);
  });
});
