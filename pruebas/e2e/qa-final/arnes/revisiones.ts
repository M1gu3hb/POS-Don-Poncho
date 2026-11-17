import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import type { Page, TestInfo } from '@playwright/test';

import { medirAccesibilidad } from './accesibilidad.ts';
import { aparatoDe } from './prueba.ts';
import { instalarAyudas } from './en-pagina.ts';
import { excepcionesDe, type Excepcion44 } from './excepciones-44.ts';
import { CONSOLA_EXPLICADA, RESPUESTAS_EXPLICADAS, type Explicacion } from './explicados.ts';
import { registrarRevision, relativaALaRaiz, rutaDeCaptura } from './informe.ts';
import { medirDisposicion } from './medidas/disposicion.ts';
import { medirGeometria } from './medidas/geometria.ts';
import { medirTocables } from './medidas/tocables.ts';
import {
  describir,
  type Hallazgo,
  type Informativo,
  type ModoDeRevision,
  type ResultadoDeRevision,
} from './tipos.ts';
import { tomarLoVisto, vigilarPagina } from './vigilancia.ts';
import { motorDe } from './aparatos.ts';

/**
 * `revisarPantalla`: UNA función que se llama en cada pantalla y en cada estado, y corre TODO:
 *
 *  1. sin scroll horizontal de la página y sin texto cortado (la elipsis intencional sale aparte);
 *  2. sin tocables encimados, y con el centro de cada uno alcanzable (`elementFromPoint`);
 *  3. tarjetas de una fila del mismo alto y campos de una fila alineados (1 px de tolerancia);
 *  4. blancos principales de 44 px por componente (excepciones justificadas en `excepciones-44.ts`);
 *  5. axe-core sin violaciones `serious` ni `critical`, con contraste AA;
 *  6. 0 errores de consola sin explicar y 0 respuestas 4xx/5xx inesperadas;
 *  7. la captura y el informe en JSON (`informe.ts`).
 *
 * Devuelve hallazgos con datos (tipo, selector legible, texto, medidas). Dos modos: `estricto` (el
 * por omisión: lanza con la lista) y `barrido` (junta y sigue). `extras` suma otras revisiones del
 * arnés (un gesto, el teclado) al mismo resultado. Si hay un diálogo abierto, sólo se mide lo de
 * dentro (lo de atrás está tapado a propósito).
 */

export interface OpcionesDeRevision {
  readonly pantalla: string;
  readonly estado: string;
  readonly modo?: ModoDeRevision;
  /** Otras revisiones del arnés que se suman al resultado: `() => revisarTeclado(...)`, un gesto… */
  readonly extras?: readonly (() => Promise<readonly Hallazgo[]>)[];
  readonly consolaExplicada?: readonly Explicacion[];
  readonly respuestasExplicadas?: readonly Explicacion[];
  readonly excepciones44?: readonly Excepcion44[];
  /** Salta las revisiones que no vienen al caso (p. ej. `axe` en una página de calibración sin título). */
  readonly omitir?: readonly ('accesibilidad' | 'captura')[];
}

async function capturar(
  page: Page,
  pantalla: string,
  aparato: string,
  estado: string,
): Promise<{ captura: string | null; fallo: Hallazgo | null }> {
  const ruta = rutaDeCaptura(pantalla, aparato, estado);
  mkdirSync(dirname(ruta), { recursive: true });
  try {
    await page.screenshot({ path: ruta, timeout: 15_000 });
    return { captura: relativaALaRaiz(ruta), fallo: null };
  } catch (error: unknown) {
    return {
      captura: null,
      fallo: {
        tipo: 'captura',
        selector: 'página',
        texto: '',
        medidas: {},
        detalle: `no salió la captura: ${error instanceof Error ? error.message.slice(0, 160) : String(error)}`,
      },
    };
  }
}

export async function revisarPantalla(
  page: Page,
  info: TestInfo,
  opciones: OpcionesDeRevision,
): Promise<ResultadoDeRevision> {
  const aparato = aparatoDe(info);
  const motor = motorDe(aparato);
  vigilarPagina(page);
  await page.waitForLoadState('domcontentloaded');
  await instalarAyudas(page);

  const geometria = await medirGeometria(page);
  const tocables = await medirTocables(page, {
    excepciones: excepcionesDe(opciones.pantalla, opciones.excepciones44),
  });
  const disposicion = await medirDisposicion(page);
  const accesibilidad =
    opciones.omitir?.includes('accesibilidad') === true ? [] : await medirAccesibilidad(page);
  const extras: Hallazgo[] = [];
  for (const extra of opciones.extras ?? []) extras.push(...(await extra()));
  const visto = tomarLoVisto(page, {
    consola: [...CONSOLA_EXPLICADA, ...(opciones.consolaExplicada ?? [])],
    respuestas: [...RESPUESTAS_EXPLICADAS, ...(opciones.respuestasExplicadas ?? [])],
  });
  const foto =
    opciones.omitir?.includes('captura') === true
      ? { captura: null, fallo: null }
      : await capturar(page, opciones.pantalla, aparato.id, opciones.estado);

  const hallazgos: Hallazgo[] = [
    ...geometria.hallazgos,
    ...tocables.hallazgos,
    ...disposicion,
    ...accesibilidad,
    ...extras,
    ...visto.hallazgos,
    ...(foto.fallo === null ? [] : [foto.fallo]),
  ];
  const informativos: Informativo[] = [
    ...geometria.informativos,
    ...tocables.informativos,
    ...visto.informativos,
  ];
  const resultado: ResultadoDeRevision = {
    pantalla: opciones.pantalla,
    estado: opciones.estado,
    aparato: aparato.id,
    motor: `${motor.corre}${motor.version === null ? '' : ` ${motor.version}`}`,
    hallazgos,
    informativos,
    captura: foto.captura,
  };
  registrarRevision(resultado);
  if ((opciones.modo ?? 'estricto') === 'estricto' && hallazgos.length > 0) {
    throw new Error(
      `${opciones.pantalla} · ${opciones.estado} · ${aparato.id}: ${String(hallazgos.length)} hallazgos\n${hallazgos.map((h) => `  ${describir(h)}`).join('\n')}`,
    );
  }
  return resultado;
}
