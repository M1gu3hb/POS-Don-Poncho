/**
 * EL CAOS PROGRAMADO DE LA DUEÑA (DP-22, el día de bots): en su Windows 1920×1080 táctil, a las horas
 * de `CAOS_DEL_DIA`, cambia a media operación lo que DP-D155 dice que se puede cambiar (el IVA, quién
 * elige la propina, el cupo y el nombre de las cajas, el portal, una estación y una categoría nuevas,
 * a qué estación va una categoría, mover una mesa en el editor), da de alta a un mesero a medio día,
 * da de baja a otro con mesas abiertas (y le pasa sus mesas a quienes siguen) y apaga la tableta de
 * un mesero un rato. Cada paso se intenta UNA vez, se anota en el libro y queda en
 * `<salida>/caos-dp22.json` como hecho, rechazado por el servidor o fallido: el informe lo cuenta.
 *
 * Lo que el servidor RECHAZA a propósito (bajar el cupo con cajas abiertas) no es un incidente: se
 * anota como «rechazado». Lo que la pantalla no deja hacer a la dueña SÍ lo es.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import type { Page } from '@playwright/test';

import {
  APARATOS_DEL_DIA,
  CAOS_DEL_DIA,
  PERSONAL_DEL_CAOS,
  minutoDelReloj,
} from '../perfil-dp22.ts';
import type { Bot, ContextoDelBot } from '../bot.ts';
import { asegurarPin } from '../dia0/pines.ts';
import { minutoDelDia } from '../horario.ts';
import { contar } from '../mundo.ts';
import {
  asignarLaCategoria,
  crearLaCategoria,
  crearLaEstacion,
  darDeAltaAlMesero,
  desactivarAlUsuario,
  fijarElCupoDeCajas,
  fijarElIva,
  fijarElPortal,
  fijarQuienEligeLaPropina,
  moverLaMesa,
  nombrarLaCaja,
  repartirLasMesas,
} from '../pantallas/salon-y-ajustes.ts';
import { asegurarSesion } from '../sesion.ts';
import { abrirSesion } from './comun.ts';

export type EstadoDelPaso = 'hecho' | 'rechazado' | 'fallo';

export interface ResultadoDelPaso {
  readonly id: string;
  readonly que: string;
  readonly enMinuto: number;
  /** La hora simulada (HH:MM) en que se intentó. */
  readonly hora: string;
  readonly estado: EstadoDelPaso;
  readonly detalle: string;
}

const DUENA = 'Dueño Don Poncho';
/** Lo que se espera (real) a que el mesero dado de baja entregue sus cuentas antes de desactivarlo. */
const ESPERA_DE_LA_ENTREGA_MS = 150_000;

interface Cx {
  readonly ctx: ContextoDelBot;
  readonly pagina: Page;
  readonly url: string;
}

/** Cada paso devuelve lo que quedó dicho en el informe; lanza si la pantalla no lo dejó hacer. */
type Paso = (c: Cx) => Promise<{ estado: EstadoDelPaso; detalle: string }>;

const hecho = (detalle: string): { estado: EstadoDelPaso; detalle: string } => ({
  estado: 'hecho',
  detalle,
});

function cambio(ctx: ContextoDelBot, que: string, antes: string, despues: string): void {
  ctx.libro.anotar('Dueño (caos)', { tipo: 'cambio_en_vivo', que, antes, despues });
}

const TODAS = { comensales: true, mesero: true, caja: true } as const;

const REPARTO_DE_DOS = [
  { mesero: 'Mesero 1', mesas: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  { mesero: 'Mesero 2', mesas: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20] },
] as const;
const REPARTO_DE_TRES = [
  { mesero: 'Mesero 1', mesas: [1, 2, 3, 4, 5, 6, 7] },
  { mesero: 'Mesero 2', mesas: [11, 12, 13, 14, 15, 16, 17] },
  { mesero: 'Mesero 7', mesas: [8, 9, 10, 18, 19, 20] },
] as const;
const REPARTO_SIN_EL_QUE_SE_FUE = [
  { mesero: 'Mesero 1', mesas: [1, 2, 3, 4, 5, 6, 7, 11, 12, 13] },
  { mesero: 'Mesero 7', mesas: [8, 9, 10, 14, 15, 16, 17, 18, 19, 20] },
] as const;

const PASOS: Readonly<Record<string, Paso>> = {
  P1: async ({ pagina, url }) => {
    await fijarQuienEligeLaPropina(pagina, url, TODAS);
    return hecho('comensales, mesero y Caja pueden elegir la propina');
  },
  P2: async ({ pagina, url }) => {
    const r = await fijarElCupoDeCajas(pagina, url, 1);
    return r.aceptado ? hecho('cupo de 1 caja') : { estado: 'rechazado', detalle: r.aviso };
  },
  P3: async ({ pagina, url }) => {
    await repartirLasMesas(pagina, url, REPARTO_DE_DOS);
    return hecho('mesas 1 a 10 con Mesero 1 y 11 a 20 con Mesero 2');
  },
  C1: async ({ ctx, pagina, url }) => {
    const antes = await fijarElIva(pagina, url, '8 %');
    cambio(ctx, 'IVA', antes, '8 %');
    return hecho(`IVA de ${antes} a 8 %`);
  },
  C1r: async ({ ctx, pagina, url }) => {
    const antes = await fijarElIva(pagina, url, '16 %');
    cambio(ctx, 'IVA', antes, '16 %');
    return hecho(`IVA de ${antes} a 16 %`);
  },
  C2: async ({ ctx, pagina, url }) => {
    await fijarQuienEligeLaPropina(pagina, url, { ...TODAS, mesero: false });
    cambio(ctx, 'quién elige la propina', 'comensales, mesero y Caja', 'comensales y Caja');
    return hecho('el mesero ya no elige la propina');
  },
  C2r: async ({ ctx, pagina, url }) => {
    await fijarQuienEligeLaPropina(pagina, url, TODAS);
    cambio(ctx, 'quién elige la propina', 'comensales y Caja', 'comensales, mesero y Caja');
    return hecho('el mesero vuelve a elegir la propina');
  },
  C6: async ({ ctx, pagina, url }) => {
    const r = await fijarElCupoDeCajas(pagina, url, 2);
    cambio(ctx, 'cajas abiertas a la vez', '1', '2');
    if (r.aceptado) contar(ctx.mundo, 'cupo_de_dos_cajas');
    return r.aceptado ? hecho('cupo de 2 cajas') : { estado: 'rechazado', detalle: r.aviso };
  },
  C7: async ({ ctx, pagina, url }) => {
    await nombrarLaCaja(pagina, url, 1, PERSONAL_DEL_CAOS.nombreDeLaCaja);
    cambio(ctx, 'nombre de la caja 1', 'Caja 1', PERSONAL_DEL_CAOS.nombreDeLaCaja);
    return hecho(`la caja 1 se llama «${PERSONAL_DEL_CAOS.nombreDeLaCaja}»`);
  },
  C7r: async ({ ctx, pagina, url }) => {
    await nombrarLaCaja(pagina, url, 1, '');
    cambio(ctx, 'nombre de la caja 1', PERSONAL_DEL_CAOS.nombreDeLaCaja, 'Caja 1');
    return hecho('la caja 1 recupera su nombre');
  },
  C8: async ({ ctx, pagina, url }) => {
    await fijarElPortal(pagina, url, false);
    cambio(ctx, 'portal del comensal', 'encendido', 'apagado');
    return hecho(`portal apagado con ${String(ctx.mundo.portal.size)} mesas del portal abiertas`);
  },
  C8r: async ({ ctx, pagina, url }) => {
    await fijarElPortal(pagina, url, true);
    cambio(ctx, 'portal del comensal', 'apagado', 'encendido');
    return hecho('portal encendido');
  },
  S1: async ({ pagina, url }) => {
    const movimientos: string[] = [];
    for (const numero of PERSONAL_DEL_CAOS.mesasQueSeMueven) {
      const m = await moverLaMesa(pagina, url, numero, 110, 70);
      movimientos.push(
        `mesa ${String(numero)} de (${String(m.antes.x)}, ${String(m.antes.y)}) a (${String(m.despues.x)}, ${String(m.despues.y)})`,
      );
    }
    return hecho(movimientos.join('; '));
  },
  S1r: async ({ pagina, url }) => {
    const movimientos: string[] = [];
    for (const numero of PERSONAL_DEL_CAOS.mesasQueSeMueven) {
      const m = await moverLaMesa(pagina, url, numero, -110, -70);
      movimientos.push(`mesa ${String(numero)} a (${String(m.despues.x)}, ${String(m.despues.y)})`);
    }
    return hecho(movimientos.join('; '));
  },
  K1: async ({ ctx, pagina, url }) => {
    const estacion = await crearLaEstacion(pagina, url, PERSONAL_DEL_CAOS.estacionNueva);
    const categoria = await crearLaCategoria(pagina, url, PERSONAL_DEL_CAOS.categoriaNueva);
    await asignarLaCategoria(
      pagina,
      url,
      PERSONAL_DEL_CAOS.categoriaNueva,
      PERSONAL_DEL_CAOS.estacionNueva,
    );
    cambio(
      ctx,
      'estación y categoría nuevas',
      '',
      `${PERSONAL_DEL_CAOS.estacionNueva} / ${PERSONAL_DEL_CAOS.categoriaNueva}`,
    );
    return hecho(
      `estación ${estacion ? 'creada' : 'ya existía'}, categoría ${categoria ? 'creada' : 'ya existía'}, asignadas entre sí`,
    );
  },
  K2: async ({ ctx, pagina, url }) => {
    await asignarLaCategoria(
      pagina,
      url,
      PERSONAL_DEL_CAOS.categoriaQueSeReasigna,
      PERSONAL_DEL_CAOS.estacionTemporal,
    );
    cambio(
      ctx,
      `estación de «${PERSONAL_DEL_CAOS.categoriaQueSeReasigna}»`,
      PERSONAL_DEL_CAOS.estacionOriginal,
      PERSONAL_DEL_CAOS.estacionTemporal,
    );
    return hecho(
      `«${PERSONAL_DEL_CAOS.categoriaQueSeReasigna}» pasa a ${PERSONAL_DEL_CAOS.estacionTemporal}`,
    );
  },
  K2r: async ({ ctx, pagina, url }) => {
    await asignarLaCategoria(
      pagina,
      url,
      PERSONAL_DEL_CAOS.categoriaQueSeReasigna,
      PERSONAL_DEL_CAOS.estacionOriginal,
    );
    cambio(
      ctx,
      `estación de «${PERSONAL_DEL_CAOS.categoriaQueSeReasigna}»`,
      PERSONAL_DEL_CAOS.estacionTemporal,
      PERSONAL_DEL_CAOS.estacionOriginal,
    );
    return hecho(
      `«${PERSONAL_DEL_CAOS.categoriaQueSeReasigna}» vuelve a ${PERSONAL_DEL_CAOS.estacionOriginal}`,
    );
  },
  M1: async ({ ctx, pagina, url }) => {
    const { pin } = asegurarPin(ctx.entorno.archivoPines, PERSONAL_DEL_CAOS.meseroNuevo);
    await darDeAltaAlMesero(pagina, url, PERSONAL_DEL_CAOS.meseroNuevo, pin);
    contar(ctx.mundo, 'mesero_nuevo_dado_de_alta');
    cambio(ctx, 'personal', '', `alta de ${PERSONAL_DEL_CAOS.meseroNuevo}`);
    return hecho(`${PERSONAL_DEL_CAOS.meseroNuevo} dado de alta`);
  },
  M2: async ({ pagina, url }) => {
    await repartirLasMesas(pagina, url, REPARTO_DE_TRES);
    return hecho('mesas repartidas entre Mesero 1, Mesero 2 y Mesero 7');
  },
  M3: async ({ ctx, pagina, url }) => {
    const quien = PERSONAL_DEL_CAOS.meseroQueSeVa;
    // El bot del mesero deja de operar (su sesión se va a revocar) y entrega sus cuentas abiertas.
    ctx.mundo.meserosFuera.add(quien);
    const limite = Date.now() + ESPERA_DE_LA_ENTREGA_MS;
    while (
      !ctx.terminado() &&
      Date.now() < limite &&
      !ctx.mundo.volumen.has('cuentas_dejadas_por_un_mesero_dado_de_baja')
    )
      await new Promise((r) => setTimeout(r, 1_000));
    const abiertas = ctx.mundo.cuentasSinMesero.length;
    await desactivarAlUsuario(pagina, url, quien);
    cambio(ctx, 'personal', quien, `${quien} desactivado con ${String(abiertas)} cuentas abiertas`);
    await repartirLasMesas(pagina, url, REPARTO_SIN_EL_QUE_SE_FUE);
    ctx.mundo.adopcionAbierta = true;
    return hecho(
      `${quien} desactivado con ${String(abiertas)} cuentas abiertas; sus mesas pasan a Mesero 1 y Mesero 7`,
    );
  },
  A1: ({ ctx }) => {
    const vuelve = minutoDelDia(ctx.ahoraSim()) + PERSONAL_DEL_CAOS.apagonDura;
    ctx.mundo.apagones.set(PERSONAL_DEL_CAOS.meseroQueSeApaga, vuelve);
    return Promise.resolve(
      hecho(
        `la tableta de ${PERSONAL_DEL_CAOS.meseroQueSeApaga} se apaga ${String(PERSONAL_DEL_CAOS.apagonDura)} min`,
      ),
    );
  },
};

const horaDicha = (minutoDelDiaSim: number): string =>
  `${String(Math.floor(minutoDelDiaSim / 60)).padStart(2, '0')}:${String(minutoDelDiaSim % 60).padStart(2, '0')}`;

/** Los pasos que hace la dueña, por hora (el resto del caos lo hacen los bots que ya existían). */
export const PASOS_DE_LA_DUENA = CAOS_DEL_DIA.filter((p) => p.quien === 'dueno').sort(
  (a, b) => a.enMinuto - b.enMinuto,
);

export function crearBotCaosDp22(archivoDeResultados: string): Bot {
  const resultados: ResultadoDelPaso[] = [];
  const guardar = (): void => {
    mkdirSync(dirname(archivoDeResultados), { recursive: true });
    writeFileSync(archivoDeResultados, JSON.stringify(resultados, null, 2));
  };
  const bot: Bot = {
    nombre: 'Dueño (caos)',
    rol: 'caos',
    aparato: APARATOS_DEL_DIA.dueno,
    async correr(ctx) {
      const lugar = { bot, pantalla: 'Configuración y salón (caos del día)' };
      const { contexto, pagina } = await abrirSesion(ctx, DUENA, APARATOS_DEL_DIA.dueno);
      const url = ctx.entorno.appUrl;
      const pendientes = [...PASOS_DE_LA_DUENA];
      try {
        while (!ctx.terminado() && pendientes.length > 0) {
          const siguiente = pendientes[0];
          if (siguiente === undefined) break;
          if (minutoDelDia(ctx.ahoraSim()) < minutoDelReloj(siguiente.enMinuto)) {
            await ctx.esperarSim(0.5);
            continue;
          }
          pendientes.shift();
          const accion = PASOS[siguiente.id];
          const intento = (estado: EstadoDelPaso, detalle: string): void => {
            resultados.push({
              id: siguiente.id,
              que: siguiente.que,
              enMinuto: siguiente.enMinuto,
              hora: horaDicha(minutoDelDia(ctx.ahoraSim())),
              estado,
              detalle,
            });
            guardar();
          };
          if (accion === undefined) {
            intento('fallo', 'el guion no sabe hacer este paso');
            continue;
          }
          try {
            await asegurarSesion(pagina, ctx.entorno, DUENA);
            const r = await ctx.tiempos.medir(`caos:${siguiente.id}`, () =>
              accion({ ctx, pagina, url }),
            );
            intento(r.estado, r.detalle);
          } catch (error: unknown) {
            const detalle = String(error).split('\n').slice(0, 4).join(' ').slice(0, 500);
            intento('fallo', detalle);
            await ctx.incidente(
              {
                pantalla: lugar.pantalla,
                hizo: `${siguiente.que} (${siguiente.id}), por pantalla y con el dedo`,
                esperaba: 'El cambio queda guardado y la operación sigue',
                paso: detalle,
                gravedad: 'medio',
                clase: 'ui',
                reproducido: 'no intentado',
              },
              pagina,
            );
          }
        }
        // Lo que no alcanzó a hacerse porque el día terminó antes queda dicho.
        for (const p of pendientes) {
          resultados.push({
            id: p.id,
            que: p.que,
            enMinuto: p.enMinuto,
            hora: '—',
            estado: 'fallo',
            detalle: 'el día terminó antes de la hora de este paso (no se ejecutó)',
          });
        }
        guardar();
      } finally {
        await contexto.close();
      }
    },
  };
  return bot;
}

/** Los ids de caos que la dueña sabe hacer (la prueba del perfil exige que cada uno de los suyos esté aquí). */
export const IDS_QUE_SABE_HACER: readonly string[] = Object.keys(PASOS);
