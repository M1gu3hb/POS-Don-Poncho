/**
 * MOVER EL RELOJ DE QA: el mismo instante y el mismo factor para el servidor (archivo), la base
 * (`qa_reloj.reloj_parametros`) y los navegadores (lo que devuelve, para `guionDelNavegador`).
 *
 *   node qa/simulador/reloj/fijar.ts --base <url local qa_…> --archivo <ruta> \
 *        --sim 2026-11-16T08:00:00-06:00 --factor 6
 */
import { writeFileSync, renameSync } from 'node:fs';
import { createRequire } from 'node:module';

import { exigirCopiaLocal } from '../candado.ts';
import { FACTOR_MAXIMO, type ParametrosDelReloj } from './formula.ts';

interface Cliente {
  query(texto: string, valores?: unknown[]): Promise<unknown>;
}

export async function fijarElReloj(
  cliente: Cliente,
  archivo: string,
  simulada: Date,
  factor: number,
  real: number = Date.now(),
): Promise<ParametrosDelReloj> {
  if (!(factor > 0) || factor > FACTOR_MAXIMO)
    throw new Error(`Factor fuera de rango: ${String(factor)}`);
  const p: ParametrosDelReloj = { baseReal: real, baseSim: simulada.getTime(), factor };
  await cliente.query(
    `insert into qa_reloj.reloj_parametros (id, base_real, base_sim, factor)
     values (1, to_timestamp($1 / 1000.0), to_timestamp($2 / 1000.0), $3)
     on conflict (id) do update set base_real = excluded.base_real, base_sim = excluded.base_sim,
       factor = excluded.factor`,
    [p.baseReal, p.baseSim, p.factor],
  );
  // Escribir y renombrar: el servidor nunca lee un archivo a medias.
  writeFileSync(`${archivo}.tmp`, JSON.stringify(p));
  renameSync(`${archivo}.tmp`, archivo);
  return p;
}

function argumento(nombre: string): string {
  const i = process.argv.indexOf(`--${nombre}`);
  const valor = i === -1 ? undefined : process.argv[i + 1];
  if (valor === undefined) throw new Error(`Falta --${nombre}`);
  return valor;
}

if (import.meta.main) {
  const cadena = argumento('base');
  exigirCopiaLocal({ databaseUrl: cadena, entorno: process.env });
  const raiz = new URL('../../../', import.meta.url);
  const pg = createRequire(new URL('packages/data/package.json', raiz))('pg') as {
    Client: new (o: {
      connectionString: string;
    }) => Cliente & { connect(): Promise<void>; end(): Promise<void> };
  };
  const cliente = new pg.Client({ connectionString: cadena });
  await cliente.connect();
  try {
    const p = await fijarElReloj(
      cliente,
      argumento('archivo'),
      new Date(argumento('sim')),
      Number(argumento('factor')),
    );
    console.log(`✓ Reloj de QA: ${new Date(p.baseSim).toISOString()} ×${String(p.factor)}`);
  } finally {
    await cliente.end();
  }
}
