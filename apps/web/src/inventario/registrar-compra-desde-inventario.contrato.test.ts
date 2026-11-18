import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  PUESTOS_QUE_REGISTRAN_COMPRAS,
  puedeRegistrarCompras,
} from '../../heredado/components/configuracion/puestos.js';

/**
 * DP-D181 · HALLAZGO 28 · «REGISTRAR COMPRA» DESDE INVENTARIO SÓLO SE OFRECE A QUIEN PUEDE USARLO.
 *
 * Inventario pintaba el botón a cualquiera que entrara, sin mirar el puesto, y lo mandaba a Compras,
 * donde (con el puesto aún sin leer, o con un puesto que no registra) el texto decía que las compras
 * las registra la gerencia. La verdad es el servidor (`compras.registrar`, la matriz de permisos);
 * la pantalla la refleja con `puedeRegistrarCompras(puesto)`, el mismo espejo que ya usa Compras.
 *
 * El contrato se afirma sobre el TROZO que pinta el botón, sin comentarios: «Registrar compra» sale
 * dos veces (el encabezado y la pantalla vacía) y cada una tiene que ir detrás de la guarda. Leer el
 * archivo entero pasaría con un comentario que nombrara la guarda y el botón suelto.
 */
const RAIZ = join(__dirname, '..', '..', '..', '..');
const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

/** Sin comentarios de bloque, de JSX ni de línea entera: lo que la pantalla de verdad ejecuta. */
function sinComentarios(fuente: string): string {
  return fuente
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const inventario = sinComentarios(leer('apps/web/heredado/pages/Inventario.jsx'));
const compras = sinComentarios(leer('apps/web/heredado/pages/Compras.jsx'));

const ENLACE = '<Link to="/compras">';

/** Cada enlace a Compras, con lo que el JSX trae justo antes (la guarda, si la hay). */
function enlacesConSuAntes(): readonly { readonly antes: string; readonly despues: string }[] {
  const salida: { antes: string; despues: string }[] = [];
  let desde = 0;
  for (;;) {
    const donde = inventario.indexOf(ENLACE, desde);
    if (donde < 0) break;
    salida.push({
      antes: inventario.slice(Math.max(0, donde - 80), donde),
      // El trozo que pinta el botón: hasta cerrar el enlace.
      despues: inventario.slice(donde, inventario.indexOf('</Link>', donde) + '</Link>'.length),
    });
    desde = donde + ENLACE.length;
  }
  return salida;
}

describe('el botón «Registrar compra» de Inventario', () => {
  it('el trozo se pudo recortar: el botón sale dos veces (encabezado y pantalla vacía)', () => {
    // Sin esto el contrato pasaría vacío el día que alguien renombre el enlace.
    const enlaces = enlacesConSuAntes();
    expect(enlaces).toHaveLength(2);
    for (const { despues } of enlaces) expect(despues).toContain('Registrar compra');
  });

  it('cada botón va detrás de `registraCompras &&`, no suelto', () => {
    for (const { antes } of enlacesConSuAntes()) {
      expect(antes, 'un botón a Compras sin la guarda del puesto').toMatch(
        /\{registraCompras && \(\s*$/,
      );
    }
  });

  it('la guarda sale del puesto REAL y del espejo de `compras.registrar`', () => {
    expect(inventario).toMatch(/const registraCompras = puedeRegistrarCompras\(usePuesto\(\)\)/);
    expect(inventario).toMatch(
      /import \{ usePuesto \} from '@\/components\/configuracion\/usePuesto'/,
    );
    expect(inventario).toMatch(
      /import \{ puedeRegistrarCompras \} from '@\/components\/configuracion\/puestos'/,
    );
  });

  it('el espejo coincide con quien Compras deja registrar (el almacén sí; la caja y el salón no)', () => {
    expect([...PUESTOS_QUE_REGISTRAN_COMPRAS].sort()).toEqual([
      'administrador',
      'almacen',
      'dueno',
      'gerente',
    ]);
    expect(puedeRegistrarCompras('almacen')).toBe(true);
    for (const puesto of ['cajero', 'mesero', 'cocina', null]) {
      expect(puedeRegistrarCompras(puesto), String(puesto)).toBe(false);
    }
  });
});

describe('Compras no afirma quién registra mientras no sabe el puesto', () => {
  it('el aviso «lo registra la gerencia» exige un puesto leído (`puesto !== null`)', () => {
    expect(compras).toMatch(/\{!registra && puesto !== null && \(\s*<p/);
  });
});
