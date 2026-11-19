import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-22 · LOTE 8 · cuatro arreglos chicos, con su contrato de texto sobre el código real:
 *
 *  · DP-D195 · el mapa de mesas de Configuración se escala al ancho que hay (y guarda coordenadas LÓGICAS).
 *  · DP-D196 · la hoja del carrito del mesero (teléfono) se cierra sola al quedar vacío el carrito.
 *  · DP-D197 · el aviso «Solicitud enviada» del portal no se pinta encima de la hoja de la valoración.
 *  · DP-D198 · «Borrar todos los datos del sistema» no promete resetear la configuración.
 *
 * Lo que los recorre con el dedo está en `pruebas/e2e/qa-final/` (`ajustes-finales/tarjetas-personas.spec.ts`,
 * `flujos-sin-prueba.spec.ts`, `ajustes-finales/reiniciar.spec.ts`).
 */

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const leer = (...ruta: string[]): string =>
  readFileSync(join(RAIZ_WEB, ...ruta), 'utf8').replace(/\s+/g, ' ');

describe('DP-D195 · el mapa de mesas se escala y guarda coordenadas lógicas', () => {
  const mapa = leer('heredado', 'components', 'mesas', 'MesaMapEditor.jsx');

  it('mide el ancho disponible y reduce (nunca agranda) el lienzo', () => {
    expect(mapa).toContain('new ResizeObserver(medir)');
    expect(mapa).toContain('Math.min(1, anchoDisponible / anchoLogico)');
    expect(mapa).toContain('transform: escala < 1 ? `scale(${escala})` : undefined');
    expect(mapa).toContain('height: MAP_HEIGHT * escala');
  });

  it('el arrastre divide el movimiento entre la escala: lo guardado es la coordenada lógica', () => {
    expect(mapa).toContain('offsetX: (e.clientX - rect.left) / escala - startX');
    expect(mapa).toContain('offsetY: (e.clientY - rect.top) / escala - startY');
    expect(mapa).toContain('let x = (e.clientX - rect.left) / escala - st.offsetX;');
    expect(mapa).toContain('let y = (e.clientY - rect.top) / escala - st.offsetY;');
    expect(mapa).toContain('rect.width / escala - st.w');
    expect(mapa).toContain('rect.height / escala - st.h');
  });

  it('declara su escala para quien la mide', () => {
    expect(mapa).toContain('data-escala={escala}');
  });
});

describe('DP-D196 · la hoja del carrito se cierra al quedar vacío el carrito', () => {
  const hoja = leer('heredado', 'components', 'mesero', 'MeseroCartFAB.jsx');

  it('cierra sólo al PASAR de con piezas a vacío (no una hoja abierta a propósito con el carrito vacío)', () => {
    expect(hoja).toContain(
      'if (piezasDeAntes.current > 0 && piezasEnElCarrito === 0) setOpen(false);',
    );
    expect(hoja).toContain('piezasDeAntes.current = piezasEnElCarrito;');
    expect(hoja).toContain('}, [piezasEnElCarrito]);');
  });

  it('el efecto va antes del «return null» (los hooks no se saltan)', () => {
    expect(hoja.indexOf('piezasDeAntes.current > 0')).toBeLessThan(
      hoja.indexOf('if (!visible) return null;'),
    );
  });
});

describe('DP-D197 · el aviso del portal no tapa la hoja de la valoración', () => {
  const portal = leer('heredado', 'pages', 'PortalCliente.jsx');

  it('el aviso «Solicitud enviada» no se pinta mientras la valoración está abierta', () => {
    expect(portal).toContain('{enviado && !showValoracion && (');
    expect(portal).toContain('Solicitud enviada');
  });
});

describe('DP-D198 · «Borrar todos los datos» dice lo que hace', () => {
  const pantalla = leer('heredado', 'components', 'configuracion', 'ReiniciarSistemaSection.jsx');

  it('conserva la configuración y a la gente, y no promete resetearla', () => {
    expect(pantalla).toContain('Conserva la configuración del negocio');
    expect(pantalla).toContain(
      'La configuración del negocio, la gente y sus usuarios se conservan',
    );
    expect(pantalla).not.toContain('Resetea la configuración');
    expect(pantalla).not.toContain('reseteará la configuración');
  });
});
