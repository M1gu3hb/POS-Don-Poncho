import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-15 · QA de la jornada, J-H4 · LA PRECUENTA DEL MESERO DEJA RASTRO.
 *
 * El mesero imprimía la precuenta desde su diálogo con `window.print` y nada más: el servidor no se
 * enteraba (`ordenes.precuentas_impresas` en 0). Y de ese rastro dependen las reglas: con la
 * precuenta impresa, quitar o cancelar pide PIN (DP-13.2), y la siguiente hoja sale como copia.
 * Ahora el botón «Imprimir» cuenta la hoja con `restaurante.imprimir_precuenta` ANTES de imprimir,
 * y si el servidor no la cuenta, no se imprime a escondidas.
 *
 * Contrato de texto (el `.jsx` heredado no se importa en las pruebas), validado por mutación.
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const MESERO = readFileSync(join(RAIZ, 'heredado/pages/Mesero.jsx'), 'utf8').replace(/\s+/g, ' ');

const imprimirPreCuenta = (): string => {
  const inicio = MESERO.indexOf('const imprimirPreCuenta = async () => {');
  expect(inicio).toBeGreaterThan(-1);
  return MESERO.slice(inicio, MESERO.indexOf('}; ', inicio));
};

describe('la precuenta del mesero', () => {
  it('cuenta la hoja en el servidor antes de imprimirla, con el rollo del negocio', () => {
    const cuerpo = imprimirPreCuenta();
    const cuenta = cuerpo.indexOf("api.comandos.ejecutar('/api/restaurante/imprimir-precuenta'");
    const imprime = cuerpo.indexOf('printDocument(');
    expect(cuenta).toBeGreaterThan(-1);
    expect(imprime).toBeGreaterThan(cuenta);
    expect(cuerpo).toContain('ordenId: preCuentaData.venta.id');
    expect(cuerpo).toContain('anchoMm: anchoDelPapel(config?.ancho_papel_ticket)');
  });

  it('si el servidor no la cuenta, no se imprime', () => {
    const cuerpo = imprimirPreCuenta();
    expect(cuerpo).toMatch(/catch \(err\) \{[^}]*toast\.error\([^}]*return;/);
  });
});
