#!/usr/bin/env node
/**
 * MARCAR AL USUARIO DE PLATAFORMA (DP-12.1), por el comando de la aplicación.
 *
 *   node --conditions=react-server scripts/marcar-plataforma.mjs --org don-poncho \
 *     --persona "Miguel · Morphiq" [--ensayo]
 *
 * El empleo de dueño de `--persona` queda en `configuracion.valores.plataforma`: sólo él ve y
 * ejecuta los botones de mantenimiento que borran en masa (`packages/app/src/mantenimiento/
 * plataforma.ts`). Es `mantenimiento.marcar_plataforma`, que marca a QUIEN LO EJECUTA y no tiene
 * ruta HTTP: este guion, con acceso a la base, es el único camino. Correrlo otra vez no cambia
 * nada. `--ensayo` no escribe.
 */
import { argumento, cargarEntorno } from './lib/guion.mjs';

cargarEntorno();
const slug = argumento('org');
const persona = argumento('persona');
const ensayo = process.argv.includes('--ensayo');
if (slug === null || persona === null) {
  console.error('Uso: marcar-plataforma.mjs --org <slug> --persona "<dueño>" [--ensayo]');
  process.exit(2);
}

const { NEGOCIOS_REALES, NEGOCIOS_DE_PRUEBA, negocioAjeno } =
  await import('../packages/contracts/src/negocios/index.ts');
const { obtenerDb, cerrarDb } = await import('../packages/data/src/cliente.ts');
const { comando } = await import('../packages/app/src/produccion.ts');
const { empleosDePlataforma, marcarPlataforma } =
  await import('../packages/app/src/mantenimiento/index.ts');

const permitido = [...NEGOCIOS_REALES, ...NEGOCIOS_DE_PRUEBA].find((n) => n.slug === slug);
if (negocioAjeno(slug) !== null || permitido === undefined) {
  console.error(`✗ «${slug}» no es Don Poncho ni un restaurante de prueba: no se toca.`);
  process.exit(1);
}

const db = obtenerDb();
try {
  const org = await db
    .selectFrom('organizaciones')
    .select('id')
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
  const antes = empleosDePlataforma(config?.valores ?? null);
  console.log(
    `«${slug}»: ${String(antes.length)} empleo(s) de plataforma; «${persona}» ${antes.includes(actor.empleoId) ? 'ya lo es' : 'no lo es'}.`,
  );
  if (ensayo) {
    console.log('◦ Ensayo: no se escribe nada.');
    process.exit(0);
  }

  const r = await comando(marcarPlataforma, {
    ambito: {
      organizacionId: org.id,
      sucursalId: sucursal.id,
      terminalId: null,
      identidadId: actor.identidadId,
      empleoId: actor.empleoId,
      rol: 'dueno',
    },
    entrada: {},
    idempotencyKey: `marcar-plataforma:${org.id}:${actor.empleoId}`,
  });
  if (!r.ok) throw new Error(`${r.error.codigo} · ${r.error.mensaje}`);
  console.log(
    `✓ «${persona}» es el usuario de plataforma de «${slug}»${r.datos.yaLoEra ? ' (ya lo era)' : ''}.`,
  );
} finally {
  await cerrarDb();
}
