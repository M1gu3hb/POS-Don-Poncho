/**
 * DP-22 · CÓMO ESTÁ EL NEGOCIO PARA ABRIR: lo lee, en una transacción de sólo lectura, y dice qué
 * falta. Lo usan `scripts/dia-cero.mjs` y la verificación de la Parte 11.
 *
 * Sólo lee: la transacción se declara `read only` (vale para ESA transacción, no para la sesión:
 * nada queda pegado en la conexión, DP-D92).
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// `kysely` es dependencia de `packages/data`, no de la raíz: se pide desde allá.
const RAIZ = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const { sql } = createRequire(join(RAIZ, 'packages', 'data', 'package.json'))('kysely');

/** Lo que el negocio debe tener el día que abre (DP-22 · Parte 11). */
export const ARRANQUE = {
  prefijo: 'DP',
  primerFolioDeCuentas: 1001,
  primerFolioDeCortes: 101,
  cajas: 2,
  nombresDeCajas: ['Caja 1', 'Caja 2'],
};

/**
 * @param {import('kysely').Kysely<any>} db
 * @param {string} organizacionId
 */
export async function leerEstadoDeArranque(db, organizacionId) {
  return db.transaction().execute(async (tx) => {
    await sql`set transaction read only`.execute(tx);
    const numero = async (consulta) => Number((await consulta.execute(tx)).rows[0]?.n ?? 0);
    const de = (tabla) =>
      sql`select count(*) as n from ${sql.table(tabla)} where organizacion_id = ${organizacionId}`;

    const configuracion = await tx
      .selectFrom('configuracion')
      .select('valores')
      .where('organizacion_id', '=', organizacionId)
      .executeTakeFirst();
    const valores = configuracion?.valores ?? {};
    const operacionDesde =
      typeof valores['operacion_desde'] === 'string' ? valores['operacion_desde'] : null;

    const cuentas = await sql`
      select count(*)::int as cuentas,
             count(*) filter (where estado = 'pagada')::int as cobradas,
             min(created_at) as primera, max(created_at) as ultima,
             count(*) filter (where ${operacionDesde}::timestamptz is not null
                              and created_at > ${operacionDesde}::timestamptz)::int as posteriores
      from ordenes where organizacion_id = ${organizacionId}`.execute(tx);
    const cajasAbiertas = await sql`
      select t.nombre as aparato, s.abierta_en
      from sesiones_caja s join terminales t on t.id = s.terminal_id
      where s.organizacion_id = ${organizacionId} and s.estado = 'abierta'
      order by s.abierta_en`.execute(tx);
    const folios = await sql`
      select serie, siguiente::text as siguiente from folios
      where organizacion_id = ${organizacionId} and serie in ('A', 'CC') order by serie`.execute(
      tx,
    );
    const mesas = await sql`
      select count(*)::int as total, count(*) filter (where estado = 'libre')::int as libres
      from mesas where organizacion_id = ${organizacionId} and activa`.execute(tx);
    const sucursal = await sql`
      select cajas_simultaneas from sucursales
      where organizacion_id = ${organizacionId} order by created_at limit 1`.execute(tx);
    const almacenes = await sql`
      select nombre, principal from almacenes where organizacion_id = ${organizacionId}`.execute(
      tx,
    );
    const aparatos = await sql`
      select count(*)::int as total, count(*) filter (where nombre ~ '^Caja [0-9]+$')::int as viejos
      from terminales where organizacion_id = ${organizacionId}`.execute(tx);

    return {
      cuentas: cuentas.rows[0],
      cajasAbiertas: cajasAbiertas.rows,
      cajas: await numero(de('sesiones_caja')),
      comandas: await numero(de('comandas')),
      carritos: await numero(de('carritos_mesa')),
      folios: Object.fromEntries(folios.rows.map((fila) => [fila.serie, fila.siguiente])),
      mesas: mesas.rows[0],
      cupo: sucursal.rows[0]?.cajas_simultaneas ?? null,
      almacenes: almacenes.rows,
      aparatos: aparatos.rows[0],
      operacionDesde,
      impuesto: valores['impuesto'] ?? null,
      foliosConfigurados: valores['folios'] ?? null,
      nombresDeCajas: valores['nombres_de_cajas'] ?? null,
      silenciarAvisosDelAdministrador: valores['silenciar_notificaciones_admin'] !== false,
    };
  });
}

const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Lo que impide abrir. `conBloqueo` exige además que el bloqueo H1 esté activo (el día cero).
 *
 * @param {Awaited<ReturnType<typeof leerEstadoDeArranque>>} estado
 * @param {{ conBloqueo?: boolean, conPrimerFolio?: boolean }} [opciones]
 * @returns {string[]}
 */
export function faltasParaAbrir(estado, opciones = {}) {
  const { conBloqueo = false, conPrimerFolio = true } = opciones;
  const faltas = [];
  const exigir = (bien, texto) => {
    if (!bien) faltas.push(texto);
  };
  exigir(estado.cuentas.cuentas === 0, `hay ${String(estado.cuentas.cuentas)} cuenta(s)`);
  exigir(
    estado.cajasAbiertas.length === 0,
    `hay ${String(estado.cajasAbiertas.length)} caja(s) abierta(s)`,
  );
  exigir(estado.cajas === 0, `quedan ${String(estado.cajas)} caja(s) con su corte`);
  exigir(estado.comandas === 0, `hay ${String(estado.comandas)} comanda(s)`);
  exigir(estado.carritos === 0, `hay ${String(estado.carritos)} carrito(s) del portal`);
  exigir(
    estado.mesas.total > 0 && estado.mesas.libres === estado.mesas.total,
    `sólo ${String(estado.mesas.libres)} de ${String(estado.mesas.total)} mesas están libres`,
  );
  exigir(estado.impuesto?.puntosBase === 0, 'el IVA no está en «Sin IVA»');
  exigir(estado.foliosConfigurados?.prefijo === ARRANQUE.prefijo, 'el prefijo de folio no es «DP»');
  exigir(estado.cupo === ARRANQUE.cajas, `el cupo de cajas es ${String(estado.cupo)}, no 2`);
  exigir(
    igual((estado.nombresDeCajas ?? []).slice(0, 2), ARRANQUE.nombresDeCajas),
    'las cajas no se llaman «Caja 1» y «Caja 2»',
  );
  exigir(
    estado.almacenes.some((almacen) => almacen.principal === true),
    'no hay almacén principal',
  );
  exigir(
    estado.aparatos.viejos === 0,
    `${String(estado.aparatos.viejos)} aparato(s) se llaman «Caja N»`,
  );
  exigir(
    estado.silenciarAvisosDelAdministrador,
    '«Silenciar notificaciones del administrador» está apagado',
  );
  if (conPrimerFolio) {
    exigir(
      estado.foliosConfigurados?.primerFolioDeCuentas === ARRANQUE.primerFolioDeCuentas &&
        estado.foliosConfigurados?.primerFolioDeCortes === ARRANQUE.primerFolioDeCortes,
      'el primer folio no es 1001 (cuentas) y 101 (cortes)',
    );
    // Sin fila de folio todavía, el primer uso la crea en el «Primer folio»: también vale.
    const siguiente = (serie, primero) =>
      estado.folios[serie] === undefined || estado.folios[serie] === String(primero);
    exigir(
      siguiente('A', ARRANQUE.primerFolioDeCuentas),
      `el siguiente folio de cuentas es ${String(estado.folios['A'])}`,
    );
    exigir(
      siguiente('CC', ARRANQUE.primerFolioDeCortes),
      `el siguiente folio de cortes es ${String(estado.folios['CC'])}`,
    );
  }
  if (conBloqueo)
    exigir(estado.operacionDesde !== null, 'el bloqueo del arranque (H1) no está activo');
  return faltas;
}

/** El siguiente folio de cuentas, como se va a leer en el papel. */
export function siguienteFolioVisible(estado) {
  const numero = estado.folios['A'] ?? String(estado.foliosConfigurados?.primerFolioDeCuentas ?? 1);
  const prefijo = estado.foliosConfigurados?.prefijo;
  return prefijo ? `${prefijo}-${numero.padStart(5, '0')}` : numero;
}
