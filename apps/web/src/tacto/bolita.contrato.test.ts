import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-25 · Parte 5 · LA BOLITA está conectada. La lógica tiene su prueba (`bolita.test.ts`) y el
 * gesto de verdad lo prueba `pruebas/e2e/qa-final/bolita-de-agregado.spec.ts`; esto comprueba los
 * cables, que son lo que se rompe en silencio:
 *  · la bolita sale DESPUÉS de la decisión del toque seguro y de la acción de agregar (deslizar no
 *    lanza bolitas y la animación nunca va antes del agregado);
 *  · cada lugar que agrega un platillo avisa con `SE_AGREGO`, y cada pedido visible es un destino.
 * Se valida mutando el código real (las mutaciones van en el mensaje del commit).
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');
const sinComentarios = (codigo: string): string =>
  codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\w'"`])\/\/[^\n]*/g, '$1');

describe('la bolita sale después del toque seguro', () => {
  const gancho = sinComentarios(leer('src/tacto/use-toque-seguro.ts'));
  const decision = gancho.indexOf('if (!decision.agrega) return;');
  const punto = gancho.indexOf('puntoDeLaFicha(');
  const accion = gancho.indexOf('accion.current()');
  const bolita = gancho.indexOf('bolitaSiSeAgrego(');

  it('el gancho la lanza con lo que devolvió la acción', () => {
    expect(decision).toBeGreaterThan(-1);
    expect(accion).toBeGreaterThan(decision);
    expect(bolita).toBeGreaterThan(accion);
  });

  it('anota el punto de la ficha antes de ejecutar la acción (puede desmontar el botón)', () => {
    expect(punto).toBeGreaterThan(decision);
    expect(punto).toBeLessThan(accion);
  });

  it('el candado se pone sin esperar a la bolita', () => {
    expect(gancho.slice(bolita)).toMatch(/liberarAlTerminar\(/);
  });
});

describe('quien agrega avisa con SE_AGREGO', () => {
  const avisan: readonly (readonly [string, string])[] = [
    ['el mesero (teléfono y tableta)', 'heredado/pages/Mesero.jsx'],
    ['el pedido para llevar', 'heredado/components/pedido/useArmadoDelPedido.js'],
    ['el mostrador', 'heredado/pages/POS.jsx'],
    ['el portal del comensal', 'heredado/pages/PortalCliente.jsx'],
  ];
  for (const [quien, ruta] of avisan) {
    it(`${quien} devuelve SE_AGREGO al agregar`, () => {
      const codigo = sinComentarios(leer(ruta));
      expect(codigo).toMatch(/import \{ SE_AGREGO \} from '~\/tacto\/bolita'/);
      expect(codigo).toMatch(/return SE_AGREGO;/);
    });
  }

  it('el diálogo del comensal devuelve lo que devolvió el agregado', () => {
    const codigo = sinComentarios(leer('heredado/components/portalqr/ProductoQRDialog.jsx'));
    expect(codigo.match(/return onConfirm\?\.\(\{/g)).toHaveLength(2);
  });
});

describe('cada pedido visible es un destino', () => {
  const destinos: readonly (readonly [string, string])[] = [
    ['el botón flotante del mesero', 'heredado/components/mesero/MeseroCartFAB.jsx'],
    ['el panel del pedido de la tableta', 'heredado/pages/Mesero.jsx'],
    ['el panel del pedido de la mesa activa', 'heredado/components/mesero/MesaActivaView.jsx'],
    ['el pedido para llevar', 'heredado/components/caja/ParaLlevarDialog.jsx'],
    ['el panel de la orden del mostrador', 'heredado/components/pos/CartPanel.jsx'],
    ['el botón de la orden del mostrador', 'heredado/pages/POS.jsx'],
    ['el carrito del comensal', 'src/portal/carrito-compartido/CarritoDeLaMesa.tsx'],
  ];
  for (const [cual, ruta] of destinos) {
    it(`${cual} lleva data-destino-bolita`, () => {
      expect(leer(ruta)).toContain('data-destino-bolita=""');
    });
  }

  it('lo que rebota está en el botón flotante y en el carrito del comensal', () => {
    expect(leer('heredado/components/mesero/MeseroCartFAB.jsx')).toContain('data-bolita-numero=""');
    expect(leer('src/portal/carrito-compartido/CarritoDeLaMesa.tsx')).toContain(
      'data-bolita-numero=""',
    );
  });
});

describe('la capa de la bolita no reacomoda la página', () => {
  const dom = leer('src/tacto/bolita-dom.ts');
  it('va fija, sin eventos, y sólo se animan transform y opacity', () => {
    expect(dom).toContain("s.position = 'fixed'");
    expect(dom).toContain("s.pointerEvents = 'none'");
    const animaciones = dom.match(/\.animate\(([\s\S]*?)\{ duration/g) ?? [];
    expect(animaciones.length).toBeGreaterThan(0);
    for (const a of animaciones) {
      expect(a).not.toMatch(/\b(left|top|width|height|margin|padding)\s*:/);
    }
  });
});
