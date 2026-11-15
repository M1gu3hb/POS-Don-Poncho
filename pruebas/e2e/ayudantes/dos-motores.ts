import type { Page } from '@playwright/test';

/**
 * DP-20.1 · COMPARAR LO QUE PINTAN DOS MOTORES.
 *
 * El modo compatible promete que un POS con Chromium 99 se ve como uno actual. Aquí se mide: dos
 * capturas de la misma pantalla, una por motor, se comparan POR BLOQUES —el color medio de cada
 * cuadro de `lado` × `lado` pixeles— y no pixel a pixel, porque dos versiones del mismo navegador
 * no dibujan el borde de una letra exactamente igual y eso no es un defecto. Un fondo sólido donde
 * debía ir uno translúcido, o un diálogo corrido, cambian bloques enteros: eso sí.
 *
 * La cuenta se hace dentro de una página (un lienzo): así no hace falta ninguna librería para leer
 * PNG, y de paso sale la imagen «lado a lado» —viejo, moderno y las diferencias marcadas—.
 */

export interface Recuadro {
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly alto: number;
}

export interface OpcionesDeComparacion {
  /** El lado del bloque, en pixeles. */
  readonly lado?: number;
  /** Cuánto puede diferir el color medio de un bloque (por canal, de 0 a 255) sin contar. */
  readonly tolerancia?: number;
  /** Zonas que cambian de una corrida a otra (relojes, folios): no se comparan. */
  readonly tapar?: readonly Recuadro[];
}

export interface Comparacion {
  readonly ancho: number;
  readonly alto: number;
  /** Bloques comparados (sin los tapados). */
  readonly bloques: number;
  readonly distintos: number;
  /** De 0 a 1. */
  readonly proporcion: number;
  /** Los bloques que más difieren: dónde mirar primero. */
  readonly peores: readonly {
    readonly x: number;
    readonly y: number;
    readonly diferencia: number;
  }[];
  /** PNG en base64: viejo | moderno, con los bloques distintos marcados sobre el viejo. */
  readonly ladoALado: string;
}

export const LADO_DEL_BLOQUE = 8;
export const TOLERANCIA_POR_CANAL = 12;

/**
 * Compara dos capturas del mismo tamaño. `herramienta` es cualquier página abierta (sólo presta su
 * lienzo; conviene una en blanco del navegador moderno).
 */
export async function compararCapturas(
  herramienta: Page,
  viejo: Buffer,
  moderno: Buffer,
  opciones: OpcionesDeComparacion = {},
): Promise<Comparacion> {
  return herramienta.evaluate(
    async ({ a, b, lado, tolerancia, tapar }) => {
      const leer = async (base64: string): Promise<ImageBitmap> => {
        const respuesta = await fetch(`data:image/png;base64,${base64}`);
        return createImageBitmap(await respuesta.blob());
      };
      const [imagenA, imagenB] = await Promise.all([leer(a), leer(b)]);
      const ancho = Math.min(imagenA.width, imagenB.width);
      const alto = Math.min(imagenA.height, imagenB.height);
      const pixeles = (imagen: ImageBitmap): Uint8ClampedArray => {
        const lienzo = document.createElement('canvas');
        lienzo.width = ancho;
        lienzo.height = alto;
        const contexto = lienzo.getContext('2d');
        if (contexto === null) throw new Error('sin lienzo 2d');
        contexto.drawImage(imagen, 0, 0);
        return contexto.getImageData(0, 0, ancho, alto).data;
      };
      const datosA = pixeles(imagenA);
      const datosB = pixeles(imagenB);

      const tapado = (x: number, y: number): boolean =>
        tapar.some(
          (r) => x < r.x + r.ancho && x + lado > r.x && y < r.y + r.alto && y + lado > r.y,
        );
      const distintos: { x: number; y: number; diferencia: number }[] = [];
      let bloques = 0;
      for (let y = 0; y < alto; y += lado) {
        for (let x = 0; x < ancho; x += lado) {
          if (tapado(x, y)) continue;
          bloques += 1;
          const suma = [0, 0, 0];
          let cuantos = 0;
          for (let dy = 0; dy < lado && y + dy < alto; dy += 1) {
            for (let dx = 0; dx < lado && x + dx < ancho; dx += 1) {
              const i = ((y + dy) * ancho + (x + dx)) * 4;
              for (let canal = 0; canal < 3; canal += 1)
                suma[canal] =
                  (suma[canal] ?? 0) + (datosA[i + canal] ?? 0) - (datosB[i + canal] ?? 0);
              cuantos += 1;
            }
          }
          const diferencia = Math.max(...suma.map((s) => Math.abs(s / cuantos)));
          if (diferencia > tolerancia) distintos.push({ x, y, diferencia: Math.round(diferencia) });
        }
      }

      // Lado a lado: el viejo a la izquierda (con lo distinto marcado) y el moderno a la derecha.
      const SEPARACION = 12;
      const salida = document.createElement('canvas');
      salida.width = ancho * 2 + SEPARACION;
      salida.height = alto;
      const contexto = salida.getContext('2d');
      if (contexto === null) throw new Error('sin lienzo 2d');
      contexto.fillStyle = '#ff00aa';
      contexto.fillRect(0, 0, salida.width, salida.height);
      contexto.drawImage(imagenA, 0, 0);
      contexto.drawImage(imagenB, ancho + SEPARACION, 0);
      contexto.strokeStyle = '#ff00aa';
      contexto.lineWidth = 1;
      for (const bloque of distintos)
        contexto.strokeRect(bloque.x + 0.5, bloque.y + 0.5, lado - 1, lado - 1);

      return {
        ancho,
        alto,
        bloques,
        distintos: distintos.length,
        proporcion: bloques === 0 ? 0 : distintos.length / bloques,
        peores: [...distintos].sort((p, q) => q.diferencia - p.diferencia).slice(0, 12),
        ladoALado: salida.toDataURL('image/png').slice('data:image/png;base64,'.length),
      };
    },
    {
      a: viejo.toString('base64'),
      b: moderno.toString('base64'),
      lado: opciones.lado ?? LADO_DEL_BLOQUE,
      tolerancia: opciones.tolerancia ?? TOLERANCIA_POR_CANAL,
      tapar: [...(opciones.tapar ?? [])],
    },
  );
}

/** Dónde está (y cuánto mide) cada cosa visible de la pantalla: para ver qué se movió. */
export interface Medida extends Recuadro {
  /** El camino del elemento en el documento: `main>div:1>button:3`. */
  readonly camino: string;
  readonly texto: string;
}

/**
 * Las cajas de lo que se ve, con su camino en el documento. Dos motores que pintan la misma página
 * tienen que dejar cada cosa en el mismo sitio: un diálogo corrido o una columna rota salen aquí
 * con nombre, no como «algo cambió por ahí».
 */
export async function medidasDeLoVisible(page: Page): Promise<Medida[]> {
  return page.evaluate(() => {
    const camino = (elemento: Element): string => {
      const tramos: string[] = [];
      for (
        let e: Element | null = elemento;
        e !== null && e !== document.body;
        e = e.parentElement
      ) {
        const padre: Element | null = e.parentElement;
        const indice = padre === null ? 0 : Array.prototype.indexOf.call(padre.children, e);
        tramos.unshift(`${e.tagName.toLowerCase()}:${String(indice)}`);
      }
      return tramos.join('>');
    };
    const medidas: {
      camino: string;
      texto: string;
      x: number;
      y: number;
      ancho: number;
      alto: number;
    }[] = [];
    const interesa =
      'button, a[href], input, select, textarea, h1, h2, h3, [role="dialog"], [role="alertdialog"], [role="tab"], [role="menuitem"], label, img, svg, th, td, li, p';
    for (const elemento of Array.from(document.body.querySelectorAll(interesa))) {
      const caja = elemento.getBoundingClientRect();
      if (caja.width < 1 || caja.height < 1) continue;
      if (caja.bottom < 0 || caja.right < 0 || caja.top > innerHeight || caja.left > innerWidth)
        continue;
      const estilo = getComputedStyle(elemento);
      if (estilo.visibility === 'hidden' || estilo.display === 'none' || estilo.opacity === '0')
        continue;
      medidas.push({
        camino: camino(elemento),
        texto: (elemento.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40),
        x: Math.round(caja.left),
        y: Math.round(caja.top),
        ancho: Math.round(caja.width),
        alto: Math.round(caja.height),
      });
    }
    return medidas;
  });
}

export interface Desplazamiento {
  readonly camino: string;
  readonly texto: string;
  readonly viejo: Recuadro | null;
  readonly moderno: Recuadro;
}

/** Lo que el motor viejo deja en otro sitio (o no pinta), con `tolerancia` pixeles de margen. */
export function desplazados(
  viejo: readonly Medida[],
  moderno: readonly Medida[],
  tolerancia = 2,
): Desplazamiento[] {
  const delViejo = new Map(viejo.map((m) => [m.camino, m]));
  const fuera: Desplazamiento[] = [];
  for (const m of moderno) {
    const v = delViejo.get(m.camino);
    const igual =
      v !== undefined &&
      Math.abs(v.x - m.x) <= tolerancia &&
      Math.abs(v.y - m.y) <= tolerancia &&
      Math.abs(v.ancho - m.ancho) <= tolerancia &&
      Math.abs(v.alto - m.alto) <= tolerancia;
    if (igual) continue;
    fuera.push({
      camino: m.camino,
      texto: m.texto,
      viejo: v === undefined ? null : { x: v.x, y: v.y, ancho: v.ancho, alto: v.alto },
      moderno: { x: m.x, y: m.y, ancho: m.ancho, alto: m.alto },
    });
  }
  return fuera;
}
