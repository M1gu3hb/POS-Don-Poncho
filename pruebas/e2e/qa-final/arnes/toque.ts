import type { Page } from '@playwright/test';

import { dedos, puntoDe, type Objetivo, type Punto } from './dedos.ts';
import { modelarSeleccionDeAndroid, simularMenuDeWindows } from './espia-de-gestos.ts';
import { dosCuadros, esperarQuietud } from './quietud.ts';
import { concluir, dondeCae, prepararGesto, type ResultadoDeGesto } from './resultado-de-gesto.ts';

/**
 * EL TOQUE DE VERDAD (DP-22): toque, toque doble, pulsación larga, menú contextual, arrastrar y
 * pellizco, todos con el dedo (`dedos.ts`), no con clics. Deslizar para desplazar vive en
 * `deslizar.ts`. Cada gesto comprueba y devuelve (`resultado-de-gesto.ts`) que no quedó texto
 * seleccionado y que no salió el menú del sistema; el detalle de qué hace el motor y qué modela
 * el arnés está en `espia-de-gestos.ts`.
 */

export type { Objetivo, Punto } from './dedos.ts';
export { deslizar, type OpcionesDeDeslizar, type Sentido } from './deslizar.ts';
export {
  exigirGesto,
  hallazgosDeGesto,
  type NombreDeGesto,
  type ResultadoDeGesto,
} from './resultado-de-gesto.ts';

/** El tiempo que el dedo se queda sobre el blanco: Windows y Android disparan el menú a ~500 ms. */
export const PULSACION_LARGA_MS = 700;

async function escalaVisual(page: Page): Promise<number> {
  return page.evaluate(() => window.visualViewport?.scale ?? 1);
}

export async function toque(page: Page, objetivo: Objetivo): Promise<ResultadoDeGesto> {
  const punto = await prepararGesto(page, objetivo);
  await dedos(page, 'touchStart', [punto]);
  await dosCuadros(page);
  await dedos(page, 'touchEnd', []);
  await dosCuadros(page);
  return concluir(page, 'toque', punto, false);
}

export async function toqueDoble(page: Page, objetivo: Objetivo): Promise<ResultadoDeGesto> {
  const punto = await prepararGesto(page, objetivo);
  const antes = await escalaVisual(page);
  for (let vez = 0; vez < 2; vez += 1) {
    await dedos(page, 'touchStart', [punto]);
    await dosCuadros(page);
    await dedos(page, 'touchEnd', []);
    await dosCuadros(page);
  }
  await esperarQuietud(page);
  const despues = await escalaVisual(page);
  return concluir(page, 'toque-doble', punto, false, {
    escalaAntes: antes,
    escalaDespues: despues,
  });
}

/** Mantener presionado. La espera ES el gesto: el dedo se queda en la pantalla. */
export async function pulsacionLarga(
  page: Page,
  objetivo: Objetivo,
  opciones: { readonly ms?: number; readonly modelar?: boolean } = {},
): Promise<ResultadoDeGesto> {
  const punto = await prepararGesto(page, objetivo);
  const modelar = opciones.modelar !== false;
  await dedos(page, 'touchStart', [punto]);
  await page.waitForTimeout(opciones.ms ?? PULSACION_LARGA_MS);
  const menuSimulado = modelar ? await simularMenuDeWindows(page, punto) : false;
  const seleccionModelada = modelar ? await modelarSeleccionDeAndroid(page, punto) : false;
  await dedos(page, 'touchEnd', []);
  await dosCuadros(page);
  return concluir(page, 'pulsacion-larga', punto, seleccionModelada, { menuSimulado });
}

/**
 * El clic derecho de Windows sobre el elemento: despacha `contextmenu` y comprueba lo que manda
 * el POS: fuera de los campos de texto, PREVENIDO; dentro de uno, NO (ahí el menú es legítimo).
 */
export async function menuContextual(page: Page, objetivo: Objetivo): Promise<ResultadoDeGesto> {
  const punto = await prepararGesto(page, objetivo);
  await simularMenuDeWindows(page, punto);
  const resultado = await concluir(page, 'menu-contextual', punto, false);
  if (resultado.enCampo && resultado.menu.prevenido === true) {
    return {
      ...resultado,
      problemas: [
        ...resultado.problemas,
        'se previno el menú dentro de un campo de texto (hace falta «pegar»)',
      ],
    };
  }
  return resultado;
}

/** Arrastra el dedo de un blanco a otro. */
export async function arrastrar(
  page: Page,
  origen: Objetivo,
  destino: Objetivo,
  opciones: { readonly pasos?: number } = {},
): Promise<ResultadoDeGesto> {
  const inicio = await prepararGesto(page, origen);
  const fin = await puntoDe(destino);
  const pasos = opciones.pasos ?? 12;
  await dedos(page, 'touchStart', [inicio]);
  for (let paso = 1; paso <= pasos; paso += 1) {
    await dedos(page, 'touchMove', [
      {
        x: inicio.x + ((fin.x - inicio.x) * paso) / pasos,
        y: inicio.y + ((fin.y - inicio.y) * paso) / pasos,
      },
    ]);
    await dosCuadros(page);
  }
  const bajoElDedo = await dondeCae(page, fin);
  await dedos(page, 'touchEnd', []);
  await dosCuadros(page);
  return concluir(page, 'arrastrar', fin, false, {
    distanciaDelDedo: Math.round(Math.hypot(fin.x - inicio.x, fin.y - inicio.y)),
    bajoElDedo: bajoElDedo.nombre,
  });
}

/** El pellizco: dos dedos que se abren (`factor` > 1) o se cierran (< 1) sobre el blanco. */
export async function pellizcar(
  page: Page,
  objetivo: Objetivo,
  opciones: { readonly factor?: number; readonly radio?: number } = {},
): Promise<ResultadoDeGesto> {
  const centro = await prepararGesto(page, objetivo);
  const radio = opciones.radio ?? 60;
  const factor = opciones.factor ?? 1.8;
  const par = (r: number): [Punto, Punto] => [
    { x: centro.x - r, y: centro.y },
    { x: centro.x + r, y: centro.y },
  ];
  const antes = await escalaVisual(page);
  await dedos(page, 'touchStart', par(radio));
  const pasos = 10;
  for (let paso = 1; paso <= pasos; paso += 1) {
    await dedos(page, 'touchMove', par(radio + (radio * (factor - 1) * paso) / pasos));
    await dosCuadros(page);
  }
  await dedos(page, 'touchEnd', []);
  await esperarQuietud(page);
  return concluir(page, 'pellizco', centro, false, {
    escalaVisualAntes: antes,
    escalaVisualDespues: await escalaVisual(page),
    factor,
  });
}
