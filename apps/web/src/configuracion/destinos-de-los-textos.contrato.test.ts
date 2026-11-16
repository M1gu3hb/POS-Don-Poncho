import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SECCIONES } from './secciones.ts';

/**
 * DP-21 · Bloque 21 · NINGÚN TEXTO MANDA A UNA PESTAÑA QUE YA NO EXISTE.
 *
 * La Configuración pasó de 13 pestañas a 16 secciones. Lo que una pantalla o un error del servidor
 * le dice a la persona («Configuración → …») tiene que nombrar una sección de HOY, con su nombre
 * exacto: «Operación», «Usuarios POS», «Descuentos» o «Mapa de mesas» ya no están en la lista de
 * la izquierda y nadie los encuentra. Se lee el texto de las pantallas (las heredadas no pasan por
 * tipos) y se valida mutándolo: devolver uno de los textos de antes hace fallar la prueba.
 */
const RAIZ = join(__dirname, '..', '..', '..', '..');
const RAICES = [
  'apps/web/src',
  'apps/web/heredado',
  'packages/app/src',
  'packages/ui/src',
  'packages/domain/src',
];
const NOMBRES = SECCIONES.map((s) => s.nombre);

function archivosDe(carpeta: string, salida: string[] = []): string[] {
  for (const nombre of readdirSync(carpeta)) {
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) archivosDe(ruta, salida);
    else if (/\.(tsx|jsx|ts|js)$/.test(nombre) && !/\.test\./.test(nombre)) salida.push(ruta);
  }
  return salida;
}

/** Lo que sigue a «Configuración →» en una línea que no es comentario. */
function destinosDe(texto: string): string[] {
  const destinos: string[] = [];
  for (const linea of texto.split('\n')) {
    if (/^\s*(\*|\/\/|\/\*|\{\/\*)/.test(linea)) continue;
    const m = /Configuración\s*(?:→|>|&gt;)\s*«?([^→.,)(:<»"'`{}]{2,40})/.exec(linea);
    if (m?.[1] !== undefined) destinos.push(m[1].trim());
  }
  return destinos;
}

describe('los textos que mandan a Configuración', () => {
  it('nombran una sección que existe hoy', () => {
    const perdidos: string[] = [];
    let vistos = 0;
    for (const raiz of RAICES) {
      for (const archivo of archivosDe(join(RAIZ, raiz))) {
        for (const destino of destinosDe(readFileSync(archivo, 'utf8'))) {
          vistos += 1;
          if (!NOMBRES.some((nombre) => destino.startsWith(nombre))) {
            perdidos.push(
              `${archivo
                .slice(RAIZ.length + 1)
                .split('\\')
                .join('/')} → «${destino}»`,
            );
          }
        }
      }
    }
    // Que no pase en vacío: hoy hay más de diez textos así.
    expect(vistos).toBeGreaterThan(10);
    expect(perdidos).toEqual([]);
    // Lee cada archivo de cinco carpetas: con el disco ocupado tarda más que una prueba normal.
  }, 120_000);

  it('el lector de destinos ve lo que tiene que ver (y se salta los comentarios)', () => {
    expect(destinosDe("toast('Ve a Configuración → Operación → Estaciones.')")).toEqual([
      'Operación',
    ]);
    expect(destinosDe('<p>Crea mesas en Configuración → Salón → Mapa de mesas.</p>')).toEqual([
      'Salón',
    ]);
    expect(destinosDe(' * Antes vivía en Configuración → Operación.')).toEqual([]);
    expect(destinosDe('// Configuración → Sonidos')).toEqual([]);
  });

  it('la impresora de este aparato manda al Laboratorio del proveedor, no a «Operación»', () => {
    const pantalla = readFileSync(
      join(RAIZ, 'apps/web/src/impresion/pantallas/ImpresionDelAparato.tsx'),
      'utf8',
    );
    expect(pantalla).not.toContain('Operación → «Hardware');
    expect(pantalla).toContain('Configuración → Laboratorio del proveedor');
  });
});
