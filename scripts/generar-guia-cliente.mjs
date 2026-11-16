/**
 * DP-21 · Bloque 17 · Escribe `docs/cliente/GUIA-RECETAS-E-INVENTARIO.md` desde la MISMA fuente que
 * el panel «¿Cómo funciona?» (`apps/web/src/guias/guia-de-recetas-e-inventario.ts`).
 *
 *   node scripts/generar-guia-cliente.mjs            escribe el documento
 *   node scripts/generar-guia-cliente.mjs --verificar  falla si el documento no coincide
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { guiaEnMarkdown } from '../apps/web/src/guias/guia-de-recetas-e-inventario.ts';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const destino = join(raiz, 'docs', 'cliente', 'GUIA-RECETAS-E-INVENTARIO.md');
const esperado = guiaEnMarkdown();

if (process.argv.includes('--verificar')) {
  const actual = readFileSync(destino, 'utf8');
  if (actual !== esperado) {
    console.error(
      '✗ La guía del cliente no coincide con el panel. Corre `node scripts/generar-guia-cliente.mjs`.',
    );
    process.exit(1);
  }
  console.log('✓ La guía del cliente es la misma que el panel «¿Cómo funciona?».');
} else {
  writeFileSync(destino, esperado, 'utf8');
  console.log(`✓ ${destino}`);
}
