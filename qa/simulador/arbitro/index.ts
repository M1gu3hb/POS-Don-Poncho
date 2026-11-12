/**
 * EL ÁRBITRO DEL DÍA: al cerrar el día compara el libro (lo que los bots saben que hicieron) contra
 * cada fuente del sistema —cajas y cortes, inventario, compras y gastos, lo que ve el dueño y las
 * invariantes de la base— al centavo y al gramo. Cada diferencia es un incidente de dinero o de
 * inventario con lo esperado y lo real. Escribe `<salida>/dia-N/arbitro.json`.
 *
 *   node qa/simulador/arbitro/index.ts --app … --base … --pines … --dia 1 [--desde 2026-11-16T00:00:00-06:00] [--linea-base]
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { leerEntorno } from '../entorno.ts';
import { abrirRegistro } from '../incidentes.ts';
import { crearComparador, leerSql, num, ORGANIZACION, type ResultadoDelArbitro } from './base.ts';
import { arbitrarCajas } from './cajas.ts';
import { arbitrarAlDueno } from './dueno.ts';
import { arbitrarInventario } from './inventario.ts';
import { arbitrarInvariantes, guardarLineaBase } from './invariantes.ts';
import { carpetaDelDia, leerLibros } from './salida.ts';

const DESDE_POR_OMISION = '2026-11-16T00:00:00-06:00';

function argumento(nombre: string, porOmision: string): string {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? porOmision : (process.argv[i + 1] ?? porOmision);
}

export async function arbitrar(
  baseUrl: string,
  salida: string,
  dia: number,
  desde: string,
): Promise<ResultadoDelArbitro> {
  const c = crearComparador();
  const dias = Array.from({ length: dia + 1 }, (_, i) => i);
  const libro = leerLibros(salida, dias);
  const delDia = libro.filter((f) => f.dia === dia);
  const carpeta = carpetaDelDia(salida, dia);
  await arbitrarCajas(baseUrl, libro, desde, c);
  await arbitrarInventario(baseUrl, libro, desde, c);
  const [pagadas] = await leerSql<{ n: string }>(
    baseUrl,
    `select count(*)::text as n from ordenes where organizacion_id = ${ORGANIZACION} and estado = 'pagada'`,
  );
  arbitrarAlDueno(carpeta, delDia, c, num(pagadas?.n));
  await arbitrarInvariantes(baseUrl, salida, c);
  const resultado = c.resultado(dia);
  writeFileSync(join(carpeta, 'arbitro.json'), JSON.stringify(resultado, null, 2));
  const registro = abrirRegistro(salida);
  for (const d of resultado.diferencias) {
    await registro.registrar({
      dia,
      horaSim: new Date().toISOString(),
      bot: 'arbitro',
      rol: 'arbitro',
      aparato: 'ninguno',
      pantalla: d.fuente,
      hizo: `Comparar «${d.concepto}» entre el libro y el sistema`,
      esperaba: d.esperado,
      paso: `El sistema dice: ${d.real}`,
      gravedad: d.gravedad,
      clase: d.clase,
      reproducido: 'no intentado',
    });
  }
  return resultado;
}

if (import.meta.main) {
  const entorno = leerEntorno();
  if (process.argv.includes('--linea-base')) {
    const conteos = await guardarLineaBase(entorno.baseUrl, entorno.salida);
    process.stdout.write(`Línea base de invariantes: ${JSON.stringify(conteos)}\n`);
  } else {
    const r = await arbitrar(
      entorno.baseUrl,
      entorno.salida,
      entorno.dia,
      argumento('desde', DESDE_POR_OMISION),
    );
    process.stdout.write(
      `Árbitro día ${String(entorno.dia)}: ${String(r.comparaciones)} comparaciones, ${String(r.diferencias.length)} diferencias\n`,
    );
    for (const d of r.diferencias.slice(0, 40))
      process.stdout.write(
        `  · [${d.fuente}] ${d.concepto}: esperado ${d.esperado}, real ${d.real}\n`,
      );
  }
}
