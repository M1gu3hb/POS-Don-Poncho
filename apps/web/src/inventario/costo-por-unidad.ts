/**
 * EL COSTO POR UNIDAD BASE, COMO LO LEE UN DUEÑO (DP-D165).
 *
 * El puente sirve ahora el costo por gramo o por mililitro con todos sus decimales (la leche, a
 * $480.00 los 20 L, es `0.024` pesos el mililitro). Enseñarlo tal cual —«$0.024 / ml», o peor,
 * «$0.02 / ml» por pasarlo por un formato de dos decimales— confunde: nadie compra por mililitro.
 * Se enseña por la unidad con la que se compra y se habla: el kilo y el litro.
 *
 *   · gramo → «$45.00/kg»        · mililitro → «$24.00/L»
 *   · pieza, metro, kilo, litro → tal cual («$0.998/pieza» si lleva sub-centavos).
 *
 * Sólo cambia lo que se MUESTRA: el costo que se multiplica sigue siendo el exacto.
 */

const POR_KILO_O_LITRO = 1000;
/** Menos que esto es ruido de coma flotante, no un sub-centavo. */
const TOLERANCIA = 1e-9;
const DECIMALES_DEL_SUBCENTAVO = 4;

export interface CostoParaMostrar {
  /** Pesos por la unidad que se muestra. */
  readonly pesos: number;
  /** La unidad que se muestra: `kg`, `L` o la unidad base tal cual. */
  readonly unidad: string;
}

/** El costo por unidad base, llevado a la unidad con la que se compra: gramos a kilos, mililitros a litros. */
export function costoPorUnidadParaMostrar(
  pesosPorUnidadBase: number,
  unidadBase: string | null | undefined,
): CostoParaMostrar {
  const unidad = (unidadBase ?? '').trim();
  if (unidad === 'g') return { pesos: pesosPorUnidadBase * POR_KILO_O_LITRO, unidad: 'kg' };
  if (unidad === 'ml') return { pesos: pesosPorUnidadBase * POR_KILO_O_LITRO, unidad: 'L' };
  return { pesos: pesosPorUnidadBase, unidad: unidad === '' ? 'unidad' : unidad };
}

/**
 * «$24.00/L». Con dos decimales cuando el importe es de centavos enteros; con hasta cuatro cuando
 * lleva sub-centavos, para no redondear a la vista lo que se guardó exacto.
 *
 * @param formatear el formato de pesos de la pantalla (dos decimales).
 */
export function textoDelCostoPorUnidad(
  pesosPorUnidadBase: number,
  unidadBase: string | null | undefined,
  formatear: (pesos: number) => string,
): string {
  const { pesos, unidad } = costoPorUnidadParaMostrar(pesosPorUnidadBase, unidadBase);
  const aCentavos = Math.round(pesos * 100) / 100;
  const cuerpo =
    Math.abs(pesos - aCentavos) < TOLERANCIA
      ? formatear(aCentavos)
      : `$${String(Number(pesos.toFixed(DECIMALES_DEL_SUBCENTAVO)))}`;
  return `${cuerpo}/${unidad}`;
}
