/**
 * ¿SE MENCIONA EL IVA? (DP-21 · Bloque 1). Una sola regla para todos los papeles y pantallas.
 *
 * Si el IVA de lo que se enseña es 0, el renglón no existe: ni «IVA $0.00» ni «IVA incluido».
 * Vale para la precuenta, el ticket, la reimpresión, el ticket dividido, el cobro de la Caja, el
 * corte, Registros, el portal y las exportaciones. La decide el IMPORTE de lo que se enseña y no
 * la configuración: una cuenta cobrada con 16 % la semana pasada sigue diciendo su IVA aunque el
 * negocio hoy esté en «Sin IVA», y una de hoy, cobrada sin IVA, no lo menciona.
 *
 * No cambia ningún total: sólo decide si un renglón se pinta.
 */
export function seMencionaElIva(importe: number | bigint | string | null | undefined): boolean {
  if (importe === null || importe === undefined) return false;
  if (typeof importe === 'bigint') return importe > 0n;
  const numero = typeof importe === 'string' ? Number(importe) : importe;
  return Number.isFinite(numero) && numero > 0;
}

/**
 * Las columnas de una exportación sin la del IVA cuando ninguna fila lo trae: un CSV de un negocio
 * sin IVA no lleva una columna «Impuestos» llena de ceros.
 */
export function sinColumnaDeIvaEnCeros<C extends { readonly key: string }>(
  columnas: readonly C[],
  filas: readonly Readonly<Record<string, unknown>>[] | null | undefined,
  clave = 'impuestos',
): readonly C[] {
  const alguna = (filas ?? []).some((fila) =>
    seMencionaElIva(fila[clave] as number | string | null | undefined),
  );
  return alguna ? columnas : columnas.filter((columna) => columna.key !== clave);
}
