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

  it('el efecto que observa el marco lo deja de observar al desmontarse (limpieza con disconnect)', () => {
    // Se recorta el efecto: un «disconnect» suelto en otro lado del archivo no lo salva.
    const inicio = mapa.indexOf('const marco = marcoRef.current;');
    const fin = mapa.indexOf('}, []);', inicio);
    expect(inicio).toBeGreaterThan(-1);
    expect(fin).toBeGreaterThan(inicio);
    const efecto = mapa.slice(inicio, fin);
    expect(efecto).toContain('observador.observe(marco);');
    expect(efecto).toContain('return () => observador.disconnect();');
    expect(efecto.indexOf('observador.observe(marco);')).toBeLessThan(
      efecto.indexOf('return () => observador.disconnect();'),
    );
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
  // Lo que el comando hace (`packages/app/src/mantenimiento/comandos.ts`, `reiniciarTodo`): borra el catálogo
  // (zonas incluidas) y lo transaccional, vuelve a sembrar las 5 zonas de fábrica, y NO toca las estaciones de cocina,
  // la configuración ni a la gente.
  const recorta = (desde: string, hasta: string): string => {
    const inicio = pantalla.indexOf(desde);
    expect(inicio, `no está «${desde}»`).toBeGreaterThan(-1);
    const fin = pantalla.indexOf(hasta, inicio);
    expect(fin, `no se cierra «${desde}»`).toBeGreaterThan(inicio);
    return pantalla.slice(inicio, fin);
  };
  // La tarjeta de «Borrar todos los datos del sistema» y el aviso de su diálogo (rama 'all', la primera).
  const tarjeta = recorta('Elimina ventas, cortes', '</p>');
  const dialogo = recorta('Esta acción eliminará', '<strong>No se puede deshacer.</strong>');

  it.each([
    ['la tarjeta', () => tarjeta],
    ['el diálogo', () => dialogo],
  ])('%s: las zonas vuelven a las de fábrica y las propias se pierden', (_nombre, texto) => {
    expect(texto()).toMatch(/zonas vuelven a las de fábrica/);
    expect(texto()).toMatch(/(las que hayas creado se pierden)/);
  });

  it.each([
    ['la tarjeta', () => tarjeta],
    ['el diálogo', () => dialogo],
  ])('%s: conserva la configuración, la gente y las estaciones de cocina', (_nombre, texto) => {
    expect(texto()).toContain('configuración del negocio');
    expect(texto()).toContain('gente');
    expect(texto()).toContain('estaciones de cocina');
  });

  it.each([
    ['la tarjeta', () => tarjeta],
    ['el diálogo', () => dialogo],
  ])(
    '%s: NO dice que las zonas se conservan, ni promete resetear la configuración',
    (_nombre, texto) => {
      // «conserva … zonas» dentro de una misma frase, o «las zonas se conservan».
      expect(texto()).not.toMatch(/conserva[^.]*zonas/i);
      expect(texto()).not.toMatch(/zonas[^.]*se conservan/i);
      expect(texto()).not.toContain('Resetea la configuración');
      expect(texto()).not.toContain('reseteará la configuración');
    },
  );
});
