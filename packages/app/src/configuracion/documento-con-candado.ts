import 'server-only';

import type { Transaccion } from '@morphiqpos/data';

/**
 * EL DOCUMENTO DE CONFIGURACIÓN, TOMADO CON CANDADO (DP-13.3b).
 *
 * `configuracion.valores` es UN documento por organización que escriben varios módulos: la
 * pantalla de Configuración, la apariencia, la marca de plataforma, el teléfono de cocina y el
 * reseteo de las pruebas. Lo que lo hace peligroso es que casi todos lo escriben ENTERO: leen el
 * documento, le cambian su parte y guardan el resultado. Sin candado, dos de ellos que se cruzan
 * leen el mismo documento viejo y el segundo en escribir BORRA, sin error, lo que puso el
 * primero: la marca de plataforma (que habilita los botones que borran en masa) o «quién manda a
 * cocina» del portal.
 *
 * Toda escritura que lee antes de escribir lo hace por aquí: `select … for update` de la fila,
 * dentro de la transacción del comando. La segunda escritura espera a que la primera confirme y
 * LEE después, con lo suyo ya dentro. (`telefono-de-cocina/conectar.ts` no lee: mezcla en una
 * sola sentencia `valores || …`, que es atómica por sí sola.)
 *
 * Una organización sin fila devuelve `undefined`: no hay nada que tomar, y de ahí no se puede
 * perder nada. La restricción única de `organizacion_id` impide el segundo documento: de dos
 * primeras escrituras simultáneas la segunda falla (o, donde se declara `on conflict`, no
 * escribe) en vez de pisar a la primera.
 */
export interface DocumentoDeConfiguracion {
  readonly id: string;
  /** El JSON tal como está en la base: quien lo usa lo estrecha, no se le promete forma. */
  readonly valores: unknown;
  readonly version: number;
}

export function leerDocumentoConCandado(
  tx: Transaccion,
  organizacionId: string,
): Promise<DocumentoDeConfiguracion | undefined> {
  return tx
    .selectFrom('configuracion')
    .select(['id', 'valores', 'version'])
    .where('organizacion_id', '=', organizacionId)
    .forUpdate()
    .executeTakeFirst();
}
