#!/usr/bin/env node
/**
 * MARCAR, QUITAR O PASAR AL USUARIO DE PLATAFORMA (DP-12.1, DP-13.3b), por los comandos de la
 * aplicación.
 *
 *   node --conditions=react-server scripts/marcar-plataforma.mjs --org don-poncho \
 *     --persona "Miguel · Morphiq" [--quitar | --reemplazar-por "Otra persona"] [--ensayo]
 *
 * Sin opción de cambio, el empleo de dueño de `--persona` queda en
 * `configuracion.valores.plataforma`: sólo él ve y ejecuta los botones de mantenimiento que borran
 * en masa (`packages/app/src/mantenimiento/plataforma.ts`). Es `mantenimiento.marcar_plataforma`,
 * que marca a QUIEN LO EJECUTA y no tiene ruta HTTP: este guion, con acceso a la base, es el único
 * camino.
 *
 *   · `--quitar` le quita la marca a `--persona`.
 *   · `--reemplazar-por "<otra persona>"` se la quita a `--persona` y se la pasa a otro dueño
 *     activo del mismo negocio, en la misma transacción.
 *
 * Las dos son `mantenimiento.quitar_plataforma`, que sólo ejecuta quien YA es de plataforma: el
 * guion la corre con el empleo de `--persona`, así que si no tiene la marca (o está desactivada,
 * que la pierde sola) el comando contesta «sólo el usuario de plataforma» y no cambia nada.
 *
 * Correrlo otra vez no cambia nada. La clave de idempotencia lleva el estado de partida (la lista
 * resultante y la versión del documento): marcar, quitar y volver a marcar ejecuta las tres veces
 * en vez de devolver la respuesta guardada de la primera. `--ensayo` no escribe.
 */
import { argumento, cargarEntorno } from './lib/guion.mjs';

cargarEntorno();
const slug = argumento('org');
const persona = argumento('persona');
const reemplazarPor = argumento('reemplazar-por');
const quitar = process.argv.includes('--quitar');
const ensayo = process.argv.includes('--ensayo');
if (slug === null || persona === null || (quitar && reemplazarPor !== null)) {
  console.error(
    'Uso: marcar-plataforma.mjs --org <slug> --persona "<dueño>" ' +
      '[--quitar | --reemplazar-por "<otro dueño>"] [--ensayo]',
  );
  process.exit(2);
}

const { NEGOCIOS_REALES, NEGOCIOS_DE_PRUEBA, negocioAjeno } =
  await import('../packages/contracts/src/negocios/index.ts');
const { obtenerDb, cerrarDb } = await import('../packages/data/src/cliente.ts');
const { comando } = await import('../packages/app/src/produccion.ts');
const { claveDePlataforma, empleosDePlataforma, marcarPlataforma, quitarPlataforma } =
  await import('../packages/app/src/mantenimiento/index.ts');

const permitido = [...NEGOCIOS_REALES, ...NEGOCIOS_DE_PRUEBA].find((n) => n.slug === slug);
if (negocioAjeno(slug) !== null || permitido === undefined) {
  console.error(`✗ «${slug}» no es Don Poncho ni un restaurante de prueba: no se toca.`);
  process.exit(1);
}

const db = obtenerDb();

/** El empleo de dueño activo de una persona del negocio, con la identidad con la que entra. */
function dueno(organizacionId, nombre) {
  return db
    .selectFrom('empleos')
    .innerJoin('personas', 'personas.id', 'empleos.persona_id')
    .innerJoin('identidades', 'identidades.persona_id', 'personas.id')
    .select(['empleos.id as empleoId', 'identidades.id as identidadId'])
    .where('empleos.organizacion_id', '=', organizacionId)
    .where('empleos.rol', '=', 'dueno')
    .where('empleos.activo', '=', true)
    .where('personas.nombre', '=', nombre)
    .executeTakeFirst();
}

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
  const actor = org && (await dueno(org.id, persona));
  const otro = org && reemplazarPor !== null ? await dueno(org.id, reemplazarPor) : null;
  if (!org || !sucursal || !actor) {
    console.error(`✗ «${slug}» sin alta, sin sucursal o sin «${persona}» como dueño activo.`);
    process.exit(1);
  }
  if (reemplazarPor !== null && !otro) {
    console.error(`✗ «${reemplazarPor}» no es un dueño activo de «${slug}»: no se pasa la marca.`);
    process.exit(1);
  }

  const config = await db
    .selectFrom('configuracion')
    .select(['valores', 'version'])
    .where('organizacion_id', '=', org.id)
    .executeTakeFirst();
  const antes = empleosDePlataforma(config?.valores ?? null);
  const version = config?.version ?? 0;
  console.log(
    `«${slug}»: ${String(antes.length)} empleo(s) de plataforma; «${persona}» ${antes.includes(actor.empleoId) ? 'ya lo es' : 'no lo es'}.`,
  );
  if (ensayo) {
    console.log('◦ Ensayo: no se escribe nada.');
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
  const cambia = quitar || otro;
  const plan = {
    accion: cambia ? 'quitar' : 'marcar',
    organizacionId: org.id,
    empleoId: actor.empleoId,
    ...(otro ? { reemplazarPor: otro.empleoId } : {}),
    antes,
    version,
  };
  const r = await comando(cambia ? quitarPlataforma : marcarPlataforma, {
    ambito,
    entrada: cambia
      ? { empleado: actor.empleoId, ...(otro ? { reemplazarPor: otro.empleoId } : {}) }
      : {},
    idempotencyKey: claveDePlataforma(plan),
  });
  if (!r.ok) throw new Error(`${r.error.codigo} · ${r.error.mensaje}`);
  if (!cambia) {
    console.log(
      `✓ «${persona}» es el usuario de plataforma de «${slug}»${r.datos.yaLoEra ? ' (ya lo era)' : ''}.`,
    );
  } else {
    console.log(
      `✓ «${persona}» ya no es de plataforma en «${slug}»${r.datos.quitada ? '' : ' (no lo era)'}` +
        `${otro ? `; la marca pasó a «${reemplazarPor}»` : ''}. Quedan ${String(r.datos.empleos)}.`,
    );
  }
} finally {
  await cerrarDb();
}
