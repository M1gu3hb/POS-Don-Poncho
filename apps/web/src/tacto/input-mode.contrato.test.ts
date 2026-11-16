import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-21 · Bloque 9 · M16 · CADA `type="number"` TRAE SU TECLADO.
 *
 * Un `<input type="number">` sin `inputMode` abre en el teclado de letras en algunos aparatos, o en
 * uno numérico sin punto decimal en otros. Dinero y cantidades con decimales → `decimal`; enteros
 * (personas, minutos, posiciones, folios) → `numeric`; teléfono → `tel`. Los campos de dinero del
 * repo usan `CampoDeDinero`, que ya trae `inputMode="decimal"` y su propio saneado: no cambian.
 * Se leen los `.jsx/.tsx` (heredado y nuevos) y se valida mutando el código real.
 */

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const CARPETAS = [
  join(RAIZ_WEB, 'src'),
  join(RAIZ_WEB, 'heredado'),
  join(RAIZ_WEB, '..', '..', 'packages', 'ui', 'src'),
];

function archivos(carpeta: string): string[] {
  return readdirSync(carpeta).flatMap((nombre) => {
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) {
      return nombre === 'node_modules' || nombre === '.next' ? [] : archivos(ruta);
    }
    return /\.(tsx|jsx)$/.test(nombre) && !nombre.endsWith('.test.tsx') ? [ruta] : [];
  });
}

interface Campo {
  readonly donde: string;
  readonly elemento: string;
  readonly modo: string | null;
}

function camposNumericos(): Campo[] {
  return CARPETAS.flatMap(archivos).flatMap((archivo) => {
    const codigo = readFileSync(archivo, 'utf8');
    const hallados: Campo[] = [];
    let desde = -1;
    while ((desde = codigo.indexOf('type="number"', desde + 1)) !== -1) {
      const lineaDeCodigo = codigo.slice(codigo.lastIndexOf('\n', desde) + 1, desde);
      // Un comentario que menciona `type="number"` (NumericInput) no es un campo.
      if (/^\s*(\*|\/\/|\{\/\*)/.test(lineaDeCodigo)) continue;
      const abre = codigo.lastIndexOf('<', desde);
      const cierra = codigo.indexOf('/>', desde);
      const elemento = codigo.slice(abre, cierra + 2);
      const linea = codigo.slice(0, desde).split('\n').length;
      hallados.push({
        donde: `${relative(RAIZ_WEB, archivo).split(sep).join('/')}:${String(linea)}`,
        elemento,
        modo: /inputMode="(\w+)"/.exec(elemento)?.[1] ?? null,
      });
    }
    return hallados;
  });
}

/** Por el nombre del campo: lo que lleva decimales va primero; los enteros, después. */
const DECIMALES =
  /monto|costo|precio|cantidad|equivalencia|piezas|ml_por|mlPorPorcion|Display|efectivo/;
const ENTEROS =
  /personas|capacidad|numero|orden|porciones|dia_pago|posicion|cocina-ambar|cocina-roja|Ángulo|Tamaño impreso/;

const campos = camposNumericos();

describe('cada type="number" trae su inputMode', () => {
  it('encuentra los campos (la búsqueda no está ciega)', () => {
    expect(campos.length).toBeGreaterThanOrEqual(40);
  });

  it('todos lo traen, y es uno de los tres que existen aquí', () => {
    const sin = campos.filter(
      (c) => c.modo === null || !['decimal', 'numeric', 'tel'].includes(c.modo),
    );
    expect(sin.map((c) => c.donde)).toEqual([]);
  });

  it('el dinero y las cantidades con decimales son `decimal`; los enteros, `numeric`', () => {
    const mal: string[] = [];
    for (const c of campos) {
      const esperado = DECIMALES.test(c.elemento)
        ? 'decimal'
        : ENTEROS.test(c.elemento)
          ? 'numeric'
          : null;
      if (esperado !== null && c.modo !== esperado) {
        mal.push(`${c.donde}: lleva ${String(c.modo)} y le toca ${esperado}`);
      }
    }
    expect(mal).toEqual([]);
  });

  it('con `step` de decimales (0.01, 0.1) nunca es `numeric`: el teclado no tendría punto', () => {
    const mal = campos.filter((c) => /step=\{?"?0\.\d/.test(c.elemento) && c.modo === 'numeric');
    expect(mal.map((c) => c.donde)).toEqual([]);
  });
});
