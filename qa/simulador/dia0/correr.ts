/**
 * EL DÍA 0, POR PANTALLAS: el dueño deja el negocio listo antes de la semana. Idempotente.
 *
 *   node qa/simulador/dia0/correr.ts --app http://localhost:32802 --base postgres://…/qa_dp18_b \
 *     --pines D:/mpos-tmp/qa-dp18-b/pines.json --reloj D:/mpos-tmp/dp18/reloj-b.json [--solo usuarios,mesas]
 */
import { join } from 'node:path';

import { expect } from '@playwright/test';

import { aparatoPedido, CUENTA_DE_TOQUES, ponerElDedo } from '../dedo.ts';
import { leerEntorno } from '../entorno.ts';
import { abrirNavegador, sesionDe } from '../sesion.ts';

import { apagarLaEspera } from './aparato.ts';
import { crearDia0, type PasoDelDia0 } from './contexto.ts';
import { pasoCajaHeredada } from './caja-heredada.ts';
import { pasoConfiguracion } from './configuracion.ts';
import { pasoEstaciones } from './estaciones.ts';
import { pasoInventario } from './inventario.ts';
import { pasoMesas } from './mesas.ts';
import { pasoOpciones } from './opciones.ts';
import { pasoProductos } from './productos.ts';
import { pasoUsuarios } from './usuarios.ts';

// DP-21 · Las secciones de Configuración cargan sus tarjetas al leer la configuración: en la máquina de QA
// eso pasa de los 5 s que da `expect` por omisión.
expect.configure({ timeout: 30_000 });

/** El orden importa: las estaciones antes que sus cocineros y los insumos antes que las recetas. */
export const PASOS: readonly { readonly nombre: string; readonly correr: PasoDelDia0 }[] = [
  { nombre: 'estaciones', correr: pasoEstaciones },
  { nombre: 'usuarios', correr: pasoUsuarios },
  { nombre: 'mesas', correr: pasoMesas },
  { nombre: 'inventario', correr: pasoInventario },
  { nombre: 'productos', correr: pasoProductos },
  { nombre: 'opciones', correr: pasoOpciones },
  { nombre: 'configuracion', correr: pasoConfiguracion },
  { nombre: 'caja-heredada', correr: pasoCajaHeredada },
];

function elegidos(): ReadonlySet<string> | null {
  const i = process.argv.indexOf('--solo');
  const lista = i === -1 ? undefined : process.argv[i + 1];
  return lista === undefined ? null : new Set(lista.split(','));
}

async function principal(): Promise<void> {
  expect.configure({ timeout: 15_000 });
  const entorno = leerEntorno();
  const solo = elegidos();
  const navegador = await abrirNavegador();
  let fallo: unknown = null;
  try {
    // DP-22 · Con `--aparato tableta-1024` el día 0 se recorre con el DEDO (toques, no clics de ratón).
    const aparato = aparatoPedido();
    const { pagina } = await sesionDe(navegador, entorno, 'Dueño Don Poncho', aparato);
    if (aparato !== 'pc-1920') ponerElDedo(pagina);
    const d = crearDia0(entorno, pagina, join(entorno.salida, 'dia-0'));
    await apagarLaEspera(d);
    for (const paso of PASOS) {
      if (solo !== null && !solo.has(paso.nombre)) continue;
      const inicio = Date.now();
      try {
        await paso.correr(d);
        d.nota(paso.nombre, `listo en ${String(Math.round((Date.now() - inicio) / 1000))} s`);
      } catch (error: unknown) {
        await d.foto(`fallo-${paso.nombre}`);
        d.nota(paso.nombre, `FALLÓ: ${String(error).split('\n')[0] ?? ''}`);
        fallo = error;
        break;
      }
    }
  } finally {
    process.stdout.write(
      `dedo: ${String(CUENTA_DE_TOQUES.toques)} toques, ${String(CUENTA_DE_TOQUES.clicsQueSeQuedaron)} clics que no podían ser toque
`,
    );
    await navegador.close();
  }
  if (fallo !== null)
    throw fallo instanceof Error
      ? fallo
      : new Error('El día 0 falló sin un Error.', { cause: fallo });
}

if (import.meta.main) {
  principal().catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  });
}
