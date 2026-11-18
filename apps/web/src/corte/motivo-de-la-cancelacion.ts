/**
 * DP-D179 · EL MOTIVO DE UNA CANCELACIÓN, CON QUIÉN LA AUTORIZÓ.
 *
 * Cuando la cuenta ya estaba pedida (o su precuenta impresa), cancelarla o quitar un platillo
 * lleva el PIN de un gerente, administrador o dueño. La lectura del servidor (`autorizo`) lo trae;
 * el corte, Registros y el corte de la Caja lo ponen junto al motivo, con este mismo texto.
 */

export interface MotivoYAutorizacion {
  readonly motivo?: string | null | undefined;
  readonly autorizo?: string | null | undefined;
}

export function motivoDeLaCancelacion(c: MotivoYAutorizacion): string | null {
  const motivo = c.motivo?.trim() ?? '';
  const autorizo = c.autorizo?.trim() ?? '';
  if (motivo !== '' && autorizo !== '') return `${motivo} · Autorizó ${autorizo}`;
  if (motivo !== '') return motivo;
  if (autorizo !== '') return `Autorizó ${autorizo}`;
  return null;
}
