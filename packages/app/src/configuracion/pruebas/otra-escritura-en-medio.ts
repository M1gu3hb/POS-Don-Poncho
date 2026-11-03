import { conTransaccion, obtenerDb, type Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';

/**
 * LA CARRERA DE DOS ESCRITURAS DE CONFIGURACIÓN, forzada (DP-13.3b).
 *
 * Un `Promise.all` de dos comandos sólo prueba la carrera cuando el planificador quiere: si el
 * primero confirma antes de que el segundo lea, la prueba sale verde aunque el segundo no tenga
 * ningún candado. Aquí el cruce no depende del azar:
 *
 *   1. La prueba toma el candado de la fila `configuracion` de la organización.
 *   2. Lanza el escritor que se prueba y ESPERA, observándolo en `pg_stat_activity`, a que quede
 *      detenido en un candado de esa fila. Un escritor SIN `for update` lee el documento (todavía
 *      sin la otra escritura) y se detiene al escribir; uno CON `for update` se detiene al leer.
 *   3. Con el escritor detenido, la prueba hace «la otra escritura» —la que un `marcar_plataforma`
 *      o un «quién manda a cocina» confirmado en ese instante habría hecho— y confirma.
 *
 * Si el escritor leyó antes, escribe su documento viejo y PISA la otra escritura; si el candado
 * lo obligó a leer después, la conserva. No se espera un tiempo: se observa en Postgres.
 */

const INTERVALO_MS = 10;
const PLAZO_MS = 10_000;

/** ¿Hay alguna conexión de ESTA base detenida en un candado, ejecutando algo de `configuracion`? */
async function hayUnaEsperandoPorLaConfiguracion(): Promise<boolean> {
  const { rows } = await sql<{ n: number }>`
    select count(*)::int as n
      from pg_stat_activity
     where datname = current_database()
       and pid <> pg_backend_pid()
       and wait_event_type = 'Lock'
       and query ~* 'configuracion'
  `.execute(obtenerDb());
  return (rows[0]?.n ?? 0) > 0;
}

async function esperarAlEscritor(): Promise<void> {
  const limite = Date.now() + PLAZO_MS;
  while (!(await hayUnaEsperandoPorLaConfiguracion())) {
    if (Date.now() > limite) {
      throw new Error(
        'El escritor no llegó a esperar por la fila de configuración: no tomó su candado ni ' +
          'llegó a escribir, y la prueba no cruzó nada.',
      );
    }
    await new Promise((listo) => setTimeout(listo, INTERVALO_MS));
  }
}

/**
 * Corre `escritor` con `otraEscritura` confirmada EN MEDIO de su lectura y su escritura, y
 * devuelve lo que contestó el escritor. `otraEscritura` recibe la transacción que tiene el candado.
 */
export async function conOtraEscrituraEnMedio<T>(
  organizacionId: string,
  escritor: () => Promise<T>,
  otraEscritura: (tx: Transaccion) => Promise<void>,
): Promise<T> {
  let corriendo: Promise<PromiseSettledResult<T>[]> = Promise.resolve([]);
  await conTransaccion(async (tx) => {
    await tx
      .selectFrom('configuracion')
      .select('id')
      .where('organizacion_id', '=', organizacionId)
      .forUpdate()
      .execute();
    corriendo = Promise.allSettled([escritor()]);
    await esperarAlEscritor();
    await otraEscritura(tx);
  });
  const [resultado] = await corriendo;
  if (resultado === undefined) throw new Error('El escritor no devolvió nada.');
  if (resultado.status === 'rejected') {
    throw resultado.reason instanceof Error
      ? resultado.reason
      : new Error('El escritor se cayó sin un Error.');
  }
  return resultado.value;
}

/** Mezcla `claves` en el documento sin tocar lo demás, como lo haría una escritura de otro módulo. */
export async function mezclarEnElDocumento(
  tx: Transaccion,
  organizacionId: string,
  claves: Readonly<Record<string, unknown>>,
  subirVersion = false,
): Promise<void> {
  await sql`
    update configuracion
       set valores = valores || ${JSON.stringify(claves)}::jsonb,
           version = version + ${subirVersion ? 1 : 0}
     where organizacion_id = ${organizacionId}
  `.execute(tx);
}

export async function documentoActual(organizacionId: string) {
  return obtenerDb()
    .selectFrom('configuracion')
    .select(['valores', 'version'])
    .where('organizacion_id', '=', organizacionId)
    .executeTakeFirstOrThrow();
}
