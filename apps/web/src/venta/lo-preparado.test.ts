import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  avisoDePerdidaAlCancelar,
  type DetalleDeLaCuenta,
} from '../restaurante/cancelar-del-mesero.ts';
import { LO_PREPARADO_NO_REGRESA } from './lo-preparado.ts';

/**
 * DP-22 · LA PANTALLA DICE QUE LO PREPARADO NO REGRESA AL INVENTARIO.
 *
 * Es la regla del negocio y la que cumple el servidor (`lo-preparado-no-regresa.integracion.test.ts`):
 * lo que la cocina ya preparó no vuelve al anaquel —al cancelar sale como merma, al devolver una venta
 * no se repone—, y lo que no se preparó no se gastó. La persona que cancela o devuelve lo lee antes
 * de confirmar, con esas palabras.
 */

const leer = (ruta: string) => readFileSync(fileURLToPath(new URL(ruta, import.meta.url)), 'utf8');

const ARRACHERA: DetalleDeLaCuenta = {
  id: 'l-2',
  producto_nombre: 'Arrachera',
  cantidad: '2.0000',
};

describe('la línea clara', () => {
  it('es la frase del negocio, sin tecnicismos', () => {
    expect(LO_PREPARADO_NO_REGRESA).toBe('Lo que ya se preparó no regresa al inventario.');
  });
});

describe('cancelar la cuenta', () => {
  it('con algo preparado el aviso lo dice, junto a la pérdida', () => {
    const aviso = avisoDePerdidaAlCancelar([ARRACHERA], new Set(['Arrachera']));
    expect(aviso).toContain(LO_PREPARADO_NO_REGRESA);
    expect(aviso).toMatch(/pérdida/);
  });

  it('sin nada preparado no se dice nada (no hay nada que no regrese)', () => {
    expect(avisoDePerdidaAlCancelar([ARRACHERA], new Set())).toBeNull();
  });
});

describe('devolver una venta', () => {
  it('la pantalla muestra la línea junto a «La mercancía regresa al anaquel»', () => {
    const pantalla = leer('./DevolucionDeVenta.tsx');
    expect(pantalla).toContain('LO_PREPARADO_NO_REGRESA');
    expect(pantalla).toContain("from './lo-preparado.ts'");
    // Va justo después de la casilla, no en otra parte de la pantalla.
    const casilla = pantalla.indexOf('La mercancía regresa al anaquel');
    const linea = pantalla.indexOf('{LO_PREPARADO_NO_REGRESA}');
    expect(casilla).toBeGreaterThan(-1);
    expect(linea).toBeGreaterThan(casilla);
    expect(linea - casilla).toBeLessThan(400);
  });
});
