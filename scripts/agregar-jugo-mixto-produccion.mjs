#!/usr/bin/env node
/**
 * AGREGA «MIXTO» (+$0) AL «SABOR DEL JUGO» (DP-25 · Parte 8.2), por los comandos de la aplicación.
 *
 *   node --conditions=react-server scripts/agregar-jugo-mixto-produccion.mjs --negocio don-poncho \
 *     --persona "Dueño" [--ensayo]
 *
 * Con el MISMO comando que usa la pantalla de Productos → Opciones (`catalogo.guardar_grupo_de_opciones`,
 * con su rol, su transacción y su antes/después en la auditoría), firmado por el dueño de `--persona` y
 * sin teclear ningún PIN, agrega la opción «Mixto» sin costo al grupo «Sabor del jugo» del producto
 * «Jugo». Las opciones que ya tiene (Naranja, Zanahoria) se mandan con su `id` y su precio: el comando
 * guarda el grupo entero y borraría las que no vinieran.
 *
 * REGLAS: busca por NOMBRE exacto y se detiene (sin escribir nada) si algo no casa. No crea productos ni
 * grupos. Es IDEMPOTENTE: si «Mixto» ya está, lo dice y no hace nada (una segunda corrida no duplica).
 * `--ensayo` dice lo que haría y no escribe. Termina verificando, leyendo: si algo no quedó, sale con error.
 *
 * En producción, por la conexión de sesión (5432), nunca por el pooler de transacción (DP-D92).
 */
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { argumento, cargarEntorno } from './lib/guion.mjs';
import { OPCION, planDelJugoMixto } from './lib/jugo-mixto.mjs';
import { exigirConexionDirecta } from './lib/lectura-segura.mjs';

// Los comandos de la aplicación sólo cargan con la condición `react-server`: si falta, el guion se
// vuelve a lanzar con ella, para que la orden sea la corta (`node scripts/agregar-jugo-mixto-produccion.mjs …`).
if (!process.execArgv.includes('--conditions=react-server')) {
  const otra = spawnSync(
    process.execPath,
    ['--conditions=react-server', ...process.argv.slice(1)],
    { stdio: 'inherit' },
  );
  process.exit(otra.status ?? 1);
}

cargarEntorno();
const slug = argumento('negocio') ?? argumento('org');
const persona = argumento('persona');
const ensayo = process.argv.includes('--ensayo');
if (slug === null || persona === null) {
  console.error(
    'Uso: agregar-jugo-mixto-produccion.mjs --negocio <slug> --persona "<dueño>" [--ensayo]',
  );
  process.exit(2);
}
exigirConexionDirecta(process.env['DATABASE_URL']);

const { NEGOCIOS_REALES, NEGOCIOS_DE_PRUEBA, negocioAjeno } =
  await import('../packages/contracts/src/negocios/index.ts');
const { obtenerDb, cerrarDb } = await import('../packages/data/src/cliente.ts');
const { comando } = await import('../packages/app/src/produccion.ts');
const { guardarGrupoDeOpciones } = await import('../packages/app/src/catalogo/index.ts');
const permitido = [...NEGOCIOS_REALES, ...NEGOCIOS_DE_PRUEBA].find((n) => n.slug === slug);
if (negocioAjeno(slug) !== null || permitido === undefined) {
  console.error(`✗ «${slug}» no es Don Poncho ni un restaurante de prueba: no se toca.`);
  process.exit(1);
}

/** El ámbito del dueño de `--persona` (como `ordenar-menu-produccion.mjs`). */
async function ambitoDelDueno(db) {
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
  return {
    org,
    ambito: {
      organizacionId: org.id,
      sucursalId: sucursal.id,
      terminalId: null,
      identidadId: actor.identidadId,
      empleoId: actor.empleoId,
      rol: 'dueno',
    },
  };
}

/** Lo único que el plan necesita del negocio: el producto «Jugo», sus grupos y las opciones. */
async function leerElJugo(db, organizacionId) {
  const productos = await db
    .selectFrom('productos')
    .select(['id', 'nombre', 'activo'])
    .where('organizacion_id', '=', organizacionId)
    .where('nombre', '=', 'Jugo')
    .execute();
  const asignaciones = await db
    .selectFrom('producto_modificadores')
    .select(['producto_id', 'modificador_id'])
    .where('organizacion_id', '=', organizacionId)
    .execute();
  const grupos = await db
    .selectFrom('modificadores')
    .select([
      'id',
      'nombre',
      'tipo',
      'obligatorio',
      'activo',
      'minimo_elecciones',
      'maximo_elecciones',
    ])
    .where('organizacion_id', '=', organizacionId)
    .execute();
  const opciones = await db
    .selectFrom('modificador_opciones as o')
    .innerJoin('modificadores as m', 'm.id', 'o.modificador_id')
    .select([
      'o.id',
      'o.modificador_id',
      'o.nombre',
      'o.orden',
      'o.activa',
      'o.delta_precio_centavos',
    ])
    .where('m.organizacion_id', '=', organizacionId)
    .execute();
  return { productos, grupos, asignaciones, opciones };
}

/** Después de escribir: «Mixto» una sola vez, a $0, y lo que ya había, igual que antes. */
function verificar(antes, despues) {
  const grupoId = planDelJugoMixto(antes).entrada?.grupoId;
  const deGrupo = (estado) => estado.opciones.filter((o) => o.modificador_id === grupoId);
  const faltas = [];
  const mixtos = deGrupo(despues).filter((o) => o.nombre === OPCION);
  if (mixtos.length !== 1) faltas.push(`«${OPCION}» quedó ${String(mixtos.length)} veces.`);
  else if (!mixtos[0].activa || BigInt(mixtos[0].delta_precio_centavos) !== 0n) {
    faltas.push(`«${OPCION}» no quedó activa y a $0.`);
  }
  for (const vieja of deGrupo(antes)) {
    const igual = deGrupo(despues).find((o) => o.id === vieja.id);
    const cambio =
      igual === undefined ||
      igual.nombre !== vieja.nombre ||
      igual.activa !== vieja.activa ||
      BigInt(igual.delta_precio_centavos) !== BigInt(vieja.delta_precio_centavos);
    if (cambio) faltas.push(`La opción «${vieja.nombre}» cambió o desapareció.`);
  }
  return faltas;
}

const db = obtenerDb();
try {
  const { org, ambito } = await ambitoDelDueno(db);
  console.log(`«${org.nombre}»:`);
  const antes = await leerElJugo(db, org.id);
  const plan = planDelJugoMixto(antes);
  if (plan.accion === 'problema') {
    console.error(`✗ ${plan.mensaje} No se escribe NADA.`);
    process.exit(1);
  }
  if (plan.accion === 'nada') {
    console.log(`✓ ${plan.mensaje}`);
  } else if (ensayo) {
    console.log(`◦ ${plan.mensaje}`);
    console.log('◦ Ensayo: no se escribe nada.');
  } else {
    const resultado = await comando(guardarGrupoDeOpciones, {
      ambito,
      entrada: plan.entrada,
      // Cada corrida lleva su clave: lo que decide si hay algo que hacer es el estado leído.
      idempotencyKey: `jugo-mixto:${randomUUID()}`,
    });
    if (!resultado.ok) {
      console.error(
        `✗ catalogo.guardar_grupo_de_opciones: ${resultado.error.codigo} · ${resultado.error.mensaje}`,
      );
      process.exit(1);
    }
    const faltas = verificar(antes, await leerElJugo(db, org.id));
    if (faltas.length > 0) {
      for (const f of faltas) console.error(`✗ ${f}`);
      process.exit(1);
    }
    console.log(
      `✓ «${OPCION}» (+$0) agregada a «Sabor del jugo»; las demás opciones quedaron igual.`,
    );
  }
} finally {
  await cerrarDb();
}
