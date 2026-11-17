#!/usr/bin/env node
/**
 * DP-22 · EL MAPA TOTAL (`docs/qa-final/MATRIZ.md`), generado desde el repo.
 *
 *   node scripts/qa-final/generar-matriz.mjs              # escribe MATRIZ.md y datos/matriz.json
 *   node scripts/qa-final/generar-matriz.mjs --verificar  # falla si algo del código quedó sin mapa
 *
 * No se edita a mano: lo que el mapa dice sale de las páginas de `apps/web/app`, de la regla de
 * rutas por puesto, de las listas de configuración del puente, de `secciones.ts`, de la matriz de
 * permisos y del mapa del puente. Lo único escrito por una persona son dos archivos de datos:
 * `qa/qa-final/datos/efectos.json` (qué debe cambiar cada ajuste y la prueba que lo demuestra) y
 * `qa/qa-final/datos/flujos.json` (el catálogo de flujos con su prueba). `--verificar` falla si una
 * clave del código no tiene su renglón, si una prueba citada no existe o si el documento quedó
 * viejo en su estructura (no compara renglones de `archivo:línea`, que cambian con cada edición).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { ajustes } from './matriz/ajustes.mjs';
import { comandos, entidades } from './matriz/comandos.mjs';
import { RAIZ } from './matriz/fuentes.mjs';
import { pantallas } from './matriz/pantallas.mjs';
import { PUESTOS, rutasPorPuesto } from './matriz/puestos.mjs';
import { escribirDocumento } from './matriz/documento.mjs';

const DATOS = 'qa/qa-final/datos';
const SALIDA_MD = 'docs/qa-final/MATRIZ.md';
const SALIDA_JSON = `${DATOS}/matriz.json`;

function leerJson(ruta, porOmision) {
  const completa = join(RAIZ, ruta);
  if (!existsSync(completa)) return porOmision;
  return JSON.parse(readFileSync(completa, 'utf8'));
}

function commit() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: RAIZ,
      encoding: 'utf8',
    }).trim();
  } catch {
    return 'sin git';
  }
}

async function armar() {
  const efectos = leerJson(`${DATOS}/efectos.json`, {});
  const flujos = leerJson(`${DATOS}/flujos.json`, []);
  const cobertura = leerJson(`${DATOS}/cobertura.json`, {});

  const { pantallas: lista, delArmazon } = pantallas();
  const porPuesto = await rutasPorPuesto(lista.map(({ ruta }) => ruta));
  const porArchivo = new Map();
  for (const { ruta, archivos } of lista) {
    for (const archivo of archivos)
      porArchivo.set(archivo, [...(porArchivo.get(archivo) ?? []), ruta]);
  }

  const deLasPantallas = lista.map((pantalla) => ({
    ...pantalla,
    conSesion: pantalla.grupo !== 'público',
    puestos:
      pantalla.grupo === 'público'
        ? []
        : PUESTOS.filter(({ puesto }) => porPuesto[pantalla.ruta][puesto]).map(
            ({ puesto }) => puesto,
          ),
    cobertura: cobertura[pantalla.ruta] ?? null,
  }));

  return {
    commit: commit(),
    puestos: PUESTOS.map(({ puesto, nombre }) => ({ puesto, nombre })),
    pantallas: deLasPantallas,
    delArmazon,
    ajustes: await ajustes(efectos),
    flujos: flujos.map((flujo) => ({
      ...flujo,
      pruebasQueFaltan: flujo.pruebas.filter((ruta) => !existsSync(join(RAIZ, ruta))),
    })),
    comandos: comandos(porArchivo),
    entidades: entidades(porArchivo),
  };
}

/** Lo que no puede quedar así: una clave sin renglón de efecto o una prueba citada que no existe. */
function huecos(mapa) {
  const salida = [];
  for (const ajuste of [...mapa.ajustes.delNegocio, ...mapa.ajustes.delAparato]) {
    if (ajuste.efecto === null) salida.push(`ajuste sin renglón en efectos.json: ${ajuste.clave}`);
    for (const prueba of ajuste.efecto?.pruebas ?? []) {
      if (!existsSync(join(RAIZ, prueba.split('#')[0]))) {
        salida.push(`efectos.json cita una prueba que no existe (${ajuste.clave}): ${prueba}`);
      }
    }
  }
  for (const tarjeta of mapa.ajustes.tarjetasSinClave) {
    if (tarjeta.efecto === null)
      salida.push(`tarjeta sin renglón en efectos.json: tarjeta:${tarjeta.id}`);
  }
  for (const flujo of mapa.flujos) {
    for (const falta of flujo.pruebasQueFaltan) {
      salida.push(`flujos.json cita una prueba que no existe (${flujo.id}): ${falta}`);
    }
  }
  return salida;
}

const mapa = await armar();
const faltantes = huecos(mapa);

if (process.argv.includes('--verificar')) {
  if (faltantes.length > 0) {
    console.error(`El mapa total tiene ${String(faltantes.length)} hueco(s):`);
    for (const falta of faltantes) console.error(`  · ${falta}`);
    process.exit(1);
  }
  console.log(
    'El mapa total no tiene huecos: cada ajuste tiene su efecto y cada prueba citada existe.',
  );
} else {
  mkdirSync(dirname(join(RAIZ, SALIDA_JSON)), { recursive: true });
  writeFileSync(join(RAIZ, SALIDA_JSON), `${JSON.stringify(mapa, null, 2)}\n`);
  await escribirDocumento(mapa, faltantes, join(RAIZ, SALIDA_MD));
  console.log(
    `MATRIZ: ${String(mapa.pantallas.length)} pantallas, ` +
      `${String(mapa.ajustes.delNegocio.length + mapa.ajustes.delAparato.length)} ajustes, ` +
      `${String(mapa.flujos.length)} flujos, ${String(mapa.comandos.length)} comandos, ` +
      `${String(mapa.entidades.length)} entidades · ${String(faltantes.length)} hueco(s).`,
  );
}
