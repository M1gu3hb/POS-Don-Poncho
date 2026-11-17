import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * CONTRATO · Cerrar la caja ya no encola «la cola de sincronización».
 *
 * Esa cola era de una integración de demostración (Google Sheets) que ya se quitó: nadie la
 * consume y sus filas sólo crecen. El comando y su ruta se quedan en el servidor (nada se
 * borra), pero ninguna pantalla los llama ni le habla de ella al cajero. El cierre sigue
 * haciendo todo lo demás, en el mismo orden: cerrar, invalidar lo que cambió y bajar el PDF.
 */

const WEB = fileURLToPath(new URL('../..', import.meta.url));
const CAJA = join(WEB, 'heredado/pages/Caja.jsx');

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (nombre === 'node_modules' || nombre === '.next') return [];
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.(ts|tsx|js|jsx)$/.test(nombre) && !/\.(test|spec)\./.test(nombre) ? [ruta] : [];
  });
}

function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
}

function fuente(ruta: string): string {
  return sinComentarios(
    readFileSync(process.env['MORPHIQPOS_CAJA_CIERRE_SOURCE_PATH'] ?? ruta, 'utf8'),
  );
}

/** El cierre diario entero: de su definición al `finally` que suelta el botón. */
function cierreDiario(codigo: string): string {
  const desde = codigo.indexOf('const handleCierreDiario');
  const hasta = codigo.indexOf('setAccionLoading(false);\n    }', desde);
  expect(desde, 'handleCierreDiario existe').toBeGreaterThan(-1);
  expect(hasta, 'handleCierreDiario termina').toBeGreaterThan(desde);
  return codigo.slice(desde, hasta);
}

describe('ninguna pantalla encola ni nombra la cola de sincronización', () => {
  it('nadie llama a /api/caja/encolar-sincronizacion', () => {
    const culpables = [...archivos(join(WEB, 'heredado')), ...archivos(join(WEB, 'src'))]
      .filter((ruta) => {
        const texto = ruta === CAJA ? fuente(ruta) : sinComentarios(readFileSync(ruta, 'utf8'));
        return texto.includes('encolar-sincronizacion');
      })
      .map((ruta) => relative(WEB, ruta));
    expect(culpables).toEqual([]);
  });

  it('ningún texto de pantalla habla de «cola de sincronización»', () => {
    const culpables = [...archivos(join(WEB, 'heredado')), ...archivos(join(WEB, 'src'))]
      .filter((ruta) => {
        const texto = ruta === CAJA ? fuente(ruta) : sinComentarios(readFileSync(ruta, 'utf8'));
        return /cola de sincronizaci/i.test(texto);
      })
      .map((ruta) => relative(WEB, ruta));
    expect(culpables).toEqual([]);
  });
});

describe('el cierre de caja sigue haciendo todo lo demás, en su orden', () => {
  const cierre = cierreDiario(fuente(CAJA));
  const posicion = (aguja: string): number => {
    const indice = cierre.indexOf(aguja);
    expect(indice, aguja).toBeGreaterThan(-1);
    return indice;
  };

  it('cierra en el servidor, invalida lo que cambió, baja el PDF y avisa', () => {
    const orden = [
      "api.comandos.ejecutar('/api/caja/cerrar'",
      'invalidarCajaQueries()',
      "queryKey: ['ventas_pagadas_caja']",
      "queryKey: ['ventas_hoy']",
      'setCorteCerrado(corteFinal)',
      'setAutoDownloadCorte(corteFinal)',
      'setShowCierreExito(true)',
      "toast.success('¡Caja cerrada correctamente!')",
    ].map(posicion);
    expect(orden).toEqual([...orden].sort((a, b) => a - b));
  });

  it('entre cerrar e invalidar no hay otra llamada al servidor', () => {
    const entre = cierre.slice(
      posicion("api.comandos.ejecutar('/api/caja/cerrar'"),
      posicion('invalidarCajaQueries()'),
    );
    expect(entre.match(/api\.comandos\.ejecutar\(/g)?.length).toBe(1);
  });
});
