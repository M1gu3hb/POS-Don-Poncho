/**
 * EL RESUMEN DE TODOS LOS INCIDENTES DE LA SEMANA (`INCIDENTES.md`), a partir de `INCIDENTES.jsonl`.
 *
 * Primero los conteos por día y gravedad, luego cada incidente con lo que hizo el bot, lo que
 * esperaba, lo que pasó y su evidencia (las rutas de la evidencia viven fuera del repositorio).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Gravedad, Incidente } from './incidentes.ts';

const GRAVEDADES: readonly Gravedad[] = ['critico', 'alto', 'medio', 'bajo'];
const NOMBRE_DE_LA_GRAVEDAD: Readonly<Record<Gravedad, string>> = {
  critico: 'Crítico',
  alto: 'Alto',
  medio: 'Medio',
  bajo: 'Bajo',
};

export function leerIncidentes(salida: string): readonly Incidente[] {
  const ruta = join(salida, 'INCIDENTES.jsonl');
  if (!existsSync(ruta)) return [];
  return readFileSync(ruta, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as Incidente);
}

/** Una línea sin saltos ni barras verticales, para que no rompa la tabla. */
function enLinea(texto: string, largo = 240): string {
  const plano = texto.replace(/\s+/g, ' ').replaceAll('|', '/').trim();
  return plano.length > largo ? `${plano.slice(0, largo - 1)}…` : plano;
}

function evidenciaDe(i: Incidente): string {
  const e = i.evidencia;
  const partes: string[] = [];
  if (e.captura !== undefined) partes.push(`captura \`${e.captura}\``);
  if (e.traza !== undefined) partes.push(`traza \`${e.traza}\``);
  if (e.correlationId !== undefined) partes.push(`correlationId \`${e.correlationId}\``);
  if (e.logServidor !== undefined) partes.push(`log del servidor \`${e.logServidor}\``);
  if (e.consola !== undefined && e.consola.length > 0)
    partes.push(`consola: ${enLinea(e.consola.slice(-2).join(' · '), 160)}`);
  if (e.red !== undefined && e.red.length > 0)
    partes.push(`red: ${enLinea(e.red.slice(-2).join(' · '), 160)}`);
  return partes.length === 0 ? 'sin evidencia adjunta' : partes.join('; ');
}

export function redactarIncidentes(salida: string): string {
  const todos = leerIncidentes(salida);
  const dias = [...new Set(todos.map((i) => i.dia))].sort((a, b) => a - b);
  const lineas: string[] = [
    '# Incidentes de la semana simulada',
    '',
    `${String(todos.length)} incidentes. La evidencia (capturas, consola, red) vive fuera del repositorio, en la carpeta de salida del simulador.`,
    '',
    '| Día | Crítico | Alto | Medio | Bajo |',
    '| ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const dia of dias) {
    const delDia = todos.filter((i) => i.dia === dia);
    const n = (g: Gravedad): string => String(delDia.filter((i) => i.gravedad === g).length);
    lineas.push(
      `| ${String(dia)} | ${n('critico')} | ${n('alto')} | ${n('medio')} | ${n('bajo')} |`,
    );
  }
  for (const g of GRAVEDADES) {
    const de = todos.filter((i) => i.gravedad === g);
    if (de.length === 0) continue;
    lineas.push('', `## ${NOMBRE_DE_LA_GRAVEDAD[g]} (${String(de.length)})`, '');
    for (const i of de) {
      lineas.push(
        `- **${i.id}** · día ${String(i.dia)}, ${i.horaSim} · ${i.bot} (${i.rol}, ${i.aparato}) · ` +
          `${i.clase}${i.repeticion ? ', repetición' : ''} · reproducido ${i.reproducido}`,
        `  - Pantalla: ${enLinea(i.pantalla)}`,
        `  - Hizo: ${enLinea(i.hizo)}`,
        `  - Esperaba: ${enLinea(i.esperaba)}`,
        `  - Pasó: ${enLinea(i.paso, 600)}`,
        `  - Evidencia: ${evidenciaDe(i)}`,
      );
    }
  }
  return `${lineas.join('\n')}\n`;
}
