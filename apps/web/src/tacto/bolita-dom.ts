import {
  alConfirmarElAgregado,
  crearLanzador,
  REBOTE_MS,
  VUELO_MS,
  type Entorno,
  type OpcionesDeLaConfirmacion,
  type Punto,
} from './bolita';

/**
 * LA BOLITA (DP-25 · Parte 5) · lo que se hace con el DOM; la decisión es de `bolita.ts`.
 *
 * La bolita va en una capa fija fuera del flujo (`position: fixed`, sin eventos): no reacomoda la
 * página. Sólo anima `transform` y `opacity`, con la API de animación (WAAPI) y, si el aparato no la
 * trae, con `requestAnimationFrame`. El destino es el elemento visible con `data-destino-bolita`; su
 * número (`data-bolita-numero`, o él mismo) es el que rebota.
 */

const TAMANO_PX = 14;
const CURVA_SALIDA = 'cubic-bezier(0.23, 1, 0.32, 1)';
/** Cuánto se eleva a media trayectoria como máximo, para que el vuelo trace un arco corto. */
const ARCO_MAXIMO_PX = 36;

interface Cuadro {
  readonly x: number;
  readonly y: number;
  readonly escala: number;
  readonly opacidad: number;
}

const transformDe = (c: Cuadro): string => `translate(${c.x}px, ${c.y}px) scale(${c.escala})`;

/** `ease-out` fuerte (la misma curva, aproximada) para el respaldo sin WAAPI. */
const salidaFuerte = (t: number): number => 1 - Math.pow(1 - t, 4);

function mezclar(a: Cuadro, b: Cuadro, t: number): Cuadro {
  const m = (u: number, v: number): number => u + (v - u) * t;
  return {
    x: m(a.x, b.x),
    y: m(a.y, b.y),
    escala: m(a.escala, b.escala),
    opacidad: m(a.opacidad, b.opacidad),
  };
}

function cuadroEn(cuadros: readonly Cuadro[], t: number): Cuadro {
  const tramos = cuadros.length - 1;
  const posicion = Math.min(tramos, Math.max(0, t * tramos));
  const i = Math.min(tramos - 1, Math.floor(posicion));
  const a = cuadros[i];
  const b = cuadros[i + 1];
  if (a === undefined || b === undefined)
    return cuadros[0] ?? { x: 0, y: 0, escala: 1, opacidad: 1 };
  return mezclar(a, b, posicion - i);
}

export const hayWaapi = (): boolean =>
  typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';

export const hayCuadros = (): boolean => typeof requestAnimationFrame === 'function';

/** Anima un elemento por una lista de cuadros: WAAPI si existe y, si no, cuadro a cuadro. */
function animar(
  el: HTMLElement,
  cuadros: readonly Cuadro[],
  duracionMs: number,
  retardoMs: number,
  alTerminar: () => void,
): void {
  if (hayWaapi()) {
    const animacion = el.animate(
      cuadros.map((c) => ({ transform: transformDe(c), opacity: c.opacidad })),
      { duration: duracionMs, delay: retardoMs, easing: CURVA_SALIDA, fill: 'both' },
    );
    let terminada = false;
    const fin = (): void => {
      if (terminada) return;
      terminada = true;
      alTerminar();
    };
    animacion.onfinish = fin;
    animacion.oncancel = fin;
    return;
  }
  let inicio: number | null = null;
  const pintar = (c: Cuadro): void => {
    el.style.transform = transformDe(c);
    el.style.opacity = String(c.opacidad);
  };
  pintar(cuadros[0] ?? { x: 0, y: 0, escala: 1, opacidad: 0 });
  const paso = (ahora: number): void => {
    inicio ??= ahora + retardoMs;
    const t = Math.min(1, Math.max(0, (ahora - inicio) / duracionMs));
    pintar(cuadroEn(cuadros, salidaFuerte(t)));
    if (t >= 1) alTerminar();
    else requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

const centroDe = (el: Element): Punto => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

/** El primer destino que de verdad se ve (con tamaño y dentro de la pantalla). */
function destinoVisible(): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>('[data-destino-bolita]')) {
    const r = el.getBoundingClientRect();
    const dentro =
      r.width > 0 &&
      r.height > 0 &&
      r.bottom > 0 &&
      r.right > 0 &&
      r.top < innerHeight &&
      r.left < innerWidth;
    if (dentro) return el;
  }
  return null;
}

function volarUnaBolita(
  desde: Punto,
  hasta: Punto,
  retardoMs: number,
  alTerminar: () => void,
): void {
  const bolita = document.createElement('span');
  bolita.setAttribute('aria-hidden', 'true');
  bolita.setAttribute('data-bolita', '');
  const s = bolita.style;
  s.position = 'fixed';
  s.left = '0';
  s.top = '0';
  s.width = `${String(TAMANO_PX)}px`;
  s.height = `${String(TAMANO_PX)}px`;
  s.borderRadius = '9999px';
  s.background = 'hsl(var(--primario))';
  s.pointerEvents = 'none';
  s.zIndex = '2147483000';
  s.willChange = 'transform, opacity';
  s.opacity = '0';
  document.body.appendChild(bolita);
  const mitad = TAMANO_PX / 2;
  const ini: Cuadro = { x: desde.x - mitad, y: desde.y - mitad, escala: 1, opacidad: 1 };
  const fin: Cuadro = { x: hasta.x - mitad, y: hasta.y - mitad, escala: 0.55, opacidad: 0.85 };
  const arco = Math.min(ARCO_MAXIMO_PX, Math.hypot(hasta.x - desde.x, hasta.y - desde.y) * 0.25);
  const medio = mezclar(ini, fin, 0.5);
  animar(bolita, [ini, { ...medio, y: medio.y - arco }, fin], VUELO_MS, retardoMs, () => {
    bolita.remove();
    alTerminar();
  });
}

/** El número que rebota (y al que llega la bolita), si el destino lo tiene y se ve. */
function numeroDe(destino: HTMLElement): HTMLElement | null {
  const numero = destino.querySelector<HTMLElement>('[data-bolita-numero]');
  if (numero === null) return null;
  const r = numero.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? numero : null;
}

let animacionDelRebote: Animation | null = null;

function rebotarElNumero(): void {
  const destino = destinoVisible();
  if (destino === null || !hayWaapi()) return;
  const numero = numeroDe(destino) ?? destino;
  animacionDelRebote?.cancel();
  animacionDelRebote = numero.animate(
    [
      { transform: 'scale(1)' },
      { transform: 'scale(1.3)', offset: 0.4 },
      { transform: 'scale(1)' },
    ],
    { duration: REBOTE_MS, easing: CURVA_SALIDA },
  );
}

const entornoDelNavegador: Entorno = {
  ahora: () => performance.now(),
  reducido: () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  hayWaapi,
  hayCuadros,
  destino: () => {
    if (document.hidden) return null;
    const el = destinoVisible();
    if (el === null) return null;
    return centroDe(numeroDe(el) ?? el);
  },
  volar: volarUnaBolita,
  rebotar: rebotarElNumero,
};

const lanzar = crearLanzador(entornoDelNavegador);

/** El centro de un elemento, para anotarlo ANTES de que la acción lo desmonte (un diálogo que se cierra). */
export const puntoDeLaFicha = (el: Element): Punto => centroDe(el);

/** Se llama con lo que devolvió la acción de agregar: lanza la bolita sólo si agregó (`SE_AGREGO`). */
export function bolitaSiSeAgrego(
  resultado: unknown,
  origen: Punto,
  opciones?: OpcionesDeLaConfirmacion,
): void {
  alConfirmarElAgregado(
    resultado,
    () => {
      // Un cuadro después: la pantalla ya pintó lo que el agregado cambió (el botón flotante que
      // aparece con el primer platillo) y el destino ya existe.
      if (hayCuadros()) requestAnimationFrame(() => lanzar(origen));
      else lanzar(origen);
    },
    opciones,
  );
}
