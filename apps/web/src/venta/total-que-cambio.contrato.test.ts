import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-22 · hallazgo 12 · EL TOTAL CAMBIÓ CON EL COBRO ABIERTO.
 *
 * La cajera tiene la cuenta abierta para cobrar y, mientras tanto, el mesero quita un platillo con
 * la clave de gerencia (o alguien descuenta desde otro aparato; agregar ya no se puede: la cuenta
 * pedida no se edita). Al tocar «Cobrar», el servidor rechaza —«El total cambió
 * desde que se mostró en pantalla. Revísalo con el cliente.»— y hace bien: no cobra un número que
 * nadie le dijo al cliente. Pero la pantalla se quedaba con el total VIEJO: tocar «Cobrar» otra vez
 * fallaba igual, una y otra vez, hasta cerrar la cuenta y volver a abrirla.
 *
 * Ahora, tras ese rechazo, la cuenta se relee del servidor (total, renglones y propina) y lo
 * tecleado de pagos se limpia, porque era para el total de antes.
 *
 * `Caja.jsx` es una pantalla heredada: el contrato lee su texto, SIN comentarios y sobre el trozo
 * que importa (el `catch` del cobro, no el archivo entero). Se valida mutándolo.
 */

const HEREDADO = join(__dirname, '..', '..', 'heredado');
const sinComentarios = (texto: string): string =>
  texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const caja = (): string => sinComentarios(readFileSync(join(HEREDADO, 'pages/Caja.jsx'), 'utf8'));

/** El trozo entre dos marcas; falla si alguna no está (un recorte vacío no afirma nada). */
function entre(texto: string, desde: string, hasta: string): string {
  const inicio = texto.indexOf(desde);
  expect(inicio, `no encuentro «${desde}»`).toBeGreaterThanOrEqual(0);
  const fin = texto.indexOf(hasta, inicio + desde.length);
  expect(fin, `no encuentro «${hasta}» después de «${desde}»`).toBeGreaterThan(inicio);
  return texto.slice(inicio, fin);
}

describe('la Caja cuando el total cambió con el cobro abierto (hallazgo 12)', () => {
  /** El `catch` del cobro cuando la venta NO quedó pagada: del aviso de error al `finally`. */
  const alFallarElCobro = (): string =>
    entre(caja(), "toast.error(err?.message || 'No se pudo cobrar la venta.", '} finally {');

  it('tras «El total cambió…», la cuenta se relee del servidor', () => {
    expect(alFallarElCobro()).toMatch(
      /\(err\?\.datos\?\.regla === 'TOTAL_DESACTUALIZADO' \|\|\s*err\?\.datos\?\.regla === 'PROPINA_VIGENTE'\) &&\s*ventaSeleccionada\?\.id\s*\) \{\s*await releerLaCuentaDelCobro\(ventaSeleccionada\.id\);\s*\}/,
    );
    // DP-D172 · el servidor manda `codigo: 'REGLA_DE_NEGOCIO'`; la regla va en `datos.regla`. Comparar
    // `err.codigo` con la regla nunca coincide y la pantalla se queda con el total viejo.
    expect(alFallarElCobro()).not.toMatch(/err\?\.codigo === 'TOTAL_DESACTUALIZADO'/);
  });

  it('también se relee cuando la caja ya había elegido la propina y la cuenta cambió (DP-D168)', () => {
    // El mesero quita un platillo con el PIN del gerente con el cobro abierto: el servidor contesta
    // CONFLICTO_ESTADO / PROPINA_VIGENTE y, sin releer, la pantalla repetía el rechazo sin fin.
    expect(alFallarElCobro()).toMatch(/err\?\.datos\?\.regla === 'PROPINA_VIGENTE'/);
  });

  it('releer la cuenta trae total y renglones del servidor y limpia los pagos tecleados', () => {
    const releer = entre(
      caja(),
      'const releerLaCuentaDelCobro = async (ordenId) => {',
      '} catch (err) {',
    );
    expect(releer).toMatch(/api\.entidades\.Venta\.get\(ordenId\)/);
    expect(releer).toMatch(/api\.entidades\.DetalleVenta\.filter\(\{ venta_id: ordenId \}\)/);
    expect(releer).toMatch(/setVentaSeleccionada\(/);
    expect(releer).toMatch(/setDetallesSeleccionados\(/);
    for (const limpiar of [
      "setMontoEfectivo('')",
      "setMontoTarjeta('')",
      "setMontoTransferencia('')",
    ]) {
      expect(releer).toContain(limpiar);
    }
  });

  it('el total que viaja al cobro sale de la cuenta que está en pantalla (la releída)', () => {
    // Si `total` saliera de otra parte, releer la cuenta no cambiaría lo que se manda.
    const cobro = entre(caja(), 'const total = ventaSeleccionada.total || 0;', '} finally {');
    expect(cobro).toMatch(/totalEsperadoCentavos: aCentavos\(total\),/);
  });
});
