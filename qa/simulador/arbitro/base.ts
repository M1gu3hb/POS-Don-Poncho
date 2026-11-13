/**
 * LA BASE DEL ÁRBITRO: leer la copia en SÓLO LECTURA (una transacción `read only` que siempre se
 * cierra con `rollback`; jamás un `SET` de sesión) y juntar las comparaciones y sus diferencias.
 * Cada diferencia es un incidente de dinero o de inventario con lo esperado y lo real.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { exigirCopiaLocal } from '../candado.ts';
import type { Clase, Gravedad } from '../incidentes.ts';

export interface Diferencia {
  readonly fuente: string;
  readonly concepto: string;
  readonly esperado: string;
  readonly real: string;
  readonly clase: Clase;
  readonly gravedad: Gravedad;
}

export interface ResultadoDelArbitro {
  readonly dia: number;
  readonly comparaciones: number;
  readonly iguales: number;
  readonly diferencias: readonly Diferencia[];
  readonly porFuente: Readonly<
    Record<string, { readonly comparaciones: number; readonly diferencias: number }>
  >;
}

export interface Comparador {
  comparar(
    fuente: string,
    concepto: string,
    esperado: number | string,
    real: number | string,
    clase?: Clase,
    gravedad?: Gravedad,
  ): void;
  /** Una violación de una invariante (siempre es una diferencia). */
  violacion(
    fuente: string,
    concepto: string,
    detalle: string,
    clase?: Clase,
    gravedad?: Gravedad,
  ): void;
  resultado(dia: number): ResultadoDelArbitro;
}

export function crearComparador(): Comparador {
  const diferencias: Diferencia[] = [];
  const por = new Map<string, { comparaciones: number; diferencias: number }>();
  let total = 0;
  const cuenta = (fuente: string, hubo: boolean) => {
    const c = por.get(fuente) ?? { comparaciones: 0, diferencias: 0 };
    c.comparaciones += 1;
    if (hubo) c.diferencias += 1;
    por.set(fuente, c);
    total += 1;
  };
  return {
    comparar(fuente, concepto, esperado, real, clase = 'dinero', gravedad = 'critico') {
      const hubo = String(esperado) !== String(real);
      cuenta(fuente, hubo);
      if (hubo)
        diferencias.push({
          fuente,
          concepto,
          esperado: String(esperado),
          real: String(real),
          clase,
          gravedad,
        });
    },
    violacion(fuente, concepto, detalle, clase = 'dinero', gravedad = 'critico') {
      cuenta(fuente, true);
      diferencias.push({
        fuente,
        concepto,
        esperado: 'ninguna fila que viole la regla',
        real: detalle,
        clase,
        gravedad,
      });
    },
    resultado(dia) {
      return {
        dia,
        comparaciones: total,
        iguales: total - diferencias.length,
        diferencias,
        porFuente: Object.fromEntries(por),
      };
    },
  };
}

/** Los centavos como los dice el sistema (`bigint` llega como texto). */
export const num = (valor: unknown): number => Number(valor ?? 0);

interface ClientePg {
  connect(): Promise<void>;
  query(texto: string, valores?: readonly unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  end(): Promise<void>;
}

function abrirCliente(baseUrl: string): ClientePg {
  exigirCopiaLocal({ databaseUrl: baseUrl, entorno: process.env });
  const raiz = fileURLToPath(new URL('../../../', import.meta.url));
  const requerir = createRequire(`${raiz}packages/data/package.json`);
  const pg = requerir('pg') as {
    Client: new (opciones: { connectionString: string }) => ClientePg;
  };
  return new pg.Client({ connectionString: baseUrl });
}

/** Una consulta de SÓLO LECTURA contra la copia. */
export async function leerSql<T extends object>(
  baseUrl: string,
  texto: string,
  valores: readonly unknown[] = [],
): Promise<readonly T[]> {
  const cliente = abrirCliente(baseUrl);
  await cliente.connect();
  try {
    await cliente.query('begin read only');
    const r = await cliente.query(texto, valores);
    return r.rows as T[];
  } finally {
    await cliente.query('rollback').catch((error: unknown) => {
      process.stderr.write(`rollback del árbitro: ${String(error)}\n`);
    });
    await cliente.end();
  }
}

export const ORGANIZACION = "(select id from organizaciones where slug = 'don-poncho')";
