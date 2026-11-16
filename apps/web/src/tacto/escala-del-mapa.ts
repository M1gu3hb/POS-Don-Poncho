import { medidasDeMesa } from '@morphiqpos/domain/sala';

/**
 * LA ESCALA DEL MAPA DE MESAS (DP-21 · Bloque 9 · O4/M2) · la cuenta, pura.
 *
 * El mapa medía 600 px fijos con las mesas en píxeles absolutos y `overflow-hidden`: con la barra
 * lateral abierta (240 px menos de ancho) las mesas de la orilla se cortaban, sin manera de llegar a
 * ellas. Ahora el DIBUJO ENTERO de la zona se escala para caber en el ancho y el alto que hay, sin
 * mover las posiciones guardadas (lo único que cambia es la escala con la que se pinta).
 *
 *  · nunca se agranda: más de 1 no (se vería distinto en una pantalla grande);
 *  · ninguna mesa baja de 56 px: si la escala que haría falta dejaría una más chica, se queda en la
 *    escala mínima y el mapa se DESPLAZA con el dedo, en los dos sentidos si hace falta;
 *  · una mesa que de por sí mide menos de 56 a escala 1 (la rectangular chica, 90 × 55) no se
 *    encoge más: el piso no se puede cumplir por debajo de 1, y 1 es lo de siempre;
 *  · la escala va a milésimas HACIA ABAJO para ajustar (lo escalado nunca pasa del espacio) y HACIA
 *    ARRIBA para el mínimo (56 px son 56 px): un píxel de más no hace temblar al observador.
 *
 * Todas las medidas son puntos del plano (las de la base de datos) salvo `pantalla` y `caja`, que
 * son píxeles de la pantalla.
 */

/** Lo que mide a lo mínimo la mesa más chica en la pantalla: un dedo no acierta menos que esto. */
export const MINIMO_POR_MESA_PX = 56;
/** El aire de arriba, la izquierda y abajo del dibujo. */
export const MARGEN_DEL_LIENZO = 16;
/**
 * El aire de la derecha: los globos de solicitud cuelgan centrados sobre su mesa y llegan a 224 px
 * de ancho. Con sólo 16 px, el de la mesa de la orilla derecha se cortaba contra el borde.
 */
export const MARGEN_DERECHO_DEL_LIENZO = 72;
/** El alto de siempre del mapa (`MAP_HEIGHT`): se conserva cuando la pantalla da para tanto. */
export const ALTO_BASE_DEL_MAPA = 600;
/** Aunque la pantalla sea muy baja (un teléfono de lado), el mapa no se queda en una tira. */
export const ALTO_MINIMO_DEL_MAPA = 280;

/** Una mesa tal como se pinta: su esquina y su tamaño, en puntos del plano. */
export interface CajaDeMesa {
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly alto: number;
}

export interface EntradaDeLaEscala {
  /** Ancho que tiene el mapa, en píxeles (lo que mide su caja). Sin medir aún: 0. */
  readonly anchoDisponible: number;
  /** Alto que queda en la pantalla desde donde empieza el mapa, en píxeles. */
  readonly altoDisponible: number;
  readonly mesas: readonly CajaDeMesa[];
}

export interface EscalaDelMapa {
  readonly escala: number;
  /** El dibujo entero a escala 1: hasta donde llega la última mesa, más los márgenes. */
  readonly lienzo: { readonly ancho: number; readonly alto: number };
  /** El dibujo ya escalado, en píxeles de la pantalla. */
  readonly pantalla: { readonly ancho: number; readonly alto: number };
  /** La caja que se ve (la ventana al dibujo), en píxeles. */
  readonly caja: { readonly alto: number };
  readonly desplazaX: boolean;
  readonly desplazaY: boolean;
  readonly desplaza: boolean;
}

const abajo = (n: number): number => Math.floor(n * 1000) / 1000;
const arriba = (n: number): number => Math.ceil(n * 1000) / 1000;
/** Medio píxel de holgura: la caja y el dibujo miden decimales que no son un desplazamiento. */
const HOLGURA_PX = 0.5;

const utilizable = (n: number): boolean => Number.isFinite(n) && n > 0;

export function calcularEscalaDelMapa(entrada: EntradaDeLaEscala): EscalaDelMapa {
  const { anchoDisponible, altoDisponible, mesas } = entrada;
  const lienzo =
    mesas.length === 0
      ? { ancho: utilizable(anchoDisponible) ? anchoDisponible : 0, alto: ALTO_BASE_DEL_MAPA }
      : {
          ancho: Math.max(...mesas.map((m) => m.x + m.ancho)) + MARGEN_DERECHO_DEL_LIENZO,
          alto: Math.max(...mesas.map((m) => m.y + m.alto)) + MARGEN_DEL_LIENZO,
        };

  // El lado corto de la mesa más chica manda el piso: es el que baja de 56 primero.
  const lados = mesas.map((m) => Math.min(m.ancho, m.alto)).filter((lado) => lado > 0);
  const masChica = lados.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...lados);
  const escalaMinima = Math.min(1, arriba(MINIMO_POR_MESA_PX / masChica));

  const medido = mesas.length > 0 && utilizable(anchoDisponible);
  const alto = utilizable(altoDisponible) ? altoDisponible : ALTO_BASE_DEL_MAPA;
  const ajuste = medido ? Math.min(1, anchoDisponible / lienzo.ancho, alto / lienzo.alto) : 1;
  const escala = medido ? Math.max(escalaMinima, abajo(ajuste)) : 1;

  const pantalla = { ancho: lienzo.ancho * escala, alto: lienzo.alto * escala };
  const cajaAlto = Math.max(
    ALTO_MINIMO_DEL_MAPA,
    Math.min(alto, Math.max(pantalla.alto, ALTO_BASE_DEL_MAPA)),
  );
  const desplazaX = medido && pantalla.ancho > anchoDisponible + HOLGURA_PX;
  const desplazaY = medido && pantalla.alto > cajaAlto + HOLGURA_PX;
  return {
    escala,
    lienzo,
    pantalla,
    caja: { alto: cajaAlto },
    desplazaX,
    desplazaY,
    desplaza: desplazaX || desplazaY,
  };
}

/** Lo que se lee de una mesa para ponerla en el plano. */
export interface MesaParaElMapa {
  readonly id: string;
  readonly posicion_x?: number | null | undefined;
  readonly posicion_y?: number | null | undefined;
  readonly forma?: string | null | undefined;
  readonly tamano?: string | null | undefined;
}

/** Donde el mapa pinta una mesa sin posición: igual que `MesaShape`. */
const POSICION_POR_OMISION = 100;

/**
 * Las cajas que de verdad se pintan: cada mesa en su posición con sus medidas, y una unión viva
 * (`cajaDeLaUnion`) en la caja fundida del grupo, que es la que se dibuja en lugar de la suya.
 */
export function cajasDelMapa(
  mesas: readonly MesaParaElMapa[],
  cajaDeLaUnion: (id: string) => CajaDeMesa | null,
): CajaDeMesa[] {
  return mesas.map((mesa) => {
    const unida = cajaDeLaUnion(mesa.id);
    if (unida !== null) return unida;
    const { ancho, alto } = medidasDeMesa(mesa.forma, mesa.tamano);
    return {
      x: mesa.posicion_x ?? POSICION_POR_OMISION,
      y: mesa.posicion_y ?? POSICION_POR_OMISION,
      ancho,
      alto,
    };
  });
}
