#!/usr/bin/env node
/**
 * LOS APARATOS «CAJA N» PASAN A «APARATO N» (DP-21 · Bloque 5), por el comando de la aplicación.
 *
 *   node --conditions=react-server scripts/renombrar-aparatos.mjs --org don-poncho \
 *     --persona "Miguel · Morphiq" [--ensayo]
 *
 * Hasta DP-21 cada navegador o aparato que entraba se daba de alta como «Caja N», y ése era el
 * nombre que veía la caja. Desde DP-21 la caja es un lugar de la sucursal con su nombre y un
 * aparato nuevo nace como «Aparato N»; esto pone al día los que ya existían
 * (`mantenimiento.renombrar_aparatos`). Sólo cambia el NOMBRE: ni el aparato, ni su cookie, ni sus
 * sesiones, ni sus cortes. Uno con nombre propio («iMin mostrador») no se toca, y el que ya tenga
 * su «Aparato N» en la sucursal se deja como está.
 *
 * Se corre en la Parte final, después de dejar en ceros. El comando no tiene ruta HTTP: este
 * guion, con acceso a la base, es el camino. En producción, por la conexión de sesión (5432),
 * nunca por el pooler de transacción (DP-D92). `--ensayo` sólo cuenta lo que cambiaría.
 */
import { argumento, cargarEntorno } from './lib/guion.mjs';
import { exigirConexionDirecta } from './lib/lectura-segura.mjs';

cargarEntorno();
const slug = argumento('org');
const persona = argumento('persona');
const ensayo = process.argv.includes('--ensayo');
if (slug === null || persona === null) {
  console.error('Uso: renombrar-aparatos.mjs --org <slug> --persona "<dueño>" [--ensayo]');
  process.exit(2);
}
exigirConexionDirecta(process.env['DATABASE_URL']);

const { NEGOCIOS_REALES, NEGOCIOS_DE_PRUEBA, negocioAjeno } =
  await import('../packages/contracts/src/negocios/index.ts');
const { obtenerDb, cerrarDb } = await import('../packages/data/src/cliente.ts');
const { comando } = await import('../packages/app/src/produccion.ts');
const { renombrarAparatos } = await import('../packages/app/src/mantenimiento/index.ts');

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

  const aparatos = await db
    .selectFrom('terminales')
    .select(['nombre'])
    .where('organizacion_id', '=', org.id)
    .execute();
  const deAntes = aparatos.filter((a) => /^Caja [0-9]+$/.test(a.nombre));
  console.log(
    `«${org.nombre}»: ${String(aparatos.length)} aparato(s); ${String(deAntes.length)} se llaman «Caja N».`,
  );
  if (ensayo) {
    console.log(
      `◦ Ensayo: pasarían a «Aparato N» hasta ${String(deAntes.length)} (el que ya tenga su «Aparato N» se deja). No se escribe nada.`,
    );
    process.exit(0);
  }
  if (deAntes.length === 0) {
    console.log('✓ No hay nada que renombrar.');
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
  const r = await comando(renombrarAparatos, {
    ambito,
    entrada: { confirmacionNombreNegocio: org.nombre },
    idempotencyKey: `renombrar-aparatos:${org.id}:${String(deAntes.length)}`,
  });
  if (!r.ok) throw new Error(`renombrar aparatos: ${r.error.codigo} · ${r.error.mensaje}`);
  console.log(
    `✓ ${String(r.datos.renombrados)} aparato(s) pasaron a «Aparato N»; ${String(r.datos.omitidos)} se quedaron como estaban.`,
  );
} finally {
  await cerrarDb();
}
