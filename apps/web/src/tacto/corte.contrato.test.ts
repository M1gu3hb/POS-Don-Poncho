import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-21 · Bloque 9 · EL CORTE, AL TACTO (M23 y O6).
 *
 * El corte ponía el foco en «Efectivo contado» al abrir: en el iMin y en la tableta el teclado salía
 * solo y la pantalla brincaba. Y su campo (`enorme`, con una ayuda larga debajo) no medía lo mismo
 * que el de «Dinero dejado en caja»: las dos cajas se veían descuadradas. Este contrato lee la
 * pantalla —un test de componentes no pinta aquí— y se valida mutando el código real.
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const CODIGO = readFileSync(join(RAIZ, 'src/restaurante/CierreDiario.tsx'), 'utf8');

/** El elemento `<CampoDeDinero …/>` que lleva este id, tal como está escrito. */
function campoConId(id: string): string {
  const inicio = CODIGO.indexOf(`id="${id}"`);
  if (inicio === -1) throw new Error(`No encontré el campo «${id}».`);
  const abre = CODIGO.lastIndexOf('<CampoDeDinero', inicio);
  const cierra = CODIGO.indexOf('/>', inicio);
  return CODIGO.slice(abre, cierra + 2);
}

const tamanoDe = (campo: string): string => /tamano="([^"]+)"/.exec(campo)?.[1] ?? 'sin-tamano';

describe('el corte al abrir se ve de arriba', () => {
  it('ningún campo del corte se enfoca solo', () => {
    expect(CODIGO).not.toMatch(/\bautoFocus\b/);
  });

  it('el conteo sigue a ciegas: el esperado sólo sale cuando hay algo escrito', () => {
    expect(CODIGO).toMatch(/cuenta !== null && \(/);
    expect(CODIGO).toMatch(/Esperado/);
  });
});

describe('«Efectivo contado» y «Dinero dejado en caja» van alineados', () => {
  it('los dos campos miden lo mismo', () => {
    expect(tamanoDe(campoConId('contado'))).toBe(tamanoDe(campoConId('fondo')));
  });

  it('los dos campos van en la misma fila marcada, con su etiqueta cada uno', () => {
    expect(CODIGO).toMatch(/data-fila-de-conteo/);
    const fila = CODIGO.indexOf('data-fila-de-conteo');
    for (const id of ['contado', 'fondo']) {
      expect(CODIGO.indexOf(`htmlFor="${id}"`)).toBeGreaterThan(fila);
      expect(CODIGO.indexOf(`id="${id}"`)).toBeGreaterThan(fila);
    }
  });

  it('la ayuda y el aviso del fondo quedan FUERA de la fila de los dos campos', () => {
    const fila = CODIGO.indexOf('data-fila-de-conteo');
    const apertura = CODIGO.lastIndexOf('<div', fila);
    let profundidad = 0;
    let cierre = -1;
    for (const m of CODIGO.slice(apertura).matchAll(/<div\b|<\/div>/g)) {
      profundidad += m[0] === '</div>' ? -1 : 1;
      if (profundidad === 0) {
        cierre = apertura + (m.index ?? 0);
        break;
      }
    }
    expect(cierre, 'no encontré dónde cierra la fila').toBeGreaterThan(-1);
    expect(CODIGO.indexOf('id="ayuda-contado"')).toBeGreaterThan(cierre);
    expect(CODIGO.indexOf('id="fondo-ilegible"')).toBeGreaterThan(cierre);
  });

  it('las cajas se alinean por abajo: una etiqueta de dos renglones no las descuadra', () => {
    const fila = CODIGO.indexOf('data-fila-de-conteo');
    const apertura = CODIGO.lastIndexOf('<div', fila);
    expect(CODIGO.slice(apertura, CODIGO.indexOf('>', fila))).toMatch(/\bitems-end\b/);
  });
});
