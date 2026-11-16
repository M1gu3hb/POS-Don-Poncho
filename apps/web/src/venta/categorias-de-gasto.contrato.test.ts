import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { CLAVES_DE_CATEGORIA_DE_GASTO } from '@morphiqpos/domain/gastos';
import { describe, expect, it } from 'vitest';

/**
 * DP-21 · Bloque 11 · UN SOLO CATÁLOGO DE CATEGORÍAS DE GASTO.
 *
 * La Caja ofrecía 5 y Compras y gastos 7, cada pantalla con su lista. Ahora hay una fuente
 * (`@morphiqpos/domain/gastos`) y este contrato falla si alguien vuelve a escribir una lista propia:
 * un archivo que nombre `pago_extraordinario` (la categoría que sólo el catálogo completo trae) o tres
 * categorías del catálogo entre comillas, fuera del catálogo mismo. También cuida que la base (la
 * migración 045) acepte exactamente las categorías del catálogo. Lee el texto del código: se valida
 * mutándolo.
 */
const RAIZ = join(__dirname, '..', '..', '..', '..');
const RAICES = ['apps/web/src', 'apps/web/heredado', 'apps/web/app', 'packages'];
const SALTAR = new Set(['node_modules', '.next', 'dist', 'migraciones']);
const CATALOGO = ['packages', 'domain', 'src', 'gastos'].join(sep);

function archivos(dir: string): string[] {
  const salida: string[] = [];
  for (const nombre of readdirSync(dir)) {
    if (SALTAR.has(nombre)) continue;
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) salida.push(...archivos(ruta));
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(nombre) && !nombre.includes('.test.')) salida.push(ruta);
  }
  return salida;
}

const entreComillas = (texto: string, clave: string): boolean =>
  texto.includes(`'${clave}'`) || texto.includes(`"${clave}"`);

describe('el catálogo único de categorías de gasto', () => {
  const todos = RAICES.flatMap((r) => archivos(join(RAIZ, r)));

  it('ninguna pantalla ni comando trae su propia lista de categorías', () => {
    const propios = todos
      .map((ruta) => relative(RAIZ, ruta))
      .filter((ruta) => !ruta.startsWith(CATALOGO))
      .filter((ruta) => {
        const texto = readFileSync(join(RAIZ, ruta), 'utf8');
        const cuantas = CLAVES_DE_CATEGORIA_DE_GASTO.filter((c) => entreComillas(texto, c)).length;
        return entreComillas(texto, 'pago_extraordinario') || cuantas >= 3;
      });
    expect(propios).toEqual([]);
  });

  it('la Caja, Compras y gastos, las plantillas, la importación y el servidor leen el catálogo', () => {
    const lee = (ruta: string) => readFileSync(join(RAIZ, ruta), 'utf8');
    for (const ruta of [
      'apps/web/src/venta/GastoDeCaja.tsx',
      'apps/web/heredado/components/compras/RegistrarGastoDialog.jsx',
      'apps/web/heredado/components/compras/PlantillaGastoDialog.jsx',
      'apps/web/heredado/utils/importValidators.js',
      'packages/app/src/compras/esquemas.ts',
    ]) {
      expect(lee(ruta), ruta).toContain('@morphiqpos/domain/gastos');
    }
  });

  it('la base acepta exactamente las categorías del catálogo (la migración 045)', () => {
    const sql = readFileSync(
      join(RAIZ, 'packages', 'data', 'src', 'migraciones', 'sql', '045_restaurante.sql'),
      'utf8',
    );
    const lista = /categoria\s+text\s+not null check \(categoria in \(([^)]*)\)\)/.exec(sql)?.[1];
    const deLaBase = [...(lista ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(deLaBase).toEqual([...CLAVES_DE_CATEGORIA_DE_GASTO].sort());
  });
});
