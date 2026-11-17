import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { Fila, Modelo } from '../../../../qa/qa-final/combinaciones/nucleo.ts';
import { revisarTabla, tablaCompleta } from '../../../../qa/qa-final/combinaciones/nucleo.ts';
import { correrFila, type FilaDeDinero } from './flujo-de-dinero.ts';
import { SECRETO, sembrarMundo, type Mundo } from './mundo.ts';

/**
 * DP-22 · FASE D · EL DINERO, COMBINADO DE A TRES, de punta a punta y contra Postgres.
 *
 * Cada renglón de `qa/qa-final/datos/combinaciones/dinero.ternas.json` (IVA × propina × descuento ×
 * división × forma de pago × canal) corre el flujo completo por los comandos de producción y se
 * compara, al centavo, con el oráculo independiente (`qa/qa-final/oraculo/dinero.ts`): la cuenta, los
 * pagos, el documento del ticket, la lectura de la pantalla, el cambio, el inventario al gramo y el
 * corte de la caja. La CI no necesita PICT: la tabla ya está guardada y se comprueba que cubre todo.
 */

vi.mock('@morphiqpos/contracts', async (original) => ({
  ...(await original<typeof import('@morphiqpos/contracts')>()),
  validarEntorno: () => ({ SESSION_SECRET: SECRETO }),
}));

const DATOS = fileURLToPath(
  new URL('../../../../qa/qa-final/datos/combinaciones/', import.meta.url),
);
const leer = (archivo: string): unknown => JSON.parse(readFileSync(`${DATOS}${archivo}`, 'utf8'));

const modelo = leer('dinero.modelo.json') as Modelo;
const tabla = leer('dinero.ternas.json') as FilaDeDinero[];

const POR_FILA = 240_000;
/** `QA_FILAS=0,5,7` o `QA_FILAS=10-20` corre sólo esos renglones (para depurar). */
function soloEstas(): ReadonlySet<number> | null {
  const texto = process.env['QA_FILAS'];
  if (texto === undefined || texto === '') return null;
  const salida = new Set<number>();
  for (const trozo of texto.split(',')) {
    const [a = '', b] = trozo.split('-');
    const desde = Number(a);
    const hasta = b === undefined ? desde : Number(b);
    for (let i = desde; i <= hasta; i += 1) salida.add(i);
  }
  return salida;
}
const elegidas = soloEstas();
let mundo: Mundo;
const derivas: bigint[] = [];

beforeAll(async () => {
  mundo = await sembrarMundo({
    nombre: 'Combinaciones de dinero',
    mesas: tabla.length,
    terminales: 1,
  });
}, 600_000);

describe('la tabla de ternas del dinero', () => {
  it('cubre TODAS las ternas válidas del modelo, sin renglones prohibidos ni repetidos', () => {
    const revision = revisarTabla(modelo, tabla as unknown as readonly Fila[]);
    expect(revision.sinCubrir).toEqual([]);
    expect(tablaCompleta(revision)).toBe(true);
  });
});

describe('cada combinación de dinero, de la mesa al corte', () => {
  it.each(
    tabla
      .map((fila, indice) => ({ fila, indice }))
      .filter(({ indice }) => elegidas === null || elegidas.has(indice)),
  )(
    '#$indice $fila.iva · $fila.propina · $fila.descuento · $fila.division · $fila.pago · $fila.canal',
    { timeout: POR_FILA },
    async ({ fila, indice }) => {
      const resultado = await correrFila(mundo, indice, fila);
      derivas.push(resultado.deriva);
      expect(resultado.fallas, resultado.fallas.join('\n')).toEqual([]);
    },
  );
});

describe('lo que dejó el conjunto', () => {
  it('cuántas combinaciones tuvieron deriva de centavos entre las partes y la cuenta entera', () => {
    const conDeriva = derivas.filter((d) => d !== 0n);
    // `QA_RESULTADOS=ruta.json` deja lo que pasó (un pase no imprime nada).
    const destino = process.env['QA_RESULTADOS'];
    if (destino !== undefined && destino !== '') {
      writeFileSync(
        destino,
        JSON.stringify({ corridas: derivas.length, conDeriva: conDeriva.map(String) }, null, 2),
      );
    }
    expect(derivas.length).toBe(elegidas === null ? tabla.length : elegidas.size);
  });
});
