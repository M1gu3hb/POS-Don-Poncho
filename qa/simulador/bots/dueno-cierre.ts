/**
 * EL CIERRE DEL DÍA DEL DUEÑO. El «Cierre del día» del menú cierra la caja de ESTE aparato («el día se
 * cierra desde la terminal que tiene la caja»), así que cuando las cajeras ya cerraron las suyas el
 * dueño abre la suya (fondo $0) y cierra el día con ella. Antes comprueba lo que debe impedirse:
 * cerrar el día con una mesa abierta. Si lo deja, es un incidente crítico.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Page } from '@playwright/test';

import { consultar, llamar } from '../api-app.ts';
import type { Bot, ContextoDelBot } from '../bot.ts';
import { abrirCaja, estadoDeLaCaja, irACaja } from '../pantallas/caja.ts';
import { cierreDelDia } from '../pantallas/corte.ts';
import { registrarFallo } from './comun.ts';

const MESA_DEL_ENSAYO = 20;

async function abrirUnaMesa(pagina: Page): Promise<string> {
  const mesas = await consultar<{ id: string; numero: number }>(pagina, 'Mesa');
  const mesa = mesas.find((m) => m.numero === MESA_DEL_ENSAYO);
  if (mesa === undefined) throw new Error(`No hay mesa ${String(MESA_DEL_ENSAYO)}.`);
  const abierta = await llamar(pagina, '/api/restaurante/abrir-mesa', {
    mesaId: mesa.id,
    personas: 2,
  });
  if (!abierta.ok) throw new Error(`abrir-mesa: ${String(abierta.estado)} ${abierta.mensaje}`);
  return String(abierta.datos['ordenId']);
}

export async function cierreDelDiaDelDueno(
  ctx: ContextoDelBot,
  bot: Bot,
  pagina: Page,
  carpeta: string,
): Promise<void> {
  const lugar = { bot, pantalla: 'Dueño → Cierre del día' };
  const url = ctx.entorno.appUrl;
  await irACaja(pagina, url);
  if ((await estadoDeLaCaja(pagina)) === 'cerrada') {
    // Con las dos cajas del día aún abiertas (el cupo es de 2) la suya no abre y el Cierre del día
    // dice «No hay ninguna caja abierta que cerrar» (días 1 a 3: el bot se caía buscando el conteo).
    // Es consecuencia de lo que dejó abiertas las cajas, que ya tiene su incidente: se dice y se sigue.
    const abierta = await abrirCaja(pagina, 0, 'Caja del dueño para el cierre del día').then(
      () => true,
      () => false,
    );
    if (!abierta || (await estadoDeLaCaja(pagina)) !== 'abierta') {
      await ctx.incidente(
        {
          pantalla: lugar.pantalla,
          hizo: 'Abrí mi caja para hacer el Cierre del día',
          esperaba: 'Las cajas del día ya cerraron y la mía abre',
          paso: 'Las cajas del día siguen abiertas: la del dueño no abre y no hay Cierre del día que hacer',
          gravedad: 'medio',
          clase: 'prueba',
          reproducido: 'no intentado',
        },
        pagina,
      );
      return;
    }
    ctx.libro.anotar(bot.nombre, { tipo: 'apertura', caja: 'Caja del dueño', contadoCentavos: 0 });
  }
  const resultado: { conMesaAbierta: string; cerro: boolean; aviso: string } = {
    conMesaAbierta: 'no probado',
    cerro: false,
    aviso: '',
  };
  let ordenAbierta: string | null = null;
  try {
    const ordenId = await abrirUnaMesa(pagina);
    ordenAbierta = ordenId;
    const intento = await cierreDelDia(pagina, url, 0);
    resultado.conMesaAbierta = intento.cerro ? 'cerró (mal)' : 'impedido (bien)';
    if (intento.cerro) {
      await ctx.incidente(
        {
          pantalla: lugar.pantalla,
          hizo: `Cerré el día con la mesa ${String(MESA_DEL_ENSAYO)} abierta`,
          esperaba: 'El sistema se niega y dice qué mesa falta',
          paso: 'El día quedó cerrado',
          gravedad: 'critico',
          clase: 'dinero',
          reproducido: 'no intentado',
        },
        pagina,
      );
    } else {
      ctx.libro.anotar(bot.nombre, {
        tipo: 'cambio_en_vivo',
        que: 'cierre del día con una mesa abierta',
        antes: 'mesa abierta',
        despues: `impedido: ${intento.aviso.slice(0, 80)}`,
      });
    }
    const cancelada = await llamar(pagina, '/api/restaurante/cancelar-orden', {
      ordenId,
      motivo: 'La mesa del ensayo del cierre del día',
    });
    if (!cancelada.ok)
      throw new Error(`cancelar-orden: ${String(cancelada.estado)} ${cancelada.mensaje}`);
    ordenAbierta = null;
    if (intento.cerro) return;
    const final = await cierreDelDia(pagina, url, 0);
    resultado.cerro = final.cerro;
    resultado.aviso = final.aviso;
    ctx.libro.anotar(bot.nombre, {
      tipo: 'corte',
      caja: 'Caja del dueño',
      contadoCentavos: 0,
      esperadoCentavos: 0,
    });
    if (!final.cerro)
      await registrarFallo(
        ctx,
        lugar,
        pagina,
        'Cierre del día con todo cobrado',
        'El día cierra',
        final.aviso,
        'alto',
      );
  } catch (error: unknown) {
    await registrarFallo(
      ctx,
      lugar,
      pagina,
      'Cierre del día',
      'El día cierra y baja su PDF',
      error,
      'alto',
    );
  } finally {
    // Pase lo que pase, la mesa del ensayo no se queda abierta.
    if (ordenAbierta !== null)
      await llamar(pagina, '/api/restaurante/cancelar-orden', {
        ordenId: ordenAbierta,
        motivo: 'La mesa del ensayo del cierre del día',
      });
    writeFileSync(join(carpeta, 'cierre-del-dia.json'), JSON.stringify(resultado));
  }
}
