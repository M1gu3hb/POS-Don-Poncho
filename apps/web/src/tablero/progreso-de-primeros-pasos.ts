/**
 * EL PROGRESO DE «PRIMEROS PASOS» · sacado del tablero (DP-11.4).
 *
 * Eran ocho banderas calculadas dentro de `Dashboard.jsx` con lo que YA existe en la base. Es
 * sólo informativo: no bloquea nada. Aquí es una función pura, con su prueba, para que el
 * tablero siga siendo un cascarón de consultas y orden. La regla es la de siempre, sin cambiar
 * un criterio.
 */

/** Los nombres con los que un negocio nuevo arranca: mientras los lleve, no está configurado. */
const NOMBRES_POR_DEFECTO: readonly string[] = ['MH Astral Systems', 'Mi negocio', ''];

export interface ConfiguracionParaElProgreso {
  readonly nombre_negocio?: string | null | undefined;
  readonly usa_mesas?: boolean | null | undefined;
  readonly unidades_medida_lista?: string | null | undefined;
}

type Lista = readonly unknown[] | null | undefined;

export interface EntradasDelProgreso {
  readonly config: ConfiguracionParaElProgreso | null | undefined;
  readonly usuarios: Lista;
  readonly mesas: Lista;
  readonly categorias: Lista;
  readonly ingredientes: Lista;
  readonly productos: Lista;
  /** Hay una caja abierta ahora. */
  readonly hayCaja: boolean;
  /** Los cortes más recientes: con uno basta para saber que alguna vez se abrió caja. */
  readonly cortes: Lista;
}

export interface ProgresoDePrimerosPasos {
  readonly negocio: boolean;
  readonly usuarios: boolean;
  readonly mesas: boolean;
  readonly categorias: boolean;
  readonly unidades: boolean;
  readonly inventario: boolean;
  readonly recetas: boolean;
  readonly caja: boolean;
}

/** Una lectura que aún no llegó, o que llegó rota, cuenta como «no hay nada». */
const hay = (lista: Lista): boolean => Array.isArray(lista) && lista.length > 0;

/** El texto sin espacios de los bordes; lo que no es texto cuenta como vacío. */
const texto = (valor: string | null | undefined): string =>
  typeof valor === 'string' ? valor.trim() : '';

export function progresoDePrimerosPasos({
  config,
  usuarios,
  mesas,
  categorias,
  ingredientes,
  productos,
  hayCaja,
  cortes,
}: EntradasDelProgreso): ProgresoDePrimerosPasos {
  const unidades = texto(config?.unidades_medida_lista);
  return {
    negocio: !NOMBRES_POR_DEFECTO.includes(texto(config?.nombre_negocio)),
    usuarios: hay(usuarios),
    // Un negocio sin mesas no tiene que configurar ninguna.
    mesas: config?.usa_mesas === false ? true : hay(mesas),
    categorias: hay(categorias),
    unidades: unidades.length > 0,
    inventario: hay(ingredientes),
    recetas: hay(productos),
    caja: hayCaja || hay(cortes),
  };
}
