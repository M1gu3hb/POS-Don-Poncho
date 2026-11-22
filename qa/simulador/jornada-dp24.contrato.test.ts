import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * LA JORNADA CORTA DE BOTS DE DP-24 Y SUS CUADRES (DP-25 · Parte 9).
 *
 * Son guiones de la laptop contra una copia: tres cosas que no se pueden perder al tocarlos.
 *   1. Se niegan a correr contra otra cosa que una copia local (`exigirCopiaLocal`), ANTES de abrir
 *      la base.
 *   2. Sólo LEEN la base: la jornada no escribe SQL y los cuadres abren su transacción de sólo lectura.
 *   3. El mesero de la jornada no quita platillos: sus cuentas se cobran como se pidieron, así los
 *      cuadres de dinero y de inventario no se ensucian con anulaciones que nadie midió.
 *
 * Se mira el código SIN comentarios: la palabra «anular» o «insert into» que sólo se menciona en la
 * prosa del encabezado no cuenta como uso.
 */

function codigoDe(nombre: string): string {
  const texto = readFileSync(fileURLToPath(new URL(nombre, import.meta.url)), 'utf8');
  return texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const JORNADA = codigoDe('./jornada-dp24.ts');
const CUADRES = codigoDe('./cuadres-dp24.ts');

describe('la jornada corta de bots y sus cuadres', () => {
  it('exigen una copia local antes de abrir la base', () => {
    for (const [nombre, codigo] of [
      ['jornada-dp24', JORNADA],
      ['cuadres-dp24', CUADRES],
    ] as const) {
      const candado = codigo.indexOf('exigirCopiaLocal({');
      const conexion = codigo.indexOf('.connect()');
      expect(candado, `${nombre} no llama a exigirCopiaLocal`).toBeGreaterThan(-1);
      expect(conexion, `${nombre} no abre la base`).toBeGreaterThan(-1);
      expect(candado, `${nombre} abre la base antes del candado`).toBeLessThan(conexion);
    }
  });

  it('la jornada no escribe SQL y los cuadres abren su transacción de sólo lectura', () => {
    expect(JORNADA).not.toMatch(/\b(insert\s+into|update\s+\w+\s+set|delete\s+from|truncate)\b/i);
    expect(CUADRES).not.toMatch(/\b(insert\s+into|update\s+\w+\s+set|delete\s+from|truncate)\b/i);
    expect(CUADRES).toMatch(/query\(\s*'begin read only'\s*\)/);
  });

  it('el mesero de la jornada no quita platillos ni cancela cuentas', () => {
    const rutas = [...JORNADA.matchAll(/'(\/api\/[a-z0-9/_-]+)'/g)].map((m) => m[1] ?? '');
    expect(rutas.length).toBeGreaterThan(10);
    expect(rutas.filter((ruta) => /anular|quitar|cancelar/.test(ruta))).toEqual([]);
  });
});
