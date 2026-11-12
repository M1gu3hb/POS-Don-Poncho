/**
 * EL INFORME DEL DÍA (`DIA-N.md`): el volumen por tipo, el libro contra el sistema, los incidentes y
 * los tiempos (p50/p95 por acción). Sin PIN, sin nombres reales: «la cajera», «Mesero 3».
 *
 *   node qa/simulador/informe.ts --app … --base … --pines … --dia 1
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { carpetaDelDia, leerLibros } from './arbitro/salida.ts';
import type { ResultadoDelArbitro } from './arbitro/base.ts';
import { leerEntorno } from './entorno.ts';
import type { Incidente } from './incidentes.ts';
import { dinero } from './pantallas/comun.ts';

const ORDEN: readonly Incidente['gravedad'][] = ['critico', 'alto', 'medio', 'bajo'];

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- el tipo del JSON lo dice quien lo lee
function leerJson<T>(ruta: string): T | null {
  return existsSync(ruta) ? (JSON.parse(readFileSync(ruta, 'utf8')) as T) : null;
}

function incidentesDelDia(salida: string, dia: number): readonly Incidente[] {
  const ruta = join(salida, 'INCIDENTES.jsonl');
  if (!existsSync(ruta)) return [];
  return readFileSync(ruta, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as Incidente)
    .filter((i) => i.dia === dia);
}

export function redactarInforme(salida: string, dia: number): string {
  const carpeta = carpetaDelDia(salida, dia);
  const libro = leerLibros(salida, [dia]);
  const arbitro = leerJson<ResultadoDelArbitro>(join(carpeta, 'arbitro.json'));
  const tiempos =
    leerJson<{ accion: string; n: number; p50: number; p95: number; max: number }[]>(
      join(carpeta, 'tiempos.json'),
    ) ?? [];
  const incidentes = incidentesDelDia(salida, dia);
  const tipos = new Map<string, number>();
  for (const f of libro) tipos.set(f.asiento.tipo, (tipos.get(f.asiento.tipo) ?? 0) + 1);
  const cobros = libro.flatMap((f) => (f.asiento.tipo === 'cobro' ? [f.asiento] : []));
  const lineas = libro.flatMap((f) => (f.asiento.tipo === 'linea' ? [f.asiento] : []));
  const por = (canal: string) => cobros.filter((c) => c.canal === canal).length;
  const metodo = (m: 'efectivo' | 'tarjeta' | 'transferencia') =>
    cobros.reduce((s, c) => s + c.pagos[m], 0);
  const salida_ = [
    `# Día ${String(dia)} · informe del simulador`,
    '',
    '## Volumen (lo que los bots hicieron, según el libro)',
    '',
    `- Cobros: ${String(cobros.length)} (${String(por('mesa'))} de mesa, ${String(por('llevar'))} para llevar) por ${dinero(cobros.reduce((s, c) => s + c.totalCentavos, 0))}`,
    `- Por método: efectivo ${dinero(metodo('efectivo'))} · tarjeta ${dinero(metodo('tarjeta'))} · transferencia ${dinero(metodo('transferencia'))}`,
    `- Propinas: ${dinero(cobros.reduce((s, c) => s + c.propinaCentavos, 0))} · descuentos: ${dinero(cobros.reduce((s, c) => s + c.descuentoCentavos, 0))}`,
    `- Líneas pedidas: ${String(lineas.length)}`,
    `- Asientos por tipo: ${[...tipos.entries()].map(([t, n]) => `${t} ${String(n)}`).join(' · ')}`,
    '',
    '## El libro contra el sistema',
    '',
  ];
  if (arbitro === null) salida_.push('_El árbitro no corrió._', '');
  else {
    salida_.push(
      `${String(arbitro.comparaciones)} comparaciones, ${String(arbitro.iguales)} iguales, **${String(arbitro.diferencias.length)} diferencias**.`,
      '',
      '| Fuente | Comparaciones | Diferencias |',
      '| --- | ---: | ---: |',
    );
    for (const [fuente, v] of Object.entries(arbitro.porFuente))
      salida_.push(`| ${fuente} | ${String(v.comparaciones)} | ${String(v.diferencias)} |`);
    salida_.push('');
    for (const d of arbitro.diferencias.slice(0, 60))
      salida_.push(
        `- [${d.fuente}] ${d.concepto}: esperado **${d.esperado}**, real **${d.real}** (${d.clase}/${d.gravedad})`,
      );
    salida_.push('');
  }
  salida_.push('## Incidentes', '');
  const ordenados = [...incidentes].sort(
    (a, b) => ORDEN.indexOf(a.gravedad) - ORDEN.indexOf(b.gravedad),
  );
  if (ordenados.length === 0) salida_.push('Ninguno.', '');
  for (const i of ordenados) {
    salida_.push(
      `- **${i.id}** (${i.gravedad}/${i.clase}${i.repeticion ? ', repetición' : ''}) · ${i.rol} · ${i.pantalla}: ${i.hizo}. Esperaba: ${i.esperaba}. Pasó: ${i.paso}`,
    );
  }
  salida_.push(
    '',
    '## Tiempos por acción (ms reales)',
    '',
    '| Acción | n | p50 | p95 | máx |',
    '| --- | ---: | ---: | ---: | ---: |',
  );
  for (const t of tiempos)
    salida_.push(
      `| ${t.accion} | ${String(t.n)} | ${String(t.p50)} | ${String(t.p95)} | ${String(t.max)} |`,
    );
  return `${salida_.join('\n')}\n`;
}

if (import.meta.main) {
  const entorno = leerEntorno();
  const texto = redactarInforme(entorno.salida, entorno.dia);
  const ruta = join(carpetaDelDia(entorno.salida, entorno.dia), `DIA-${String(entorno.dia)}.md`);
  writeFileSync(ruta, texto);
  process.stdout.write(`${ruta}\n`);
}
