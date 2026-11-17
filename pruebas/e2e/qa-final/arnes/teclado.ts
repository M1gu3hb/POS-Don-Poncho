import type { Locator, Page } from '@playwright/test';

import type { ModoDeTeclado } from './aparatos.ts';
import { instalarAyudas, SELECTOR_DE_CAMPO_DE_TEXTO } from './en-pagina.ts';
import { esperarQuietud } from './quietud.ts';
import { toque } from './toque.ts';
import type { Hallazgo } from './tipos.ts';

/**
 * EL TECLADO EN PANTALLA (DP-22). Chromium de escritorio no trae uno: se emula SU EFECTO sobre la
 * página, en los dos modos reales de los aparatos de Don Poncho, con la misma fracción (40 % del alto):
 *
 *  · `encoge` — Android (`adjustResize`: el iMin, la tableta y los teléfonos). La ventana de diseño se
 *    achica: `innerHeight`, `visualViewport.height` y `100vh` bajan, y la página recibe `resize`. Es
 *    lo que ya hacía `barrido-visual.spec.ts` con `setViewportSize`. No emula la animación del teclado
 *    ni el panel de sugerencias.
 *  · `tapa` — el teclado táctil de Windows de las PC: la página NO se entera. El alto de la ventana y
 *    el `visualViewport` no cambian y el teclado sólo se pone ENCIMA (un panel opaco que recibe los
 *    toques). No emula que Chrome lleve el campo a la vista por su cuenta, ni que Windows mueva la
 *    ventana: lo que se revisa es si la app deja el campo y los botones del pie fuera de lo tapado.
 */

export const FRACCION_DEL_TECLADO = 0.4;

export interface TecladoAbierto {
  readonly modo: ModoDeTeclado;
  /** El alto que tapa o quita, en píxeles de CSS. */
  readonly altoPx: number;
  /** Lo que la persona alcanza a ver: de `arriba` a `abajo`, en píxeles de CSS de la ventana. */
  readonly visible: { readonly arriba: number; readonly abajo: number };
  cerrar(): Promise<void>;
}

const PANEL = 'data-arnes-teclado';

export async function abrirTeclado(
  page: Page,
  modo: ModoDeTeclado,
  fraccion: number = FRACCION_DEL_TECLADO,
): Promise<TecladoAbierto> {
  const tamano = page.viewportSize();
  if (tamano === null) throw new Error('Sin viewport no hay teclado que emular.');
  const altoPx = Math.round(tamano.height * fraccion);
  if (modo === 'encoge') {
    await page.setViewportSize({ width: tamano.width, height: tamano.height - altoPx });
  } else {
    await page.evaluate(
      ({ alto, marca }) => {
        const panel = document.createElement('div');
        panel.setAttribute(marca, '');
        panel.style.cssText = `position:fixed;left:0;bottom:0;width:100%;height:${String(alto)}px;background:#777;z-index:2147483647;touch-action:none;`;
        document.body.append(panel);
      },
      { alto: altoPx, marca: PANEL },
    );
  }
  await esperarQuietud(page);
  return {
    modo,
    altoPx,
    // En los dos modos lo que se ve termina donde empieza el teclado.
    visible: { arriba: 0, abajo: tamano.height - altoPx },
    cerrar: async () => {
      if (modo === 'encoge') await page.setViewportSize(tamano);
      else {
        await page.evaluate((marca) => {
          document.querySelector(`[${marca}]`)?.remove();
        }, PANEL);
      }
      await esperarQuietud(page);
    },
  };
}

export interface OpcionesDeTeclado {
  /** El campo que se toca para enfocar. */
  readonly campo: Locator;
  readonly modo: ModoDeTeclado;
  readonly fraccion?: number;
  /** Selector CSS de los botones del pie; por omisión los de `footer` o `[data-slot*=footer]` del diálogo abierto. */
  readonly pie?: string;
}

interface PosicionDeScroll {
  readonly saltos: number;
}

async function contarSaltos(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __arnesSaltos?: { n: number; ultimo: number } };
    const estado = { n: 0, ultimo: -1e9 };
    w.__arnesSaltos = estado;
    document.addEventListener(
      'scroll',
      () => {
        const t = performance.now();
        // Un desplazamiento suave son muchos eventos seguidos: es UN movimiento.
        if (t - estado.ultimo > 150) estado.n += 1;
        estado.ultimo = t;
      },
      true,
    );
  });
}

async function leerSaltos(page: Page): Promise<PosicionDeScroll> {
  return page.evaluate(() => ({
    saltos: (window as unknown as { __arnesSaltos?: { n: number } }).__arnesSaltos?.n ?? 0,
  }));
}

/** El campo enfocado y los botones del pie, con teclado: a la vista, sin saltos, o alcanzables. */
export async function revisarTeclado(page: Page, opciones: OpcionesDeTeclado): Promise<Hallazgo[]> {
  const hallazgos: Hallazgo[] = [];
  await instalarAyudas(page);
  // Como en la vida: la persona toca el campo (la ventana aún está entera) y ENTONCES sale el teclado.
  await contarSaltos(page);
  await toque(page, opciones.campo);
  const teclado = await abrirTeclado(page, opciones.modo, opciones.fraccion);
  try {
    await esperarQuietud(page);
    const [{ saltos }, medidas] = [
      await leerSaltos(page),
      await medirConTeclado(page, opciones, teclado.visible.abajo),
    ];
    const medidasBase = {
      modo: opciones.modo,
      tecladoPx: teclado.altoPx,
      abajoVisible: teclado.visible.abajo,
    };
    if (!medidas.enfocado) {
      hallazgos.push({
        tipo: 'campo-tapado',
        selector: medidas.campo,
        texto: '',
        medidas: medidasBase,
        detalle: 'el toque no dejó el foco en el campo',
      });
    } else if (medidas.campoAbajo > teclado.visible.abajo + 1 || medidas.campoArriba < -1) {
      hallazgos.push({
        tipo: 'campo-tapado',
        selector: medidas.campo,
        texto: '',
        medidas: {
          ...medidasBase,
          campoArriba: medidas.campoArriba,
          campoAbajo: medidas.campoAbajo,
        },
        detalle: `el campo enfocado queda fuera de lo que se ve (${String(medidas.campoAbajo)} > ${String(teclado.visible.abajo)})`,
      });
    }
    if (saltos > 1) {
      hallazgos.push({
        tipo: 'teclado-salto',
        selector: medidas.campo,
        texto: '',
        medidas: { ...medidasBase, saltos },
        detalle: `la posición de scroll cambió ${String(saltos)} veces al enfocar (a lo más 1)`,
      });
    }
    for (const b of medidas.pie.filter((p) => !p.visible && !p.alcanzable)) {
      hallazgos.push({
        tipo: 'pie-inalcanzable',
        selector: b.nombre,
        texto: b.texto,
        medidas: { ...medidasBase, abajo: b.abajo },
        detalle: 'un botón del pie del diálogo ni se ve ni se alcanza desplazando',
      });
    }
  } finally {
    await teclado.cerrar();
  }
  return hallazgos;
}

async function medirConTeclado(page: Page, opciones: OpcionesDeTeclado, abajoVisible: number) {
  return page.evaluate(
    ({ selectorDeCampo, abajo, selectorDelPie }) => {
      const lib = (
        window as unknown as {
          __arnes: {
            nombre(e: Element): string;
            texto(e: Element): string;
            raiz(): ParentNode;
          };
        }
      ).__arnes;
      const activo = document.activeElement;
      const enfocado = activo?.matches(selectorDeCampo) === true;
      const caja = activo?.getBoundingClientRect();
      const raiz = lib.raiz();
      const delPie = Array.from(
        raiz.querySelectorAll<HTMLElement>(
          selectorDelPie ?? 'footer button, [data-slot*="footer"] button, [class*="footer"] button',
        ),
      );
      const desplazable = (e: Element): boolean => {
        for (let p = e.parentElement; p !== null; p = p.parentElement) {
          const est = getComputedStyle(p);
          const raizDoc = p === document.documentElement;
          if (
            (['auto', 'scroll', 'overlay'].includes(est.overflowY) || raizDoc) &&
            p.scrollHeight > p.clientHeight + 1 &&
            getComputedStyle(e).position !== 'fixed'
          ) {
            return true;
          }
        }
        return false;
      };
      return {
        enfocado,
        campo: activo === null ? '(sin foco)' : lib.nombre(activo),
        campoArriba: Math.round(caja?.top ?? 0),
        campoAbajo: Math.round(caja?.bottom ?? 0),
        pie: delPie.map((b) => {
          const c = b.getBoundingClientRect();
          const visible = c.bottom <= abajo + 1 && c.top >= -1 && c.height > 0;
          return {
            nombre: lib.nombre(b),
            texto: lib.texto(b),
            abajo: Math.round(c.bottom),
            visible,
            alcanzable: visible || desplazable(b),
          };
        }),
      };
    },
    {
      selectorDeCampo: SELECTOR_DE_CAMPO_DE_TEXTO,
      abajo: abajoVisible,
      selectorDelPie: opciones.pie ?? null,
    },
  );
}

/**
 * NADA SE ABRE CON EL FOCO EN UN CAMPO DE TEXTO. Con puntero grueso el teclado sale cuando la
 * persona TOCA el campo, no cuando se abre el diálogo (DP-D137). Se anota cada `focusin` en un
 * campo durante la apertura (aunque el foco se vaya después) y se mira dónde queda al final.
 */
export async function revisarFocoAlAbrir(
  page: Page,
  abrir: () => Promise<unknown>,
): Promise<Hallazgo[]> {
  await instalarAyudas(page);
  const esGrueso = await page.evaluate(() => matchMedia('(any-pointer: coarse)').matches);
  if (!esGrueso) {
    throw new Error(
      'Este perfil no tiene puntero grueso: no hay nada que comprobar del foco al abrir.',
    );
  }
  await page.evaluate((selectorDeCampo) => {
    const w = window as unknown as { __arnesFoco?: string[] };
    w.__arnesFoco = [];
    const lib = (window as unknown as { __arnes: { nombre(e: Element): string } }).__arnes;
    document.addEventListener(
      'focusin',
      (ev) => {
        const t = ev.target;
        if (t instanceof Element && t.matches(selectorDeCampo)) w.__arnesFoco?.push(lib.nombre(t));
      },
      true,
    );
  }, SELECTOR_DE_CAMPO_DE_TEXTO);
  await abrir();
  await esperarQuietud(page, 400);
  const visto = await page.evaluate((selectorDeCampo) => {
    const lib = (window as unknown as { __arnes: { nombre(e: Element): string } }).__arnes;
    const activo = document.activeElement;
    return {
      alFinal: activo?.matches(selectorDeCampo) === true ? lib.nombre(activo) : null,
      pasaron: (window as unknown as { __arnesFoco?: string[] }).__arnesFoco ?? [],
    };
  }, SELECTOR_DE_CAMPO_DE_TEXTO);
  const donde = visto.alFinal ?? visto.pasaron[0];
  if (donde === undefined) return [];
  return [
    {
      tipo: 'foco-en-campo',
      selector: donde,
      texto: '',
      medidas: { alFinal: visto.alFinal !== null, veces: visto.pasaron.length },
      detalle:
        visto.alFinal === null
          ? 'el foco pasó por un campo de texto al abrir'
          : 'el diálogo abrió con el foco en un campo de texto',
    },
  ];
}
