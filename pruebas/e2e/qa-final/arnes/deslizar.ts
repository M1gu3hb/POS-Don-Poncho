import type { Locator, Page } from '@playwright/test';

import { dedos, type Objetivo } from './dedos.ts';
import { dosCuadros, esperarQuietud } from './quietud.ts';
import { concluir, prepararGesto, type ResultadoDeGesto } from './resultado-de-gesto.ts';

/**
 * DESLIZAR PARA DESPLAZAR, en los dos sentidos y dentro de listas anidadas, midiendo QUIÉN se movió.
 *
 * Bajo el dedo hay una cadena de contenedores que se pueden desplazar (la lista, el panel, la
 * página). El correcto es el primero, de adentro hacia afuera, que todavía puede avanzar hacia donde
 * se desliza: ése tiene que moverse, y los de más afuera NO (salvo que el de adentro llegue a su tope
 * y el motor encadene el desplazamiento). Con `contenedor` se exige uno en concreto.
 *
 * El dedo se mueve al revés del contenido: para ir «abajo» el dedo sube.
 */

export type Sentido = 'abajo' | 'arriba' | 'derecha' | 'izquierda';

export interface OpcionesDeDeslizar {
  readonly sentido: Sentido;
  /** Píxeles de CSS que recorre el dedo (200 por omisión). */
  readonly distancia?: number;
  /** El contenedor que DEBE moverse (si no se dice, el primero que pueda, de adentro hacia afuera). */
  readonly contenedor?: Locator;
}

interface Eslabon {
  readonly selector: string;
  readonly puedeAvanzar: boolean;
  readonly x0: number;
  readonly y0: number;
}

async function cadenaBajoElDedo(
  page: Page,
  punto: { x: number; y: number },
  vertical: boolean,
  signo: number,
): Promise<Eslabon[]> {
  return page.evaluate(
    ({ x, y, vert, sig }) => {
      const lib = (window as unknown as { __arnes: { nombre(e: Element): string } }).__arnes;
      const lista: Element[] = [];
      for (let e = document.elementFromPoint(x, y); e !== null; e = e.parentElement) {
        const est = getComputedStyle(e);
        const modo = vert ? est.overflowY : est.overflowX;
        const sobra = vert ? e.scrollHeight - e.clientHeight : e.scrollWidth - e.clientWidth;
        const raiz = e === document.documentElement || e === document.body;
        if ((['auto', 'scroll', 'overlay'].includes(modo) || raiz) && sobra > 1) lista.push(e);
      }
      (window as unknown as { __arnesCadena: Element[] }).__arnesCadena = lista;
      const pos = (e: Element): number => (vert ? e.scrollTop : e.scrollLeft);
      const tope = (e: Element): number =>
        vert ? e.scrollHeight - e.clientHeight : e.scrollWidth - e.clientWidth;
      return lista.map((e) => ({
        selector: lib.nombre(e),
        puedeAvanzar: sig > 0 ? pos(e) < tope(e) - 1 : pos(e) > 1,
        x0: e.scrollLeft,
        y0: e.scrollTop,
      }));
    },
    { x: punto.x, y: punto.y, vert: vertical, sig: signo },
  );
}

export async function deslizar(
  page: Page,
  desde: Objetivo,
  opciones: OpcionesDeDeslizar,
): Promise<ResultadoDeGesto> {
  const inicio = await prepararGesto(page, desde);
  const distancia = opciones.distancia ?? 200;
  const vertical = opciones.sentido === 'abajo' || opciones.sentido === 'arriba';
  const signo = opciones.sentido === 'abajo' || opciones.sentido === 'derecha' ? 1 : -1;
  const cadena = await cadenaBajoElDedo(page, inicio, vertical, signo);
  const antes = await opciones.contenedor?.evaluate((e) => ({ x: e.scrollLeft, y: e.scrollTop }));

  const pasos = 12;
  await dedos(page, 'touchStart', [inicio]);
  for (let paso = 1; paso <= pasos; paso += 1) {
    const avance = (-signo * distancia * paso) / pasos;
    await dedos(page, 'touchMove', [
      { x: inicio.x + (vertical ? 0 : avance), y: inicio.y + (vertical ? avance : 0) },
    ]);
    await dosCuadros(page);
  }
  await dedos(page, 'touchEnd', []);
  await esperarQuietud(page);

  const despues = await page.evaluate(() =>
    (window as unknown as { __arnesCadena: Element[] }).__arnesCadena.map((e) => ({
      x: e.scrollLeft,
      y: e.scrollTop,
    })),
  );
  const avanzo = (i: number): number => {
    const d = despues[i];
    const c = cadena[i];
    if (d === undefined || c === undefined) return 0;
    return (vertical ? d.y - c.y0 : d.x - c.x0) * signo;
  };
  const problemas: string[] = [];
  const primero = cadena.findIndex((c) => c.puedeAvanzar);
  if (opciones.contenedor !== undefined && antes !== undefined) {
    const ahora = await opciones.contenedor.evaluate((e) => ({ x: e.scrollLeft, y: e.scrollTop }));
    const delta = (vertical ? ahora.y - antes.y : ahora.x - antes.x) * signo;
    if (delta <= 1) problemas.push('el contenedor esperado no se desplazó');
  } else if (primero === -1) {
    problemas.push('no hay ningún contenedor que pueda desplazarse hacia allá bajo el dedo');
  } else if (avanzo(primero) <= 1) {
    problemas.push(`no se movió ${cadena[primero]?.selector ?? 'el contenedor interior'}`);
  } else {
    // Uno más afuera sólo puede moverse si el de adentro llegó a su tope (encadenamiento).
    const dentroLlego = avanzo(primero) < distancia - 1;
    for (let i = primero + 1; i < cadena.length; i += 1) {
      if (avanzo(i) > 1 && !dentroLlego) {
        problemas.push(`se movió también ${cadena[i]?.selector ?? '?'} (${String(avanzo(i))} px)`);
      }
    }
  }
  const resultado = await concluir(page, 'deslizar', inicio, false, {
    sentido: opciones.sentido,
    distancia,
    movidos: cadena.map((c, i) => `${c.selector} ${String(avanzo(i))}px`).join(' | '),
  });
  return { ...resultado, problemas: [...resultado.problemas, ...problemas] };
}
