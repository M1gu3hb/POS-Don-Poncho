#!/usr/bin/env node
/**
 * `verify:modo-compatible` (DP-20.1) · el contrato del modo compatible sobre el CSS de `next build`.
 *
 * Corre DESPUÉS del build y lee lo que de verdad llega a producción (`apps/web/.next/static`), no
 * lo que el plugin cree que escribió: entre el plugin y el archivo servido está el minificador de
 * Next, que funde y reordena reglas.
 *
 * Falla si alguna mezcla `color-mix` se queda con respaldo sólido, si una regla con `translate` /
 * `scale` / `rotate` no tiene su `transform` de respaldo, si un `dvh` no tiene su `vh`… o si no
 * encuentra NADA que revisar: una hoja sin una sola mezcla significa que Tailwind cambió de forma
 * o que se está leyendo el archivo equivocado, y un contrato que no mira nada no protege nada.
 *
 * El contrato: `scripts/modo-compatible/contrato.mjs`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import postcss from 'postcss';

import { apiSinRelleno, rellenosDeclarados } from './modo-compatible/api-nuevas.mjs';
import { revisar } from './modo-compatible/contrato.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ESTATICOS = join(RAIZ, 'apps', 'web', '.next', 'static');
const RELLENOS = join(RAIZ, 'apps', 'web', 'src', 'compatibilidad', 'rellenos.ts');

function archivosCon(carpeta, extension) {
  const hallados = [];
  for (const nombre of readdirSync(carpeta)) {
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) hallados.push(...archivosCon(ruta, extension));
    else if (nombre.endsWith(extension)) hallados.push(ruta);
  }
  return hallados;
}

let archivos;
let guiones;
try {
  archivos = archivosCon(ESTATICOS, '.css');
  guiones = archivosCon(ESTATICOS, '.js');
} catch (error) {
  console.error(`✗ modo compatible: no hay build que revisar en ${relative(RAIZ, ESTATICOS)}.`);
  console.error(`  Corre «pnpm build» antes. (${error instanceof Error ? error.message : error})`);
  process.exit(1);
}

const total = {
  mezclas: 0,
  sueltas: 0,
  animaciones: 0,
  dinamicas: 0,
  degradados: 0,
  coloresNuevos: 0,
  tiene: 0,
};
const avisoDeAparatoViejo = { aspecto: false, decideLaHoja: false };
const fallos = [];
for (const archivo of archivos) {
  const { problemas, cuentas, aviso } = revisar(postcss.parse(readFileSync(archivo, 'utf8')));
  for (const clave of Object.keys(total)) total[clave] += cuentas[clave];
  for (const problema of problemas) fallos.push(`${relative(RAIZ, archivo)}: ${problema}`);
  avisoDeAparatoViejo.aspecto ||= aviso.aspecto;
  avisoDeAparatoViejo.decideLaHoja ||= aviso.decideLaHoja;
}
if (!avisoDeAparatoViejo.aspecto)
  fallos.push('falta, fuera de las capas, el aspecto del aviso de «aparato demasiado viejo»');
if (avisoDeAparatoViejo.decideLaHoja)
  fallos.push(
    'la hoja decide con `display` si se ve el aviso de «aparato demasiado viejo»: lo enseña su guion',
  );

// El JavaScript: ninguna función más nueva que el motor viejo sin su relleno.
const rellenos = rellenosDeclarados(readFileSync(RELLENOS, 'utf8'));
const usadas = new Set();
for (const guion of guiones) {
  const { usadas: suyas, sinRelleno } = apiSinRelleno(readFileSync(guion, 'utf8'), rellenos);
  for (const nombre of suyas) usadas.add(nombre);
  for (const api of sinRelleno)
    fallos.push(
      `${relative(RAIZ, guion)}: usa ${api.nombre} (Chromium ${String(api.desde)}) y no tiene relleno`,
    );
}
if (rellenos.length === 0)
  fallos.push('no se encontró la lista RELLENOS_INSTALADOS de rellenos.ts');

const vacias = Object.entries(total).filter(([, cuantas]) => cuantas === 0);
if (vacias.length > 0) {
  console.error('✗ modo compatible: el contrato no encontró qué revisar.');
  console.error(
    `  Sin ninguna: ${vacias.map(([clave]) => clave).join(', ')} (en ${archivos.length} hojas).`,
  );
  console.error('  O Tailwind cambió la forma del CSS o el build no es el de producción.');
  process.exit(1);
}

if (fallos.length > 0) {
  console.error(`✗ modo compatible: ${fallos.length} respaldos faltan en el CSS de producción.`);
  for (const fallo of fallos.slice(0, 40)) console.error(`  · ${fallo}`);
  if (fallos.length > 40) console.error(`  … y ${fallos.length - 40} más.`);
  console.error(
    '  Un POS con motor viejo (Chromium 99–110) los vería sólidos o corridos, o se caería.',
  );
  console.error('  El plugin: scripts/modo-compatible/plugin.mjs. Los rellenos de JavaScript:');
  console.error(
    '  apps/web/src/compatibilidad/rellenos.ts (y la lista de scripts/modo-compatible/api-nuevas.mjs).',
  );
  process.exit(1);
}

console.log(
  `✓ modo compatible: ${total.mezclas} mezclas con respaldo transparente, ` +
    `${total.sueltas} reglas y ${total.animaciones} animaciones con su transform, ` +
    `${total.dinamicas} alturas dinámicas con su vh, ${total.degradados} degradados sin «in oklab», ${total.coloresNuevos} colores de espacios nuevos con su rgb(), ${total.tiene} :has() con su marca; ` +
    `${guiones.length} guiones revisados, con relleno para ${[...usadas].join(', ') || 'nada (no usa funciones nuevas)'}.`,
);
