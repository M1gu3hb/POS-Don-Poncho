/**
 * DP-15.1 (DP-D92) · CÓMO LEE PRODUCCIÓN UN GUION DE REVISIÓN.
 *
 * La app entra a la base por el pooler de transacción (Supavisor, puerto 6543): una conexión del
 * servidor la usan muchos clientes, uno tras otro. Lo que un guion deje pegado en ella —un `SET` de
 * sesión, una transacción que no se cerró— lo hereda la siguiente petición de la app. Así, el 08 y
 * el 09-11, unos guiones de revisión con `set default_transaction_read_only = on` dejaron al
 * limitador y al carrito del portal fallando con `25006` (DP-D91, DP-D92).
 *
 * Por eso un guion que lee una base real:
 * 1. entra por la conexión directa o la de sesión (5432), **nunca** por el 6543: aquí se rechaza;
 * 2. lee dentro de UNA transacción `read only` y la cierra con `rollback` en un `finally`, pase lo
 *    que pase en medio.
 */

/** El puerto del pooler de transacción de Supabase: el de la app, nunca el de un guion. */
export const PUERTO_DEL_POOLER_DE_TRANSACCION = '6543';

/**
 * Devuelve la URL si un guion puede usarla; si es la del pooler de transacción, lanza.
 *
 * @param {string | undefined} cadena
 * @returns {URL}
 */
export function exigirConexionDirecta(cadena) {
  let url;
  try {
    url = new URL(cadena ?? '');
  } catch {
    throw new Error('La cadena de conexión falta o no es una URL.');
  }
  if (url.port === PUERTO_DEL_POOLER_DE_TRANSACCION) {
    throw new Error(
      'Esta cadena entra por el pooler de transacción (6543), el de la app. Un guion lee por la ' +
        'conexión directa o la de sesión (5432): lo que deje pegado en el pooler lo hereda la app (DP-D92).',
    );
  }
  return url;
}

/**
 * Corre `leer` dentro de una transacción de sólo lectura y la cierra con `rollback` siempre.
 *
 * @template T
 * @param {{ query: (texto: string) => Promise<unknown> }} cliente  un `pg.Client` ya conectado.
 * @param {(cliente: any) => Promise<T>} leer
 * @param {{ aislamiento?: 'read committed' | 'repeatable read' }} [opciones]
 * @returns {Promise<T>}
 */
export async function leerEnSoloLectura(cliente, leer, opciones = {}) {
  const aislamiento = opciones.aislamiento ?? 'repeatable read';
  await cliente.query(`begin transaction isolation level ${aislamiento} read only`);
  try {
    return await leer(cliente);
  } finally {
    // Sólo se leyó: `rollback` cierra igual que `commit`. Si ni él contesta, se dice y se sigue;
    // quien llama cierra la conexión, y con ella cualquier cosa que quedara abierta.
    await cliente.query('rollback').catch((error) => {
      console.error(`  (rollback: ${String(error)})`);
    });
  }
}
