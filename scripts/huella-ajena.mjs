#!/usr/bin/env node
/**
 * LA HUELLA DE LOS NEGOCIOS AJENOS (DP-11): que escribir o desplegar Don Poncho no toque a nadie
 * más en la base COMPARTIDA de la Fase A. Sólo lee.
 *
 *   node --conditions=react-server scripts/huella-ajena.mjs tomar --salida <archivo.json>
 *   node scripts/huella-ajena.mjs comparar <antes.json> <despues.json>
 *
 * `tomar` usa `DATABASE_URL` del entorno (la de producción vive en `..\_PRIVADO\`, nunca en el
 * repositorio) y abre UNA transacción `read only`. Por cada tabla (no vista) de `public` con
 * `organizacion_id`, y por cada organización que no es `don-poncho`: cuántas filas tiene y el md5
 * de sus filas en texto, ordenadas. `comparar` dice IDÉNTICA o qué cambió. La salida no lleva
 * datos de nadie: conteos y hashes.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const accion = process.argv[2];
const argumento = (nombre) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
};

async function tomar(salida) {
  const url = process.env['DATABASE_URL'];
  if (url === undefined || url === '' || salida === null) {
    console.error('Uso: DATABASE_URL=… huella-ajena.mjs tomar --salida <archivo.json>');
    process.exit(2);
  }
  const requerir = createRequire(join(process.cwd(), 'packages', 'data', 'package.json'));
  const { Client } = requerir('pg');
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const c = new Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query('begin transaction isolation level repeatable read read only');
    const organizaciones = (
      await c.query("select id, slug from organizaciones where slug <> 'don-poncho' order by slug")
    ).rows;
    const tablas = (
      await c.query(
        // Sólo tablas: una VISTA como `fila_barra` calcula minutos con `now()` y su md5 cambia
        // con el reloj sin que nadie escriba.
        `select c.table_name from information_schema.columns c
           join information_schema.tables t
             on t.table_schema = c.table_schema and t.table_name = c.table_name
          where c.table_schema = 'public' and c.column_name = 'organizacion_id'
            and t.table_type = 'BASE TABLE'
          order by c.table_name`,
      )
    ).rows.map((f) => f.table_name);
    const ids = organizaciones.map((o) => o.id);
    const conteos = {};
    const md5 = {};
    for (const tabla of tablas) {
      const filas = (
        await c.query(
          `select organizacion_id::text as org, count(*)::int as n,
                  md5(string_agg(t::text, '|' order by t::text)) as h
             from public."${tabla.replaceAll('"', '')}" t
            where organizacion_id = any($1::uuid[])
            group by organizacion_id`,
          [ids],
        )
      ).rows;
      if (filas.length === 0) continue;
      conteos[tabla] = Object.fromEntries(filas.map((f) => [f.org, f.n]));
      md5[tabla] = Object.fromEntries(filas.map((f) => [f.org, f.h]));
    }
    await c.query('rollback');
    const huella = { tomada: new Date().toISOString(), organizaciones, conteos, md5 };
    writeFileSync(salida, `${JSON.stringify(huella, null, 2)}\n`);
    const n = Object.values(conteos).reduce((a, t) => a + Object.keys(t).length, 0);
    console.log(
      `✓ Huella de ${String(organizaciones.length)} organizaciones: ${String(tablas.length)} tablas, ` +
        `${String(n)} conteos y md5 (${huella.tomada}).`,
    );
  } finally {
    await c.end();
  }
}

function comparar(rutaAntes, rutaDespues) {
  if (rutaAntes === undefined || rutaDespues === undefined) {
    console.error('Uso: huella-ajena.mjs comparar <antes.json> <despues.json>');
    process.exit(2);
  }
  const antes = JSON.parse(readFileSync(rutaAntes, 'utf8'));
  const despues = JSON.parse(readFileSync(rutaDespues, 'utf8'));
  const diferencias = [];
  const slugs = (h) => h.organizaciones.map((o) => `${o.id}:${o.slug}`).join(',');
  if (slugs(antes) !== slugs(despues)) diferencias.push('cambió la lista de organizaciones');
  for (const campo of ['conteos', 'md5']) {
    const tablas = new Set([...Object.keys(antes[campo]), ...Object.keys(despues[campo])]);
    for (const tabla of tablas) {
      const a = antes[campo][tabla] ?? {};
      const d = despues[campo][tabla] ?? {};
      for (const org of new Set([...Object.keys(a), ...Object.keys(d)])) {
        if (a[org] !== d[org]) diferencias.push(`${campo} · ${tabla} · ${org}`);
      }
    }
  }
  if (diferencias.length === 0) {
    console.log(`✓ IDÉNTICA (${antes.tomada} → ${despues.tomada}).`);
    return;
  }
  console.error(`✗ DISTINTA en ${String(diferencias.length)} punto(s):`);
  for (const d of diferencias) console.error(`  · ${d}`);
  process.exit(1);
}

if (accion === 'tomar') await tomar(argumento('salida'));
else if (accion === 'comparar') comparar(process.argv[3], process.argv[4]);
else {
  console.error('Uso: huella-ajena.mjs tomar --salida <archivo> | comparar <antes> <despues>');
  process.exit(2);
}
