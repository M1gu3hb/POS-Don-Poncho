/**
 * LIBERAR UNA MESA QUE ENCABEZA UN GRUPO (DP-9.6), sin pantalla: al limpiar la principal de mesas
 * unidas el servidor pide decidir (`MESA_UNIDA_SIN_DECISION`); se pregunta y se vuelve a intentar
 * con la respuesta. La pregunta la pone quien llama (`liberar-con-pregunta.tsx`).
 */

export type DecisionDelGrupo = 'separar' | 'mantener';

export type EjecutarLiberar = (entrada: {
  mesaId: string;
  grupo?: DecisionDelGrupo;
}) => Promise<unknown>;

/**
 * La regla de negocio por la que el servidor se negó. Llega de dos clientes: el de las pantallas
 * nuevas (`ErrorApi`, con el error del comando en `.error`) y el heredado (`ErrorPuente`, con
 * sus `datos` a la vista).
 */
export function reglaDe(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const { error: detalle, datos } = error as {
    error?: { datos?: Readonly<Record<string, unknown>> };
    datos?: Readonly<Record<string, unknown>>;
  };
  const regla = detalle?.datos?.['regla'] ?? datos?.['regla'];
  return typeof regla === 'string' ? regla : null;
}

/**
 * `false`: se canceló la pregunta y la mesa sigue como estaba. Si la pantalla ya sabe que la
 * mesa encabeza un grupo (`encabezaGrupo`), pregunta ANTES y libera una sola vez; si no lo sabe,
 * lo dice el servidor y se pregunta entonces.
 */
export async function liberarConDecision(
  mesaId: string,
  ejecutar: EjecutarLiberar,
  preguntar: () => Promise<DecisionDelGrupo | null>,
  encabezaGrupo = false,
): Promise<boolean> {
  if (encabezaGrupo) {
    const grupo = await preguntar();
    if (grupo === null) return false;
    await ejecutar({ mesaId, grupo });
    return true;
  }
  try {
    await ejecutar({ mesaId });
    return true;
  } catch (error: unknown) {
    if (reglaDe(error) !== 'MESA_UNIDA_SIN_DECISION') throw error;
  }
  const grupo = await preguntar();
  if (grupo === null) return false;
  await ejecutar({ mesaId, grupo });
  return true;
}

/**
 * LOS TEXTOS DE LA PREGUNTA, una sola vez. Los usan el diálogo de liberar (`liberar-con-pregunta`)
 * y el de cancelar la cuenta de mesas unidas (DP-18, A19): es LA MISMA pregunta y no se inventa otra.
 */
export const PREGUNTA_DEL_GRUPO = '¿Separar mesas o dejarlas unidas?';
export const EXPLICACION_DEL_GRUPO =
  'Separadas, cada mesa vuelve a su lugar y a su número. Unidas, el siguiente cliente las encuentra juntas, con el mismo número.';
export const SEPARAR_MESAS = 'Separar mesas';
export const DEJARLAS_UNIDAS = 'Dejarlas unidas';
