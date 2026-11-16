import type { Page } from '@playwright/test';

/**
 * DP-20.1 · COMPARAR LO QUE PINTAN DOS MOTORES.
 *
 * El modo compatible promete que un POS con Chromium 99 se ve como uno actual. Aquí se mide: dos
 * capturas de la misma pantalla, una por motor. No vale comparar pixel contra pixel: dos versiones
 * del mismo navegador no dibujan igual la tinta —la moderna deja las letras y los iconos algo más
 * gruesos, con los mismos estilos calculados— y eso no es un defecto. Por eso se mide de dos formas:
 *
 *  - LAS ZONAS LISAS, por pixeles (`compararCapturas`): fondos, tarjetas, velos, degradados. Un
 *    fondo sólido donde debía ir uno translúcido o un diálogo corrido cambian zonas enteras.
 *  - LA TINTA Y LOS BORDES, por estilos calculados (`medidasDeLoVisible` + `diferenciasDeEstilo`):
 *    el color del texto, del fondo y del borde de cada cosa, pasados por un lienzo para que
 *    `rgba(…)` del motor viejo y `oklab(…)` del moderno se comparen como lo que son, y la caja de
 *    cada elemento, para ver qué se movió.
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
  /** Cuánto puede diferir un pixel liso entre los dos motores (por canal, de 0 a 255). */
  readonly tolerancia?: number;
  /** El vecindario que decide si un pixel está en zona lisa: `radio` pixeles a cada lado. */
  readonly radio?: number;
  /** Cuántos pixeles lisos tienen que diferir para que el bloque cuente como distinto. */
  readonly minimo?: number;
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
export const TOLERANCIA_POR_CANAL = 10;
export const RADIO_DEL_VECINDARIO = 2;
export const PIXELES_PARA_CONTAR_EL_BLOQUE = 4;

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
    async ({ a, b, lado, tolerancia, radio, minimo, tapar }) => {
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
      /**
       * El mínimo y el máximo de cada canal en el vecindario de cada pixel (dos pasadas, una por
       * eje). Con ellos se sabe si un pixel está en una zona lisa: sólo ésas se comparan aquí.
       */
      const LISO = 16;
      const extremos = (datos: Uint8ClampedArray): { min: Uint8Array; max: Uint8Array } => {
        const pasada = (
          origen: Uint8Array | Uint8ClampedArray,
          mayor: boolean,
          paso: number,
          largo: number,
          lineas: number,
          salto: number,
        ): Uint8Array => {
          const destino = new Uint8Array(origen.length);
          for (let linea = 0; linea < lineas; linea += 1) {
            for (let p = 0; p < largo; p += 1) {
              const desde = Math.max(0, p - radio);
              const hasta = Math.min(largo - 1, p + radio);
              for (let canal = 0; canal < 3; canal += 1) {
                let extremo = mayor ? 0 : 255;
                for (let q = desde; q <= hasta; q += 1) {
                  const v = origen[linea * salto + q * paso + canal] ?? 0;
                  if (mayor ? v > extremo : v < extremo) extremo = v;
                }
                destino[linea * salto + p * paso + canal] = extremo;
              }
            }
          }
          return destino;
        };
        const enFilas = (mayor: boolean): Uint8Array =>
          pasada(datos, mayor, 4, ancho, alto, ancho * 4);
        const enColumnas = (origen: Uint8Array, mayor: boolean): Uint8Array =>
          pasada(origen, mayor, ancho * 4, alto, ancho, 4);
        return { min: enColumnas(enFilas(false), false), max: enColumnas(enFilas(true), true) };
      };
      const entornoA = extremos(datosA);
      const entornoB = extremos(datosB);
      /** ¿El pixel está en una zona de color liso (sin letra, icono ni borde alrededor)? */
      const liso = (entorno: { min: Uint8Array; max: Uint8Array }, i: number): boolean => {
        for (let canal = 0; canal < 3; canal += 1) {
          if ((entorno.max[i + canal] ?? 0) - (entorno.min[i + canal] ?? 0) > LISO) return false;
        }
        return true;
      };
      const difiere = (i: number): boolean => {
        for (let canal = 0; canal < 3; canal += 1) {
          if (Math.abs((datosA[i + canal] ?? 0) - (datosB[i + canal] ?? 0)) > tolerancia)
            return true;
        }
        return false;
      };

      const distintos: { x: number; y: number; diferencia: number }[] = [];
      let bloques = 0;
      for (let y = 0; y < alto; y += lado) {
        for (let x = 0; x < ancho; x += lado) {
          if (tapado(x, y)) continue;
          bloques += 1;
          let malos = 0;
          for (let dy = 0; dy < lado && y + dy < alto; dy += 1) {
            for (let dx = 0; dx < lado && x + dx < ancho; dx += 1) {
              const i = ((y + dy) * ancho + (x + dx)) * 4;
              // La tinta (letras, iconos, bordes finos) no se compara aquí: va por los estilos.
              if (liso(entornoA, i) && liso(entornoB, i) && difiere(i)) malos += 1;
            }
          }
          if (malos >= minimo) distintos.push({ x, y, diferencia: malos });
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
      radio: opciones.radio ?? RADIO_DEL_VECINDARIO,
      minimo: opciones.minimo ?? PIXELES_PARA_CONTAR_EL_BLOQUE,
      tapar: [...(opciones.tapar ?? [])],
    },
  );
}
