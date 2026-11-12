/**
 * DP-18 · «PERSONALIZAR MENÚ»: lo que se edita del menú digital, sin pantalla (se prueba aparte).
 *
 * Por platillo: la foto, la descripción corta y el fondo de la tarjeta (sin foto). Del menú: el orden
 * de las secciones. Cada cosa se guarda con SU parche (sólo lo que cambió), igual que las secciones
 * de Configuración, para no pisar con lo viejo lo que otro aparato cambió mientras tanto.
 */
export const LARGO_MAXIMO_DE_LA_DESCRIPCION = 140;

export interface PlatilloEditable {
  readonly id: string;
  readonly descripcion?: string | null;
  readonly imagen_url?: string | null;
  readonly fondo_tarjeta?: string | null;
}

export interface SeccionOrdenable {
  readonly id: string;
  readonly orden?: number | null;
}

export type EdicionDelPlatillo = Partial<
  Pick<PlatilloEditable, 'descripcion' | 'imagen_url' | 'fondo_tarjeta'>
>;

const CAMPOS = ['descripcion', 'imagen_url', 'fondo_tarjeta'] as const;

const normal = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};

/** Sólo lo que cambió del platillo (vacío si nada): lo que se manda al guardar. */
export function parcheDelPlatillo(
  original: PlatilloEditable,
  edicion: EdicionDelPlatillo,
): EdicionDelPlatillo {
  const parche: Record<string, string | null> = {};
  for (const campo of CAMPOS) {
    if (!(campo in edicion)) continue;
    const nuevo = normal(edicion[campo]);
    if (nuevo !== normal(original[campo])) parche[campo] = nuevo;
  }
  return parche;
}

/** El motivo para no guardar la descripción, o `null` si se puede. */
export function problemaDeLaDescripcion(texto: string | null | undefined): string | null {
  const largo = (texto ?? '').trim().length;
  return largo > LARGO_MAXIMO_DE_LA_DESCRIPCION
    ? `La descripción corta va de ${String(LARGO_MAXIMO_DE_LA_DESCRIPCION)} letras como máximo (lleva ${String(largo)}).`
    : null;
}

/** El platillo como se verá: lo guardado con lo que se está editando encima. */
export function conLaEdicion<P extends PlatilloEditable>(
  platillo: P,
  edicion: EdicionDelPlatillo | undefined,
): P {
  if (edicion === undefined) return platillo;
  return {
    ...platillo,
    ...('descripcion' in edicion ? { descripcion: normal(edicion.descripcion) } : {}),
    ...('imagen_url' in edicion ? { imagen_url: normal(edicion.imagen_url) } : {}),
    ...('fondo_tarjeta' in edicion ? { fondo_tarjeta: normal(edicion.fondo_tarjeta) } : {}),
  };
}

/** Las secciones en el orden en que se ven (por `orden`, y las empatadas como venían). */
export function enSuOrden<S extends SeccionOrdenable>(secciones: readonly S[]): S[] {
  return secciones
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (a.s.orden ?? 0) - (b.s.orden ?? 0) || a.i - b.i)
    .map(({ s }) => s);
}

/** Sube o baja una sección un lugar. En la orilla, la deja igual. */
export function moverSeccion<S extends SeccionOrdenable>(
  secciones: readonly S[],
  id: string,
  hacia: 'arriba' | 'abajo',
): S[] {
  const lista = [...secciones];
  const i = lista.findIndex((s) => s.id === id);
  const j = hacia === 'arriba' ? i - 1 : i + 1;
  if (i === -1 || j < 0 || j >= lista.length) return lista;
  const a = lista[i];
  const b = lista[j];
  if (a === undefined || b === undefined) return lista;
  lista[i] = b;
  lista[j] = a;
  return lista;
}

/** El `orden` nuevo (1, 2, 3…) de las secciones que cambiaron de lugar: lo que se guarda. */
export function ordenQueCambio(
  guardadas: readonly SeccionOrdenable[],
  nuevas: readonly SeccionOrdenable[],
): readonly { readonly id: string; readonly orden: number }[] {
  const antes = new Map(guardadas.map((s) => [s.id, s.orden ?? null]));
  return nuevas
    .map((s, i) => ({ id: s.id, orden: i + 1 }))
    .filter((s) => antes.get(s.id) !== s.orden);
}
