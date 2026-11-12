/**
 * EL ÁRBITRO DE LO QUE VE EL DUEÑO: el CSV de Ventas y de Cortes, los conteos de Registros, el
 * Tablero y el Cierre del día contra el libro. Lee lo que el bot del dueño dejó en
 * `<salida>/dia-N/dueno/`. Si el dueño no pudo bajar algo, eso ya es un incidente suyo; aquí sólo se
 * compara lo que llegó.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { dinero } from '../pantallas/comun.ts';
import type { AsientoFechado } from '../libro.ts';
import type { Comparador } from './base.ts';

/** La marca de orden de bytes (BOM) con que empieza el CSV de Registros. */
const BOM = String.fromCharCode(0xfeff);

/** Un CSV simple (comillas dobles y comas). */
export function parsearCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let entreComillas = false;
  // El CSV de Registros trae la marca de orden de bytes (BOM) al principio.
  const limpio = texto.startsWith(BOM) ? texto.slice(1) : texto;
  for (let i = 0; i < limpio.length; i += 1) {
    const ch = limpio.charAt(i);
    if (entreComillas) {
      if (ch === '"' && limpio[i + 1] === '"') {
        campo += '"';
        i += 1;
      } else if (ch === '"') entreComillas = false;
      else campo += ch;
    } else if (ch === '"') entreComillas = true;
    else if (ch === ',') {
      fila.push(campo);
      campo = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && limpio[i + 1] === '\n') i += 1;
      fila.push(campo);
      campo = '';
      if (fila.some((x) => x !== '')) filas.push(fila);
      fila = [];
    } else campo += ch;
  }
  if (campo !== '' || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas;
}

const centavosDeTexto = (t: string): number => Math.round(Number(t.replace(/[^0-9.-]/g, '')) * 100);

function leer(carpeta: string, nombre: string): string | null {
  const ruta = join(carpeta, nombre);
  return existsSync(ruta) ? readFileSync(ruta, 'utf8') : null;
}

export function arbitrarAlDueno(
  carpetaDelDia: string,
  libro: readonly AsientoFechado[],
  c: Comparador,
  pagadasEnBase: number,
): void {
  const carpeta = join(carpetaDelDia, 'dueno');
  const cobros = libro.flatMap((f) => (f.asiento.tipo === 'cobro' ? [f.asiento] : []));
  const ventasDelLibro = cobros.reduce((s, x) => s + x.totalCentavos, 0);
  const csv = leer(carpeta, 'registros-ventas.csv');
  if (csv === null) {
    c.violacion('dueño', 'El CSV de Ventas no se bajó', 'no hay archivo', 'ui', 'alto');
  } else {
    const [cabecera = [], ...filas] = parsearCsv(csv);
    const iFolio = cabecera.findIndex((h) => /folio/i.test(h));
    const iTotal = cabecera.findIndex((h) => /^total/i.test(h.trim()));
    c.comparar(
      'dueño',
      'CSV de Ventas: trae una columna de folio y otra de total',
      'sí',
      iFolio >= 0 && iTotal >= 0 ? 'sí' : `no (${cabecera.join('|')})`,
      'dinero',
      'alto',
    );
    if (iFolio >= 0 && iTotal >= 0) {
      for (const x of cobros) {
        // El rótulo de la serie puede ir delante («A-2»): el folio es lo que sigue al último guion.
        const fila = filas.find((f) => (f[iFolio] ?? '').trim().split('-').at(-1) === x.folio);
        if (fila === undefined) {
          c.violacion('dueño', `CSV de Ventas: falta el folio ${x.folio}`, 'sin fila');
          continue;
        }
        const enCsv = centavosDeTexto(fila[iTotal] ?? '');
        const acepta = enCsv === x.totalCentavos || enCsv === x.totalCentavos + x.propinaCentavos;
        c.comparar(
          'dueño',
          `CSV de Ventas: total del folio ${x.folio}`,
          x.totalCentavos,
          acepta ? x.totalCentavos : enCsv,
        );
      }
    }
  }
  const conteos = leer(carpeta, 'registros-conteos.json');
  if (conteos !== null) {
    const rotulo = (JSON.parse(conteos) as Record<string, string>)['Ventas'] ?? '';
    const cobradas = /(\d+)\s*cobradas/.exec(rotulo)?.[1];
    if (cobradas !== undefined)
      c.comparar(
        'dueño',
        'Registros → Ventas: cuántas cobradas dice el rótulo (las pagadas de la base)',
        pagadasEnBase,
        Number(cobradas),
        'dinero',
        'alto',
      );
  }
  const tablero = leer(carpeta, 'tablero.txt');
  if (tablero === null)
    c.violacion('dueño', 'El Tablero no se leyó', 'no hay archivo', 'ui', 'medio');
  else {
    const tickets = /(d+)s*tickets/i.exec(tablero)?.[1];
    if (tickets !== undefined)
      c.comparar(
        'dueño',
        'Tablero: cuántos tickets dice «Ventas hoy»',
        cobros.length,
        Number(tickets),
        'dinero',
        'alto',
      );
    c.comparar(
      'dueño',
      `Tablero: enseña las ventas del día (${dinero(ventasDelLibro)})`,
      'sí',
      tablero.includes(dinero(ventasDelLibro)) ||
        tablero.includes(dinero(ventasDelLibro).replace('.00', ''))
        ? 'sí'
        : 'no',
      'dinero',
      'medio',
    );
  }
  const cierre = leer(carpeta, 'cierre-del-dia.json');
  if (cierre !== null)
    c.comparar(
      'dueño',
      'Cierre del día: cerró con todo cobrado',
      'sí',
      (JSON.parse(cierre) as { cerro?: boolean }).cerro === true ? 'sí' : 'no',
      'dinero',
      'alto',
    );
}
