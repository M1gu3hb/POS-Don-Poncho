#!/usr/bin/env node
/**
 * DP-22 · GENERA LAS TABLAS DE COMBINACIONES (`qa/qa-final/datos/combinaciones/*.json`).
 *
 *   node scripts/qa-final/generar-combinaciones.mjs dinero [--semilla 2211] [--pict]
 *   node scripts/qa-final/generar-combinaciones.mjs ajustes  [--semilla 2211]
 *   node scripts/qa-final/generar-combinaciones.mjs --verificar        # sin generar: revisa las guardadas
 *
 * El modelo (`<nombre>.modelo.json`) manda: parámetros, valores y combinaciones prohibidas. La tabla
 * sale con el generador voraz y determinista de `nucleo.ts` (misma semilla, misma tabla) o, con
 * `--pict`, con el binario de PICT si `pict-node` lo tiene bajado (el espacio de trabajo no lo
 * descarga: `allowBuilds: pict-node: false`, para no meter una descarga en la CI). Sea cual sea el
 * generador, la tabla se GUARDA en el repo y se comprueba con `revisarTabla`, que no necesita PICT.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as prettier from 'prettier';

import {
  generarTabla,
  modeloParaPict,
  revisarTabla,
  tablaCompleta,
} from '../../qa/qa-final/combinaciones/nucleo.ts';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATOS = join(RAIZ, 'qa/qa-final/datos/combinaciones');
const SEMILLA_POR_OMISION = 2211;
const NOMBRE_DE_LA_TABLA = { 3: 'ternas', 2: 'pares' };

function argumento(nombre, porOmision) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? porOmision : process.argv[i + 1];
}

function leerModelo(nombre) {
  return JSON.parse(readFileSync(join(DATOS, `${nombre}.modelo.json`), 'utf8'));
}

function archivoDeLaTabla(modelo) {
  return join(DATOS, `${modelo.nombre}.${NOMBRE_DE_LA_TABLA[modelo.fuerza]}.json`);
}

async function guardar(destino, datos) {
  const opciones = (await prettier.resolveConfig(destino)) ?? {};
  writeFileSync(
    destino,
    await prettier.format(JSON.stringify(datos), { ...opciones, filepath: destino }),
  );
}

async function conPict(modelo) {
  const { default: Pict } = await import('pict-node');
  const resultado = await Pict.run(modeloParaPict(modelo), { order: modelo.fuerza });
  return resultado.map((fila) => Object.fromEntries(Object.entries(fila)));
}

function verificar() {
  let mal = 0;
  for (const nombre of ['dinero', 'ajustes']) {
    const modeloPath = join(DATOS, `${nombre}.modelo.json`);
    if (!existsSync(modeloPath)) continue;
    const modelo = leerModelo(nombre);
    const guardada = archivoDeLaTabla(modelo);
    const tabla = JSON.parse(readFileSync(guardada, 'utf8'));
    const revision = revisarTabla(modelo, tabla);
    const bien = tablaCompleta(revision);
    console.log(
      `${nombre}: ${String(tabla.length)} renglones, ${String(revision.requeridas)} tuplas por cubrir, ` +
        `${String(revision.sinCubrir.length)} sin cubrir · ${bien ? 'completa' : 'INCOMPLETA'}`,
    );
    if (!bien) mal += 1;
  }
  process.exit(mal === 0 ? 0 : 1);
}

if (process.argv.includes('--verificar')) verificar();
else {
  const nombre = process.argv[2];
  if (nombre === undefined || nombre.startsWith('--')) {
    console.error('Falta el nombre del modelo: dinero o ajustes.');
    process.exit(2);
  }
  const modelo = leerModelo(nombre);
  const semilla = Number(argumento('semilla', SEMILLA_POR_OMISION));
  const tabla = process.argv.includes('--pict')
    ? await conPict(modelo)
    : generarTabla(modelo, semilla);
  const revision = revisarTabla(modelo, tabla);
  if (!tablaCompleta(revision)) {
    console.error('La tabla generada no cubre todo:', JSON.stringify(revision, null, 2));
    process.exit(1);
  }
  await guardar(archivoDeLaTabla(modelo), tabla);
  console.log(
    `${nombre}: ${String(tabla.length)} renglones (${process.argv.includes('--pict') ? 'PICT' : `generador propio, semilla ${String(semilla)}`}), ` +
      `${String(revision.requeridas)} tuplas cubiertas.`,
  );
}
