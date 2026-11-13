/**
 * EL DUEÑO (PC): cuando las cajas ya cerraron mira el Tablero, recorre Registros (cortes, ventas,
 * compras, movimientos, gastos y auditoría), exporta los CSV, revisa el historial de ventas y sus
 * notas (`dueno-ventas.ts`) y hace el Cierre del día. Deja todo lo
 * que leyó en `<salida>/dia-N/dueno/` para que el árbitro lo compare contra el libro.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Bot, ContextoDelBot } from '../bot.ts';
import {
  abrirPestana,
  exportarCsv,
  irARegistros,
  textoDelTablero,
  type PestanaDeRegistros,
} from '../pantallas/registros.ts';
import { abrirSesion, medido, registrarFallo } from './comun.ts';
import { asegurarSesion } from '../sesion.ts';
import { carpetaDelDia } from '../arbitro/salida.ts';
import { cierreDelDiaDelDueno } from './dueno-cierre.ts';
import { revisarLasVentas } from './dueno-ventas.ts';

export interface PlanDelDueno {
  /** Cuántas cajas tienen que haber cerrado antes del Cierre del día. */
  readonly cajas: number;
}

const PESTANAS: readonly PestanaDeRegistros[] = [
  'Cortes',
  'Ventas',
  'Compras',
  'Movimientos',
  'Gastos',
  'Auditoría',
];
const ESPERA_A_LAS_CAJAS_MS = 5 * 60_000;

export function crearBotDueno(plan: PlanDelDueno): Bot {
  const bot: Bot = {
    nombre: 'Dueño',
    rol: 'dueno',
    aparato: 'pc-1920',
    async correr(ctx) {
      await jornada(ctx, bot, plan);
    },
  };
  return bot;
}

async function esperarAlFinDelDia(ctx: ContextoDelBot, plan: PlanDelDueno): Promise<void> {
  while (!ctx.terminado()) await ctx.esperarSim(5);
  const limite = Date.now() + ESPERA_A_LAS_CAJAS_MS;
  while ((ctx.mundo.volumen.get('cajas_cerradas') ?? 0) < plan.cajas && Date.now() < limite) {
    await new Promise((r) => setTimeout(r, 1_000));
  }
}

async function jornada(ctx: ContextoDelBot, bot: Bot, plan: PlanDelDueno): Promise<void> {
  const lugar = { bot, pantalla: 'Dueño' };
  const { contexto, pagina } = await abrirSesion(ctx, 'Dueño Don Poncho', 'pc-1920');
  const carpeta = join(carpetaDelDia(ctx.entorno.salida, ctx.entorno.dia), 'dueno');
  await esperarAlFinDelDia(ctx, plan);
  // Entró a las 8:00 y lee al cierre, más de 8 h después: su sesión ya venció (quinta corrida del
  // día 1: el bot se cayó y no bajó el CSV ni leyó el Tablero). Vuelve a entrar antes de leer.
  try {
    await asegurarSesion(pagina, ctx.entorno, 'Dueño Don Poncho');
  } catch (error: unknown) {
    await registrarFallo(ctx, lugar, pagina, 'Volver a entrar', 'La sesión del dueño sigue', error);
  }
  const url = ctx.entorno.appUrl;
  try {
    const tablero = await medido(ctx, lugar, pagina, 'abrir el Tablero', () =>
      textoDelTablero(pagina, url),
    );
    writeFileSync(join(carpeta.replaceAll('\\', '/'), 'tablero.txt'), tablero);
  } catch (error: unknown) {
    await registrarFallo(
      ctx,
      lugar,
      pagina,
      'Leer el Tablero',
      'El Tablero enseña las ventas del día',
      error,
    );
  }
  const conteos: Record<string, string> = {};
  try {
    await irARegistros(pagina, url);
    for (const nombre of PESTANAS) {
      const { rotulo } = await abrirPestana(pagina, nombre);
      conteos[nombre] = rotulo;
      if (nombre !== 'Auditoría') {
        await exportarCsv(pagina, join(carpeta, `registros-${nombre.toLowerCase()}.csv`)).catch(
          (error: unknown) =>
            registrarFallo(
              ctx,
              lugar,
              pagina,
              `Exportar el CSV de ${nombre}`,
              'Baja un CSV',
              error,
            ),
        );
      }
    }
  } catch (error: unknown) {
    await registrarFallo(
      ctx,
      lugar,
      pagina,
      'Recorrer Registros',
      'Cada pestaña abre y cuenta lo del día',
      error,
    );
  }
  writeFileSync(join(carpeta, 'registros-conteos.json'), JSON.stringify(conteos, null, 2));
  await revisarLasVentas(ctx, bot, pagina);
  await cierreDelDiaDelDueno(ctx, bot, pagina, carpeta);
  await contexto.close();
}
