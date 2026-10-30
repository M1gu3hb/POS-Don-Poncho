import { navegacionDePlantilla, PLANTILLAS } from '@morphiqpos/contracts';
import { ShoppingBag, Tag } from 'lucide-react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { ICONOS_DEL_DOCK, iconoDeLaSeccion } from './iconos-del-dock';

/**
 * DP-11.4 · LOS ÍCONOS DEL DOCK. El menú manda el ícono de cada sección por su NOMBRE: las
 * entradas de cada plantilla (`navegacionDePlantilla`) y, en el restaurante, las de `NAV_ITEMS`
 * de heredado. Uno que el dock no conozca se pinta con la etiqueta (`Tag`): «Compras» salía así.
 */

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');

/** Los `icon: '…'` de `NAV_ITEMS`. Heredado no se importa desde vitest: se lee su texto. */
function iconosDeHeredado(): readonly string[] {
  const texto = readFileSync(join(RAIZ_WEB, 'heredado', 'lib', 'permissions.js'), 'utf8');
  return [...texto.matchAll(/\bicon: '(\w+)'/g)].map((m) => m[1] ?? '');
}

describe('los íconos del dock', () => {
  it('conoce cada ícono que el menú de cualquier plantilla puede mandar', () => {
    const declarados = new Set(
      PLANTILLAS.flatMap((plantilla) => navegacionDePlantilla(plantilla).map((e) => e.icono)),
    );
    const faltan = [...declarados].filter((nombre) => !(nombre in ICONOS_DEL_DOCK));
    expect(faltan).toEqual([]);
  });

  it('conoce cada ícono de las secciones de heredado (NAV_ITEMS)', () => {
    const declarados = iconosDeHeredado();
    expect(declarados.length).toBeGreaterThan(5);
    const faltan = declarados.filter((nombre) => !(nombre in ICONOS_DEL_DOCK));
    expect(faltan).toEqual([]);
  });

  it('Compras lleva su bolsa, y un nombre desconocido cae en la etiqueta', () => {
    expect(iconoDeLaSeccion('ShoppingBag')).toBe(ShoppingBag);
    expect(iconoDeLaSeccion('NoEsUnIcono')).toBe(Tag);
  });
});
