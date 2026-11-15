#!/usr/bin/env node
/**
 * LA CONTRASEÑA DEL PROVEEDOR NO ESTÁ EN LO PUBLICADO (DP-20 · refuerzo §5).
 *
 *   MORPHIQ_PROVEEDOR_CLAVE=<la contraseña> node scripts/verificar-clave-del-proveedor.mjs [carpeta…]
 *
 * Busca la contraseña —tal cual, en base64, en hexadecimal, escapada y en UTF-16— en el build de
 * la web (`apps/web/.next`) y en las carpetas que se le pasen (las apps empaquetadas, el
 * repositorio de las apps). La contraseña entra SÓLO por la variable de entorno: no se escribe en
 * ningún archivo ni se imprime. Sale 0 si no aparece en ningún lado; 1 si aparece; 2 si no se
 * pudo mirar (sin variable, o una carpeta que no existe o está vacía).
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { buscarSecreto, LARGO_MINIMO } from './lib/buscar-secreto.mjs';

const secreto = process.env['MORPHIQ_PROVEEDOR_CLAVE'];
if (secreto === undefined || secreto.length < LARGO_MINIMO) {
  console.error(
    `Falta MORPHIQ_PROVEEDOR_CLAVE (al menos ${String(LARGO_MINIMO)} caracteres). ` +
      'Pásala sólo en el entorno de esta orden; no la escribas en ningún archivo.',
  );
  process.exit(2);
}

const carpetas = [join('apps', 'web', '.next'), ...process.argv.slice(2)].map((c) => resolve(c));
let encontrados = 0;
for (const carpeta of carpetas) {
  if (!existsSync(carpeta)) {
    console.error(`✗ No existe ${carpeta}: no se pudo mirar (¿falta construir?).`);
    process.exit(2);
  }
  const { mirados, hallazgos } = buscarSecreto(carpeta, secreto);
  if (mirados === 0) {
    console.error(`✗ ${carpeta} no tiene archivos: no se miró nada.`);
    process.exit(2);
  }
  if (hallazgos.length === 0) {
    console.log(`✓ ${carpeta}: ${String(mirados)} archivos, la contraseña no aparece.`);
    continue;
  }
  encontrados += hallazgos.length;
  console.error(`✗ ${carpeta}: la contraseña APARECE en ${String(hallazgos.length)} lugar(es):`);
  for (const { archivo, forma } of hallazgos) console.error(`    · ${archivo} (${forma})`);
}
if (encontrados > 0) {
  console.error('\nCámbiala: una contraseña que llegó a un archivo publicado ya no es secreta.');
  process.exit(1);
}
