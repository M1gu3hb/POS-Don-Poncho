import type { Page, TestInfo } from '@playwright/test';
import { expect } from '@playwright/test';

import { revisarPantalla, type OpcionesDeRevision } from './revisiones.ts';
import { describir } from './tipos.ts';

/**
 * EL BARRIDO (DP-22): junta lo que cada revisión halla en cada pantalla y estado de UNA prueba y,
 * al final, la deja en rojo con TODA la lista (no con la primera). Así una pantalla con un defecto
 * no esconde a las que vienen después, y la prueba sigue siendo una puerta: sólo pasa cuando no
 * hay hallazgos sin explicar.
 *
 * Cada estado se revisa en modo de barrido (`revisarPantalla` junta y sigue); lo que cambia es que
 * aquí el veredicto llega al final, con la pantalla y el estado delante de cada hallazgo.
 *
 * Dos cuidados:
 *  · ANTES de medir se espera a que terminen las animaciones que terminan (la entrada de un aviso o
 *    de un diálogo, la salida de un velo): medir a media animación da alturas y cubiertas que no son
 *    de nadie (un aviso a medio entrar mide 13 px; el velo que se va «tapa» toda la lista);
 *  · lo CONOCIDO. Un hallazgo que se sabe y no se arregla en esta tanda (con su razón escrita) no
 *    tumba la prueba, pero sale en la salida como `[conocido]`: la prueba en verde dice «nada
 *    nuevo», no «nada».
 */

export interface Conocido {
  /** Se compara con `pantalla · estado · hallazgo` tal como sale en el informe. */
  readonly patron: RegExp;
  readonly razon: string;
}

async function esperarAnimaciones(page: Page, tope = 4_000): Promise<void> {
  await page
    .evaluate(async (limite) => {
      const hasta = performance.now() + limite;
      while (performance.now() < hasta) {
        const enCurso = document
          .getAnimations()
          .filter(
            (a) => a.playState === 'running' && a.effect?.getComputedTiming().endTime !== Infinity,
          );
        if (enCurso.length === 0) return;
        await Promise.allSettled(enCurso.map((a) => a.finished));
      }
    }, tope)
    .catch(() => undefined);
}

async function alternarAvisos(page: Page, ocultar: boolean): Promise<void> {
  await page
    .evaluate((oculta) => {
      for (const caja of document.querySelectorAll<HTMLElement>('[data-sonner-toaster]')) {
        caja.style.visibility = oculta ? 'hidden' : '';
      }
    }, ocultar)
    .catch(() => undefined);
}

export class Barrido {
  readonly #lineas: string[] = [];
  readonly #conocidas: string[] = [];
  #revisados = 0;

  constructor(
    private readonly info: TestInfo,
    private readonly conocidos: readonly Conocido[] = [],
  ) {}

  /** Revisa la pantalla tal como está y anota lo que halló. */
  async revisar(
    page: Page,
    pantalla: string,
    estado: string,
    extra: Omit<OpcionesDeRevision, 'pantalla' | 'estado' | 'modo'> & {
      /** Mide CON los avisos a la vista (un estado propio para ellos); por omisión se ocultan. */
      readonly conAvisos?: boolean;
    } = {},
  ): Promise<void> {
    const { conAvisos = false, ...opciones } = extra;
    await esperarAnimaciones(page);
    // Un aviso que acaba de salir entra con una transición que arranca DESPUÉS de la primera espera:
    // medido a medio entrar, su texto se mezcla con el fondo (contraste de 1:1). Se le da su tiempo.
    if (conAvisos && (await page.locator('[data-sonner-toast]').count()) > 0) {
      await page
        .waitForFunction(
          () =>
            Array.from(document.querySelectorAll('[data-sonner-toast]')).every(
              (t) => Number(getComputedStyle(t).opacity) >= 0.99,
            ),
          undefined,
          { timeout: 3_000 },
        )
        .catch(() => undefined);
      await page.waitForTimeout(250);
      await esperarAnimaciones(page);
    }
    // Los avisos duran ~3.5 s y axe tarda más con la máquina cargada: medirlos «a medio irse» da un
    // contraste que no es de nadie. Salvo en el estado que los mide a propósito, se ocultan mientras
    // se mide (y se devuelven: los siguientes avisos tienen que verse).
    if (!conAvisos) await alternarAvisos(page, true);
    let resultado;
    try {
      resultado = await revisarPantalla(page, this.info, {
        ...opciones,
        pantalla,
        estado,
        modo: 'barrido',
      });
    } finally {
      if (!conAvisos) await alternarAvisos(page, false);
    }
    this.#revisados += 1;
    let nuevos = 0;
    for (const h of resultado.hallazgos) {
      const linea = `${pantalla} · ${estado} · ${describir(h)}`;
      const conocido = this.conocidos.find((c) => c.patron.test(linea));
      if (conocido === undefined) {
        this.#lineas.push(linea);
        nuevos += 1;
      } else {
        this.#conocidas.push(`${linea}\n      ↳ conocido: ${conocido.razon}`);
      }
    }
    process.stdout.write(
      `[barrido] ${resultado.aparato} · ${pantalla} · ${estado}: ${String(nuevos)} hallazgos\n`,
    );
  }

  get revisados(): number {
    return this.#revisados;
  }

  /** La prueba pasa sólo si ninguna pantalla ni estado dejó un hallazgo sin explicar. */
  exigirLimpio(): void {
    for (const linea of this.#conocidas) process.stdout.write(`[conocido] ${linea}\n`);
    expect(
      this.#lineas,
      `${String(this.#lineas.length)} hallazgos en ${String(this.#revisados)} revisiones:\n${this.#lineas.join('\n')}`,
    ).toEqual([]);
  }
}
