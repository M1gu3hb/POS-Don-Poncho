import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * H3 · EL RESUMEN DE REGISTROS SALE DEL SERVIDOR: contrato sobre el texto de las pantallas.
 *
 * Registros sumaba en el navegador las filas que bajaba (con el tope de 1 000 del puente por
 * petición): con «Este año» el resumen era la suma de una parte. Ahora lo pide a `registros.resumen`
 * y sólo lo pinta. Las pantallas heredadas no pasan por tipos, así que se ata aquí su texto.
 */
const RAIZ = join(__dirname, '..', '..', '..', '..');
const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

/** Sin comentarios: lo que dicen no cuenta para el contrato. */
const sinComentarios = (texto: string): string =>
  texto
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const resumenPeriodo = sinComentarios(
  leer('apps/web/heredado/components/registros/ResumenPeriodo.jsx'),
);
const registros = sinComentarios(leer('apps/web/heredado/pages/Registros.jsx'));
const pdf = sinComentarios(leer('apps/web/heredado/components/registros/PeriodoPDF.jsx'));

describe('ResumenPeriodo: no suma filas, lee el resumen del servidor', () => {
  it('los totales y la economía vienen de lo que dijo el servidor', () => {
    expect(resumenPeriodo).toMatch(
      /const totals = sinResumen \? null : totalesDelResumen\(resumen\)/,
    );
    expect(resumenPeriodo).toMatch(
      /const economia = sinResumen \? null : economiaDelResumen\(resumen\)/,
    );
  });

  it('ya no hay ninguna suma de filas en el navegador (ni reduce, ni sumarPropinas)', () => {
    expect(resumenPeriodo).not.toMatch(/\.reduce\(/);
    expect(resumenPeriodo).not.toMatch(/sumarPropinas/);
    expect(resumenPeriodo).not.toMatch(/economiaDelPeriodo\(/);
  });

  it('el neto es el del servidor, no ingresos − compras − gastos hechos aquí', () => {
    expect(resumenPeriodo).toMatch(/const neto = totals\?\.neto/);
    expect(resumenPeriodo).not.toMatch(/totals\.ingresos - totals\.compras/);
  });

  it('si el resumen no llegó, lo dice y deja reintentar (no enseña ceros)', () => {
    expect(resumenPeriodo).toMatch(/No se pudo calcular el resumen/);
    expect(resumenPeriodo).toMatch(/onReintentar/);
  });
});

describe('Registros: pide el resumen al servidor con los días del periodo', () => {
  it('lo lee de /api/registros/resumen con los días del rango', () => {
    expect(registros).toMatch(/const peticion = peticionDelResumen\(range\)/);
    expect(registros).toMatch(
      /invocarComando\('\/api\/registros\/resumen', peticion, \{ signal \}\)/,
    );
    expect(registros).toMatch(/resumen=\{resumenDelServidor\}/);
  });

  it('el resumen cambia con el periodo (su clave lleva los días)', () => {
    expect(registros).toMatch(/queryKey: \['registros_resumen', peticion\]/);
  });

  it('cuando la lista de ventas, compras o gastos se trunca, avisa que el resumen sí cuenta todas', () => {
    expect(registros).toMatch(/avisoDe\('ventas', ventasRaw, \{ resumenCuenta: true \}\)/);
    expect(registros).toMatch(
      /avisoDe\('compras', comprasRaw, \{\s*resumenCuenta: true,\s*total: resumenDelServidor\?\.compras\.cantidad,?\s*\}\)/,
    );
    expect(registros).toMatch(
      /avisoDe\('gastos', gastosRaw, \{\s*resumenCuenta: true,\s*total: resumenDelServidor\?\.gastos\.cantidad,?\s*\}\)/,
    );
  });

  it('los cortes y los movimientos no prometen un resumen que no los cuenta', () => {
    expect(registros).toMatch(/avisoDe\('cortes', cortesRaw\)/);
    expect(registros).toMatch(/avisoDe\('movimientos', movimientosRaw\)/);
  });

  it('el PDF lleva los totales del servidor, no los de las filas listadas', () => {
    expect(resumenPeriodo).toMatch(/totals,\s*margen,\s*economia,/);
  });
});

describe('el PDF del periodo cuenta lo que dijo el servidor', () => {
  it('el encabezado de cada tabla dice cuántas hay en el periodo, no cuántas se listaron', () => {
    expect(pdf).toMatch(/Ventas \(\{totals\.nVentas \?\? ventas\.length\}\)/);
    expect(pdf).toMatch(/Compras \(\{totals\.nCompras \?\? compras\.length\}\)/);
    expect(pdf).toMatch(/Gastos operativos \(\{totals\.nGastos \?\? gastos\.length\}\)/);
  });
});
