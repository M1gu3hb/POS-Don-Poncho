import type { Page } from '@playwright/test';

import type { Aparato } from '../aparatos.ts';
import { revisarFocoAlAbrir, revisarTeclado } from '../teclado.ts';
import { hallazgosDeGesto, menuContextual, pulsacionLarga, toque } from '../toque.ts';
import type { Hallazgo, TipoDeHallazgo } from '../tipos.ts';

import { pagina, type Variante } from './pagina.ts';

/**
 * CADA DEFECTO SEMBRADO, UNO POR CASO. La autoprueba pasa sólo si el arnés detecta el defecto en la
 * variante `sucia` (el tipo que dice `esperado` tiene que salir) y NO encuentra nada en la `limpia`.
 * Una revisión que no puede fallar no prueba nada.
 */

export type Extra = () => Promise<readonly Hallazgo[]>;

export interface Caso {
  readonly id: string;
  readonly defecto: string;
  readonly esperado: TipoDeHallazgo;
  readonly html: Readonly<Record<Variante, string>>;
  /** Las revisiones de gestos o de teclado que este caso necesita además de `revisarPantalla`. */
  readonly extras?: (page: Page, aparato: Aparato) => readonly Extra[];
}

const MENU_PREVENIDO = `document.addEventListener('contextmenu', function (e) {
  if (!e.target.closest('input, textarea')) e.preventDefault();
});`;
const SIN_SELECCION = `#t { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }`;
const FILA_DE_CAMPOS = `.fila { display: flex; gap: 12px; } .fila > div { flex: 1; min-width: 0; }`;
const TARJETAS = `.rej { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .tar { border: 1px solid #555; border-radius: 8px; padding: 8px; }`;
const DIALOGO = `#dlg { position: fixed; left: 8px; right: 8px; top: 8px; background: #fff; border: 2px solid #333; padding: 12px; }
  #dlg[hidden] { display: none; }`;

const campos = (segundoDesplazado: boolean): string => `<div class="fila">
  <div><label for="a">Nombre</label><input id="a"></div>
  <div${segundoDesplazado ? ' style="margin-top:14px"' : ''}><label for="b">Apellido</label><input id="b"></div>
</div>`;

const dialogo = (focoEn: string): { cuerpo: string; guion: string } => ({
  cuerpo: `<button id="abrir" type="button">Abrir</button>
<div id="dlg" role="dialog" aria-modal="true" aria-labelledby="tit" tabindex="-1" hidden>
  <h2 id="tit">Cantidad</h2>
  <label for="cant">Personas</label><input id="cant" inputmode="numeric">
  <footer><button type="button" id="cerrar">Cerrar</button></footer>
</div>`,
  guion: `document.getElementById('abrir').addEventListener('click', function () {
  var d = document.getElementById('dlg'); d.hidden = false; ${focoEn}.focus();
});`,
});

const campoAlFondo = (abajo: boolean): { cuerpo: string; estilo: string; guion: string } => ({
  cuerpo: `<label for="c" id="et">Cantidad</label><input id="c" inputmode="numeric">`,
  estilo: `html, body { height: 100%; overflow: hidden; } body { position: relative; }
    #et, #c { position: absolute; left: 16px; right: 16px; width: auto; } #et { margin: 0; }`,
  guion: `var alto = innerHeight; var arriba = ${abajo ? 'alto - 72' : '70'};
document.getElementById('et').style.top = (arriba - 24) + 'px';
document.getElementById('c').style.top = arriba + 'px';`,
});

const toqueEn = (selector: string) => (page: Page) => toque(page, page.locator(selector));

export const CASOS: readonly Caso[] = [
  {
    id: 'desborde',
    defecto: 'desborde horizontal de la página',
    esperado: 'desborde',
    html: {
      sucia: pagina({
        cuerpo: '<div style="width:2000px;height:24px;background:#ddd">Ancho</div>',
      }),
      limpia: pagina({ cuerpo: '<div style="width:100%;height:24px;background:#ddd">Ancho</div>' }),
    },
  },
  {
    id: 'texto-cortado',
    defecto: 'texto cortado sin elipsis',
    esperado: 'texto-cortado',
    html: {
      sucia: pagina({
        cuerpo: `<div style="width:120px;overflow:hidden;white-space:nowrap;border:1px solid #333">Una descripción larguísima que no cabe</div>`,
      }),
      limpia: pagina({
        cuerpo: `<div style="width:120px;border:1px solid #333">Una descripción larguísima que sí cabe porque baja de renglón</div>`,
      }),
    },
  },
  {
    id: 'tocables-encimados',
    defecto: 'dos botones encimados',
    esperado: 'encimado',
    html: {
      sucia: pagina({
        estilo:
          'main { position: relative; height: 240px; } .b { position: absolute; width: 120px; height: 48px; }',
        cuerpo: `<button class="b" style="left:0;top:80px" type="button">Uno</button><button class="b" style="left:60px;top:96px" type="button">Dos</button>`,
      }),
      limpia: pagina({
        estilo:
          'main { position: relative; height: 240px; } .b { position: absolute; width: 120px; height: 48px; }',
        cuerpo: `<button class="b" style="left:0;top:80px" type="button">Uno</button><button class="b" style="left:132px;top:80px" type="button">Dos</button>`,
      }),
    },
  },
  {
    id: 'tarjetas-desiguales',
    defecto: 'tarjetas de distinto alto en una fila',
    esperado: 'fila-desigual',
    html: {
      sucia: pagina({
        estilo: `${TARJETAS} .rej { align-items: start; }`,
        cuerpo: `<div class="rej"><div class="tar" style="height:80px">Poca cosa</div><div class="tar" style="height:128px">Mucha cosa</div></div>`,
      }),
      limpia: pagina({
        estilo: TARJETAS,
        cuerpo: `<div class="rej"><div class="tar" style="height:128px">Poca cosa</div><div class="tar" style="height:128px">Mucha cosa</div></div>`,
      }),
    },
  },
  {
    id: 'campos-desalineados',
    defecto: 'campos de una fila desalineados',
    esperado: 'campos-desalineados',
    html: {
      sucia: pagina({ estilo: FILA_DE_CAMPOS, cuerpo: campos(true) }),
      limpia: pagina({ estilo: FILA_DE_CAMPOS, cuerpo: campos(false) }),
    },
  },
  {
    id: 'blanco-de-30',
    defecto: 'un botón principal de 30 px',
    esperado: 'blanco-chico',
    html: {
      sucia: pagina({
        cuerpo:
          '<button type="button" style="height:30px;min-height:0;min-width:120px">Guardar</button>',
      }),
      limpia: pagina({
        cuerpo: '<button type="button" style="height:48px;min-width:120px">Guardar</button>',
      }),
    },
  },
  {
    id: 'contraste',
    defecto: 'texto con contraste insuficiente',
    esperado: 'accesibilidad',
    html: {
      sucia: pagina({ cuerpo: '<p style="color:#bbb">Total de la cuenta de la mesa</p>' }),
      limpia: pagina({ cuerpo: '<p style="color:#111">Total de la cuenta de la mesa</p>' }),
    },
  },
  {
    id: 'console-error',
    defecto: 'un console.error',
    esperado: 'consola',
    html: {
      sucia: pagina({
        cuerpo: '<p>Pantalla</p>',
        guion: "console.error('arnes: error de calibración');",
      }),
      limpia: pagina({ cuerpo: '<p>Pantalla</p>', guion: "console.log('arnes: todo bien');" }),
    },
  },
  {
    id: 'respuesta-500',
    defecto: 'una respuesta 500',
    esperado: 'respuesta',
    html: {
      sucia: pagina({ cuerpo: '<p>Pantalla</p>', guion: "fetch('/api/calibracion/falla');" }),
      limpia: pagina({ cuerpo: '<p>Pantalla</p>', guion: "fetch('/api/calibracion/ok');" }),
    },
  },
  {
    id: 'seleccion-por-pulsacion-larga',
    defecto: 'texto que se selecciona con la pulsación larga',
    esperado: 'gesto-seleccion',
    html: {
      sucia: pagina({
        cuerpo: '<p id="t">Mesa cuatro pidió tres tacos de pastor</p>',
        guion: MENU_PREVENIDO,
      }),
      limpia: pagina({
        estilo: SIN_SELECCION,
        cuerpo: '<p id="t">Mesa cuatro pidió tres tacos de pastor</p>',
        guion: MENU_PREVENIDO,
      }),
    },
    extras: (page) => [
      async () => hallazgosDeGesto(await pulsacionLarga(page, page.locator('#t'))),
    ],
  },
  {
    id: 'contextmenu-sin-prevenir',
    defecto: 'un contextmenu sin prevenir',
    esperado: 'gesto-menu',
    html: {
      sucia: pagina({
        estilo: SIN_SELECCION,
        cuerpo: '<p id="t">Mesa cuatro</p><label for="campo">Notas</label><input id="campo">',
      }),
      limpia: pagina({
        estilo: SIN_SELECCION,
        cuerpo: '<p id="t">Mesa cuatro</p><label for="campo">Notas</label><input id="campo">',
        guion: MENU_PREVENIDO,
      }),
    },
    // Fuera de un campo tiene que estar prevenido; dentro de uno, NO (ahí el menú es legítimo).
    extras: (page) => [
      async () => hallazgosDeGesto(await menuContextual(page, page.locator('#t'))),
      async () => hallazgosDeGesto(await menuContextual(page, page.locator('#campo'))),
    ],
  },
  {
    id: 'foco-al-abrir',
    defecto: 'un diálogo que abre con el foco en un campo',
    esperado: 'foco-en-campo',
    html: {
      sucia: pagina({ estilo: DIALOGO, ...dialogo("document.getElementById('cant')") }),
      limpia: pagina({ estilo: DIALOGO, ...dialogo('d') }),
    },
    extras: (page) => [() => revisarFocoAlAbrir(page, () => toqueEn('#abrir')(page))],
  },
  {
    id: 'campo-tapado-por-el-teclado',
    defecto: 'un campo que queda tapado por el teclado',
    esperado: 'campo-tapado',
    html: {
      sucia: pagina(campoAlFondo(true)),
      limpia: pagina(campoAlFondo(false)),
    },
    extras: (page, aparato) => [
      () => revisarTeclado(page, { campo: page.locator('#c'), modo: aparato.teclado }),
    ],
  },
];
