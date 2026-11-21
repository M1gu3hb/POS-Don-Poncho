#!/usr/bin/env node
/**
 * EL MENÚ DE DON PONCHO COMO LA HOJA DE COMANDA DE PAPEL (DP-24 · Parte 3), por los comandos de la
 * aplicación.
 *
 *   node --conditions=react-server scripts/ordenar-menu-produccion.mjs --org don-poncho \
 *     --persona "Miguel · Morphiq" [--ensayo]
 *
 * Con los MISMOS comandos que usan las pantallas de Configuración y Productos (cada uno con su rol,
 * su transacción y su antes/después en la auditoría), firmados por el dueño de `--persona` y sin
 * teclear ningún PIN, deja:
 *   · las categorías con el nombre de la hoja («Pa’ empezar» → «Para empezar», «Para enfriar» →
 *     «Bebidas», «Ron» → «Ron y Brandy») y con su color de la paleta (`catalogo.guardar_categoria`);
 *   · «Brandy» unida a «Ron y Brandy» (se APAGA, no se borra: `catalogo.unir_categorias`) y los
 *     platillos que la hoja pone en otra categoría, movidos (`catalogo.mover_a_categoria`);
 *   · los 4 «(extra)» de Cerveza apagados, sólo si ninguna cuenta abierta los trae
 *     (`catalogo.archivar_producto`);
 *   · los grupos «Prepárala» (cervezas) y «Preparación» (barbacoa y cabeza preparadas) y su asignación
 *     (`catalogo.guardar_grupo_de_opciones`, `catalogo.asignar_grupos_de_opciones`);
 *   · el orden de las categorías y de los platillos de cada una (`catalogo.ordenar_categorias`,
 *     `catalogo.ordenar_productos`); lo que no viene en la hoja va al final de su categoría, por nombre.
 *
 * REGLAS: busca por NOMBRE exacto y se detiene (sin escribir nada) si algo no casa, diciendo qué falta
 * o sobra; no crea productos; ningún platillo puede cambiar de estación de preparación (se comprueba
 * antes, lo exigen los comandos y se verifica al final). Es IDEMPOTENTE: lee cómo está cada cosa y sólo
 * manda lo que difiere; una segunda corrida no escribe nada. `--ensayo` dice lo que haría (con lo que
 * cada paso dejaría ya hecho) y no escribe. Termina verificando, leyendo: si algo no quedó, sale con error.
 *
 * En producción, por la conexión de sesión (5432), nunca por el pooler de transacción (DP-D92).
 */
import { randomUUID } from 'node:crypto';

import { argumento, cargarEntorno } from './lib/guion.mjs';
import { exigirConexionDirecta } from './lib/lectura-segura.mjs';
import {
  CATEGORIAS_DE_LA_HOJA,
  EXTRAS_DE_CERVEZA,
  GRUPOS_DE_OPCIONES_NUEVOS,
  LA_HOJA_TRAE_Y_NO_EXISTE,
  OPCIONES_QUE_FALTAN_DE_PRECIO,
} from './lib/menu-de-la-hoja.mjs';
import { aplicarEtapa, ETAPAS, planDeEtapa } from './lib/plan-del-menu.mjs';
import { estacionDeCadaProducto, leerElMenu } from './lib/leer-el-menu.mjs';

cargarEntorno();
const slug = argumento('org');
const persona = argumento('persona');
const ensayo = process.argv.includes('--ensayo');
if (slug === null || persona === null) {
  console.error('Uso: ordenar-menu-produccion.mjs --org <slug> --persona "<dueño>" [--ensayo]');
  process.exit(2);
}
exigirConexionDirecta(process.env['DATABASE_URL']);

const { NEGOCIOS_REALES, NEGOCIOS_DE_PRUEBA, negocioAjeno } =
  await import('../packages/contracts/src/negocios/index.ts');
const { obtenerDb, cerrarDb } = await import('../packages/data/src/cliente.ts');
const { comando } = await import('../packages/app/src/produccion.ts');
const permitido = [...NEGOCIOS_REALES, ...NEGOCIOS_DE_PRUEBA].find((n) => n.slug === slug);
if (negocioAjeno(slug) !== null || permitido === undefined) {
  console.error(`✗ «${slug}» no es Don Poncho ni un restaurante de prueba: no se toca.`);
  process.exit(1);
}

/** El ámbito del dueño de `--persona` (como `configurar-produccion.mjs`). */
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

const ayudantes = {
  hoja: CATEGORIAS_DE_LA_HOJA,
  extras: EXTRAS_DE_CERVEZA,
  grupos: GRUPOS_DE_OPCIONES_NUEVOS,
};

function informarLoQueNoCasa(problemas) {
  console.error('✗ El catálogo no casa con la hoja; no se escribe NADA:');
  for (const p of problemas) console.error(`  · ${p}`);
  process.exit(1);
}

/** Dice qué haría cada etapa (y lo que dejaría hecho), sin escribir. */
async function ensayar(db, org) {
  let estado = await leerElMenu(db, org.id);
  for (const etapa of ETAPAS) {
    const { pasos, problemas } = planDeEtapa(etapa, estado, ayudantes);
    if (problemas.length > 0) informarLoQueNoCasa(problemas);
    console.log(
      `${etapa.titulo}: ${pasos.length === 0 ? '✓ ya está' : `◦ mandaría ${String(pasos.length)} comando(s)`}`,
    );
    for (const p of pasos) console.log(`    ◦ ${p.nombre} (${p.definicion.nombre})`);
    estado = aplicarEtapa(estado, pasos);
  }
  console.log('◦ Ensayo: no se escribe nada.');
}

/** Manda los comandos de cada etapa, leyendo de nuevo entre una y otra. */
async function aplicar(db, org, ambito) {
  for (const etapa of ETAPAS) {
    const estado = await leerElMenu(db, org.id);
    const { pasos, problemas } = planDeEtapa(etapa, estado, ayudantes);
    if (problemas.length > 0) informarLoQueNoCasa(problemas);
    for (const p of pasos) {
      const resultado = await comando(p.definicion, {
        ambito,
        entrada: p.entrada,
        // Cada corrida lleva claves propias: lo que decide si hay algo que hacer es el estado leído.
        idempotencyKey: `ordenar-menu:${randomUUID()}`,
      });
      if (!resultado.ok) {
        // Lo anterior ya quedó guardado (cada comando es su transacción); una corrida nueva sigue aquí.
        console.error(`✗ ${p.nombre}: ${resultado.error.codigo} · ${resultado.error.mensaje}`);
        process.exit(1);
      }
      console.log(`✓ ${p.nombre} (${p.definicion.nombre})`);
    }
  }
}

/** La verificación, leyendo: nada pendiente y ningún platillo cambió de estación. */
async function verificar(db, org, estacionesAntes) {
  const estado = await leerElMenu(db, org.id);
  const faltas = [];
  for (const etapa of ETAPAS) {
    const { pasos, problemas } = planDeEtapa(etapa, estado, ayudantes);
    faltas.push(...problemas, ...pasos.map((p) => `No quedó: ${p.nombre}`));
  }
  const despues = estacionDeCadaProducto(estado);
  for (const [id, antes] of estacionesAntes) {
    const ahora = despues.get(id);
    if (ahora !== antes) faltas.push(`El producto ${id} cambió de estación: ${antes} → ${ahora}`);
  }
  if (faltas.length > 0) {
    for (const f of new Set(faltas)) console.error(`✗ ${f}`);
    process.exit(1);
  }
  return estado;
}

function resumen(estado) {
  const activas = estado.categorias.filter((c) => c.activa).length;
  console.log(
    `✓ Menú de «${slug}» como la hoja: ${String(activas)} categorías, en su orden y con su color.`,
  );
  console.log(
    `  La hoja trae y NO existe (no se crearon): ${LA_HOJA_TRAE_Y_NO_EXISTE.join(', ')}.`,
  );
  const enHoja = new Set(CATEGORIAS_DE_LA_HOJA.flatMap((c) => c.productos));
  const sobran = estado.productos.filter((p) => p.activo && !enHoja.has(p.nombre));
  console.log(
    `  Activos que NO vienen en la hoja (al final de su categoría): ${sobran.length === 0 ? 'ninguno' : sobran.map((p) => p.nombre).join(', ')}.`,
  );
  console.log(
    `  Sin cargar por falta de precio: ${OPCIONES_QUE_FALTAN_DE_PRECIO.map((o) => o.producto).join(', ')} («${OPCIONES_QUE_FALTAN_DE_PRECIO[0].texto}»).`,
  );
}

const db = obtenerDb();
try {
  const { org, ambito } = await ambitoDelDueno(db);
  console.log(`«${org.nombre}»:`);
  if (ensayo) {
    await ensayar(db, org);
  } else {
    const inicial = await leerElMenu(db, org.id);
    const estacionesAntes = estacionDeCadaProducto(inicial);
    await aplicar(db, org, ambito);
    resumen(await verificar(db, org, estacionesAntes));
  }
} finally {
  await cerrarDb();
}
