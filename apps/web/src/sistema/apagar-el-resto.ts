/**
 * DP-17 (QA de DP-16, D-H-09) · UNA VENTANA HECHA A MANO, MODAL PARA EL LECTOR DE PANTALLA.
 *
 * Deja `inert` todo lo que está junto a la capa de la ventana (ni foco, ni lector, ni clic) y
 * devuelve con qué volver a como estaba. Lo que ya estaba `inert` por otra razón no se toca al
 * volver. Las ventanas del sistema (Radix) ya lo hacen solas; esto es para las heredadas.
 */
export function apagarElResto<T extends { inert: boolean }>(
  capa: T,
  hermanos: readonly T[],
): () => void {
  const apagados = hermanos.filter((h) => h !== capa && !h.inert);
  for (const h of apagados) h.inert = true;
  return () => {
    for (const h of apagados) h.inert = false;
  };
}
