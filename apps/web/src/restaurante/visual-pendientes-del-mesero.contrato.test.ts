import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-22 (hallazgos 34, 35 y 38) · LO QUE EL MESERO VE EN LA HOJA DEL PEDIDO DEL TELÉFONO.
 *
 *  · 34 · La barra flotante «Solicitar cuenta» tapaba la parte baja de la primera tarjeta del
 *    resultado cuando el teclado estaba abierto al buscar: se esconde mientras un campo tiene el foco.
 *  · 38 · Con la cuenta ya pedida la barra desaparecía y el mesero se quedaba sin «Cambiar de mesa»:
 *    `restaurante.cambiar_mesa` acepta la cuenta en `cuenta_solicitada` (`CUENTAS_VIVAS`), así que la
 *    barra se queda y su hoja lo ofrece con la MISMA regla (`puedeMoverLaCuenta`).
 *  · 35 · Con la cuenta ya pedida, la mesa trae «Imprimir otra hoja de la precuenta» (a la pantalla
 *    Precuenta, que reimprime y marca la copia), y esa pantalla dice cómo se obtiene el total.
 *
 * Contratos de texto sobre el código real: la prueba que los recorre con el dedo está en
 * `pruebas/e2e/qa-final/visual-pendientes.spec.ts`.
 */

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const leer = (...ruta: string[]): string =>
  readFileSync(join(RAIZ_WEB, ...ruta), 'utf8').replace(/\s+/g, ' ');

describe('DP-22 · la hoja del pedido del mesero en el teléfono', () => {
  const hoja = leer('heredado', 'components', 'mesero', 'MeseroCartFAB.jsx');
  const pagina = leer('heredado', 'pages', 'Mesero.jsx');

  it('34 · la barra flotante se esconde mientras un campo de texto tiene el foco', () => {
    // Al soltar el foco la barra VUELVE: un oyente de salida que no limpia la dejaría escondida.
    expect(hoja).toContain('const alSalir = () => setEscribiendo(false);');
    expect(hoja).toContain("document.addEventListener('focusin'");
    expect(hoja).toContain("document.addEventListener('focusout'");
    expect(hoja).toContain('escribiendo');
    // La barra sólo se pinta cuando NO se escribe (y sin quitar el resto de la hoja).
    expect(hoja).toMatch(/\{!escribiendo && \( <motion\.div/);
  });

  it('34 · y se limpia al desmontar: sin oyentes huérfanos', () => {
    expect(hoja).toContain("document.removeEventListener('focusin'");
    expect(hoja).toContain("document.removeEventListener('focusout'");
  });

  it('38 · con la cuenta pedida la barra sigue si hay algo que ofrecer (cambiar de mesa)', () => {
    expect(hoja).toMatch(
      /const visible = cantidad > 0 \|\| puedePedirCuenta \|\| [^;]*puedeCambiarDeMesa/,
    );
    expect(hoja).toContain('Cuenta pedida');
  });

  it('38 · la regla de quién la mueve es la misma de siempre: una sola definición', () => {
    expect(pagina).toContain('puedeCambiarDeMesa={puedeCambiarDeMesaAqui}');
    expect(pagina.match(/puedeMoverLaCuenta\(\{/g)).toHaveLength(1);
  });

  it('35 · la hoja ofrece «Imprimir otra hoja de la precuenta» como enlace a la pantalla Precuenta', () => {
    expect(hoja).toContain('hrefDeLaPrecuenta');
    expect(hoja).toContain('Imprimir otra hoja de la precuenta');
    expect(hoja).toMatch(/<Button asChild[^>]*> <Link to=\{hrefDeLaPrecuenta\}>/);
  });

  it('35 · la página lo manda sólo con la cuenta pedida y lo ofrece también en el panel de la tableta', () => {
    // Sólo con la cuenta PEDIDA (con `!==` la hoja se ofrecería con la mesa aún abierta).
    expect(pagina).toContain("ventaActiva?.id && mesaActiva?.estado === 'cuenta_solicitada'");
    expect(pagina).toContain('hrefDeLaPrecuenta={hrefDeLaPrecuenta}');
    expect(pagina).toMatch(
      /const hrefDeLaPrecuenta = [^;]*cuenta_solicitada[^;]*\/restaurante\/precuenta\?cuenta=/,
    );
    expect(pagina).toContain('Imprimir otra hoja de la precuenta');
  });

  it('35 · la pantalla Precuenta dice por qué el total espera y cómo se obtiene', () => {
    const precuenta = leer('src', 'restaurante', 'Precuenta.tsx');
    expect(precuenta).toContain('toca Imprimir');
  });
});

describe('DP-22 · hallazgo 26 · las dos tarjetas de «Movimientos» a la misma altura', () => {
  const tarjetas = leer('src', 'venta', 'tarjetas-del-cajon.ts');

  it('las dos reservan el alto de tres renglones de ayuda (sin subgrid: el iMin lleva Chromium 99)', () => {
    expect(tarjetas).toContain("AYUDA_DE_TRES_RENGLONES = 'min-h-15'");
    expect(tarjetas).not.toContain('lg:grid-rows-subgrid');
    for (const archivo of ['CorteDeTurno.tsx', 'RetiroDeCaja.tsx']) {
      const fuente = leer('src', 'venta', archivo);
      expect(fuente, archivo).toContain(
        '<p className={`text-sm text-texto-sutil ${AYUDA_DE_TRES_RENGLONES}`}>',
      );
      expect(fuente, archivo).toContain("from './tarjetas-del-cajon.ts'");
    }
  });

  it('los campos de «Entregar el turno» miden lo que los de «Retirar» (1.25 × el control)', () => {
    expect(tarjetas).toContain("ALTO_DEL_CAMPO = 'h-[calc(var(--altura-control)*1.25)]'");
    expect(tarjetas).toContain(
      "ALTO_DEL_CAMPO_DE_DINERO = '[&_input]:h-[calc(var(--altura-control)*1.25)]'",
    );
    const corte = leer('src', 'venta', 'CorteDeTurno.tsx');
    expect(corte).toContain('id="turno-contado" className={ALTO_DEL_CAMPO_DE_DINERO}');
    expect(corte).toContain('id="turno-notas" className={ALTO_DEL_CAMPO}');
  });

  it('el barrido ya no conoce esa excepción: cualquier falta de alineación tumba la prueba', () => {
    const barrido = readFileSync(
      join(RAIZ_WEB, '..', '..', 'pruebas', 'e2e', 'qa-final', 'barrido-servicio.spec.ts'),
      'utf8',
    );
    expect(barrido).toContain('const CONOCIDOS: readonly Conocido[] = [];');
    expect(barrido).not.toContain('campos-desalineados');
  });
});

describe('DP-22 · hallazgo 5 · la barra lateral dice que hay más por desplazar', () => {
  const barra = leer('heredado', 'components', 'common', 'Sidebar.jsx');
  const aviso = leer('src', 'tacto', 'NavegacionConAviso.tsx');

  it('el menú principal es la lista con aviso', () => {
    expect(barra).toContain('<NavegacionConAviso etiqueta="Menú principal"');
    expect(barra).toContain('</NavegacionConAviso>');
  });

  it('el aviso sólo sale si queda algo por desplazar y no recibe toques', () => {
    expect(aviso).toContain('el.scrollHeight - el.scrollTop - el.clientHeight > TOLERANCIA_PX');
    expect(aviso).toContain('data-mas-por-desplazar');
    expect(aviso).toMatch(/data-mas-por-desplazar="" className="pointer-events-none /);
    expect(aviso).toContain('aria-hidden="true"');
  });
});
