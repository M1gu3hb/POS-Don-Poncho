#!/usr/bin/env node
/**
 * ACOMODAR LAS MESAS ENCIMADAS (DP-11.0), por el comando de la aplicación.
 *
 *   node --conditions=react-server scripts/acomodar-mesas.mjs --org don-poncho \
 *     --persona "Miguel · Morphiq" [--datos docs/cliente/negocio-don-poncho.json] [--ensayo]
 *
 * Las mesas que nacieron sin posición se pintan todas en el mismo punto del mapa, y en la tableta
 * y la PC sólo se puede tocar la de arriba. Éstas van a la cuadrícula de `sala.plano` del archivo
 * de datos, por número; las que el dueño ya acomodó no se tocan (`lib/plano-de-mesas.mjs`).
 * Cada cambio es un `puente.escribir` de `Mesa` con su auditoría, firmado por el dueño de
 * `--persona`, como `preparar-negocio.mjs`. Correrlo otra vez no hace nada. `--ensayo` no escribe.
 */
import { readFileSync } from 'node:fs';

import { argumento, cargarEntorno } from './lib/guion.mjs';
import { planoDeLasMesas } from './lib/plano-de-mesas.mjs';

cargarEntorno();
const slug = argumento('org');
const persona = argumento('persona');
const rutaDeDatos = argumento('datos', 'docs/cliente/negocio-don-poncho.json');
const ensayo = process.argv.includes('--ensayo');
if (slug === null || persona === null) {
  console.error('Uso: acomodar-mesas.mjs --org <slug> --persona "<dueño>" [--ensayo]');
  process.exit(2);
}

const datos = JSON.parse(readFileSync(rutaDeDatos, 'utf8'));
const { NEGOCIOS_REALES, NEGOCIOS_DE_PRUEBA, negocioAjeno } =
  await import('../packages/contracts/src/negocios/index.ts');
const { obtenerDb, cerrarDb } = await import('../packages/data/src/cliente.ts');
const { comando } = await import('../packages/app/src/produccion.ts');
const { escribirDatos } = await import('../packages/app/src/puente/comandos.ts');

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

  const mesas = await db
    .selectFrom('mesas')
    .innerJoin('zonas', 'zonas.id', 'mesas.zona_id')
    .select(['mesas.id', 'mesas.numero', 'mesas.posicion_x', 'mesas.posicion_y'])
    .where('mesas.organizacion_id', '=', org.id)
    .where('zonas.nombre', '=', datos.sala.zona)
    .where('mesas.activa', '=', true)
    .orderBy('mesas.numero')
    .execute();
  const plan = planoDeLasMesas(
    mesas.map((m) => ({ ...m, numero: Number(m.numero) })),
    datos.sala.plano,
  );

  const ambito = {
    organizacionId: org.id,
    sucursalId: sucursal.id,
    terminalId: null,
    identidadId: actor.identidadId,
    empleoId: actor.empleoId,
    rol: 'dueno',
  };
  for (const { id, numero, x, y } of plan) {
    console.log(`  mesa ${String(numero)} → (${String(x)}, ${String(y)})`);
    if (ensayo) continue;
    const r = await comando(escribirDatos, {
      ambito,
      entrada: {
        entidad: 'Mesa',
        operacion: 'update',
        id,
        datos: { posicion_x: x, posicion_y: y },
      },
      idempotencyKey: `acomodar-mesas:${slug}:${id}:${String(x)},${String(y)}`,
    });
    if (!r.ok) throw new Error(`mesa ${String(numero)}: ${r.error.codigo} · ${r.error.mensaje}`);
  }
  console.log(
    `${ensayo ? '◦ Ensayo' : '✓ Hecho'} «${slug}»: ${String(plan.length)} de ${String(mesas.length)} mesas ${
      plan.length === 0 ? 'por acomodar: ya estaban acomodadas' : 'a la cuadrícula'
    }.`,
  );
} finally {
  await cerrarDb();
}
