import { describe, expect, it } from 'vitest';

import { grupoNuevo, type GrupoEditable } from './editor-de-grupos.ts';
import { pisoDelPlatillo, problemaDePrecio } from './piso-del-platillo.ts';

const grupo = (
  opciones: readonly [string, string][],
  cambios: Partial<GrupoEditable> = {},
): GrupoEditable => ({
  ...grupoNuevo(),
  nombre: 'Proteína',
  obligatorio: true,
  opciones: opciones.map(([nombre, precio], i) => ({
    clave: String(i),
    nombre,
    precio,
    activa: true,
  })),
  ...cambios,
});

describe('DP-18 · M6 · el editor no deja guardar una opción que deja el platillo en $0', () => {
  it('el piso: la pieza, la porción, o el peso más chico que se vende', () => {
    expect(pisoDelPlatillo({ precio_venta: 25 })).toBe(2_500n);
    expect(pisoDelPlatillo({ tipo_venta: 'porcion_contenedor', precio_por_porcion: 90 })).toBe(
      9_000n,
    );
    expect(
      pisoDelPlatillo({
        tipo_venta: 'variable_medida',
        precio_por_unidad_variable: 795,
        presets_variable_qr: [0.25, 0.5, 1],
        solo_presets_variable: true,
      }),
    ).toBe(19_875n);
    expect(
      pisoDelPlatillo({ tipo_venta: 'variable_medida', precio_por_unidad_variable: 795 }),
    ).toBeNull();
  });

  it('avisa con el nombre del platillo cuando una opción lo deja en $0 o menos', () => {
    expect(
      problemaDePrecio({ nombre: 'Taco', precio_venta: 25 }, [
        grupo([
          ['Res', ''],
          ['Sin carne', '-25'],
        ]),
      ]),
    ).toMatch(/«Taco» podría quedar en \$0\.00/);
    expect(
      problemaDePrecio({ nombre: 'Taco', precio_venta: 25 }, [
        grupo([
          ['Res', ''],
          ['Sin cebolla', '-5'],
        ]),
      ]),
    ).toBeNull();
    // Un grupo apagado no cuenta.
    expect(
      problemaDePrecio({ nombre: 'Taco', precio_venta: 25 }, [
        grupo([['Sin carne', '-30']], { activo: false }),
      ]),
    ).toBeNull();
  });
});
