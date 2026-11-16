#!/usr/bin/env node
/**
 * ACTIVAR (O QUITAR) EL BLOQUEO DESPUÉS DEL ARRANQUE (DP-21 · Bloque 6 · H1), por los comandos de
 * la aplicación.
 *
 *   node --conditions=react-server scripts/operacion-real.mjs --org don-poncho \
 *     --persona "Miguel · Morphiq" [--quitar] [--ensayo]
 *
 * Sin opción de cambio es `mantenimiento.activar_operacion`: guarda la hora del SERVIDOR como
 * `operacion_desde` (la Parte final, después de dejar en ceros). Desde entonces, una sola cuenta
 * creada después de esa hora hace que dejar en ceros, reiniciar folios, purgar ventas o cortes y
 * cambiar el «Primer folio» se nieguen: lo cobrado ya no se borra. Activarla otra vez no la mueve.
 *
 * `--quitar` es `mantenimiento.quitar_bloqueo_de_operacion`: lo ejecuta el dueño con el nombre del
 * negocio como confirmación, y la auditoría guarda la fecha que tenía. Sólo para cuando Miguel lo
 * pide en el chat.
 *
 * Ninguno de los dos comandos tiene ruta HTTP: este guion, con acceso a la base, es el camino. En
 * producción, por la conexión de sesión (5432), nunca por el pooler de transacción (DP-D92).
 * `--ensayo` sólo dice lo que hay.
 */
import { argumento, cargarEntorno } from './lib/guion.mjs';
import { exigirConexionDirecta } from './lib/lectura-segura.mjs';

cargarEntorno();
const slug = argumento('org');
const persona = argumento('persona');
const quitar = process.argv.includes('--quitar');
const ensayo = process.argv.includes('--ensayo');
if (slug === null || persona === null) {
  console.error('Uso: operacion-real.mjs --org <slug> --persona "<dueño>" [--quitar] [--ensayo]');
  process.exit(2);
}
exigirConexionDirecta(process.env['DATABASE_URL']);

const { NEGOCIOS_REALES, NEGOCIOS_DE_PRUEBA, negocioAjeno } =
  await import('../packages/contracts/src/negocios/index.ts');
const { obtenerDb, cerrarDb } = await import('../packages/data/src/cliente.ts');
const { comando } = await import('../packages/app/src/produccion.ts');
const { activarOperacion, quitarBloqueoDeOperacion } =
  await import('../packages/app/src/mantenimiento/index.ts');
const { operacionDesdeEn } =
  await import('../packages/app/src/configuracion/folios-del-negocio.ts');

const permitido = [...NEGOCIOS_REALES, ...NEGOCIOS_DE_PRUEBA].find((n) => n.slug === slug);
if (negocioAjeno(slug) !== null || permitido === undefined) {
  console.error(`✗ «${slug}» no es Don Poncho ni un restaurante de prueba: no se toca.`);
  process.exit(1);
}

const db = obtenerDb();
try {
  const org = await db
    .selectFrom('organizaciones')
    .select(['id', 'nombre'])
    .where('id', '=', permitido.id)
    .where('slug', '=', slug)
    .executeTakeFirst();
  const sucursal =
    org &&
    (await db
      .selectFrom('sucursales')
      .select('id')
      .where('organizacion_id', '=', org.id)
      .orderBy('created_at', 'asc')
      .executeTakeFirst());
  const actor =
    org &&
    (await db
      .selectFrom('empleos')
      .innerJoin('personas', 'personas.id', 'empleos.persona_id')
      .innerJoin('identidades', 'identidades.persona_id', 'personas.id')
      .select(['empleos.id as empleoId', 'identidades.id as identidadId'])
      .where('empleos.organizacion_id', '=', org.id)
      .where('empleos.rol', '=', 'dueno')
      .where('empleos.activo', '=', true)
      .where('personas.nombre', '=', persona)
      .executeTakeFirst());
  if (!org || !sucursal || !actor) {
    console.error(`✗ «${slug}» sin alta, sin sucursal o sin «${persona}» como dueño activo.`);
    process.exit(1);
  }

  const config = await db
    .selectFrom('configuracion')
    .select('valores')
    .where('organizacion_id', '=', org.id)
    .executeTakeFirst();
  const hoy = operacionDesdeEn(config?.valores ?? null);
  console.log(
    `«${org.nombre}»: ${hoy === null ? 'todavía no opera de verdad (sin bloqueo)' : `opera desde ${hoy.toISOString()}`}.`,
  );
  if (ensayo) {
    console.log(
      `◦ Ensayo: ${quitar ? 'quitaría el bloqueo' : 'activaría la operación'}. No se escribe nada.`,
    );
    process.exit(0);
  }

  const ambito = {
    organizacionId: org.id,
    sucursalId: sucursal.id,
    terminalId: null,
    identidadId: actor.identidadId,
    empleoId: actor.empleoId,
    rol: 'dueno',
  };
  const llave = `operacion-real:${quitar ? 'quitar' : 'activar'}:${org.id}:${hoy === null ? 'sin' : hoy.toISOString()}`;
  if (quitar) {
    const r = await comando(quitarBloqueoDeOperacion, {
      ambito,
      entrada: { confirmacionNombreNegocio: org.nombre },
      idempotencyKey: llave,
    });
    if (!r.ok) throw new Error(`quitar el bloqueo: ${r.error.codigo} · ${r.error.mensaje}`);
    console.log(`✓ Bloqueo quitado (tenía: ${r.datos.teniaDesde ?? 'ninguno'}).`);
  } else {
    const r = await comando(activarOperacion, { ambito, entrada: {}, idempotencyKey: llave });
    if (!r.ok) throw new Error(`activar la operación: ${r.error.codigo} · ${r.error.mensaje}`);
    console.log(
      r.datos.yaEstaba
        ? `✓ Ya operaba desde ${r.datos.desde ?? '—'}: no se movió.`
        : `✓ Opera desde ${r.datos.desde ?? '—'}: lo cobrado ya no se borra.`,
    );
  }
} finally {
  await cerrarDb();
}
