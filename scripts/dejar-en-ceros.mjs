#!/usr/bin/env node
/**
 * DEJAR PRODUCCIÓN EN CEROS (DP-18 · 1.6), por los comandos de la aplicación.
 *
 *   node --conditions=react-server scripts/dejar-en-ceros.mjs --org don-poncho \
 *     --persona "Miguel · Morphiq" --desde 2026-11-11 --ventas 1 [--ensayo]
 *
 * Antes de que Don Poncho opere, lo vendido es de prueba (Miguel probó el sistema el 11-11 y seguirá
 * probando). Esto:
 *   1. comprueba que TODO lo que encuentra es de prueba: ninguna cuenta, caja, corte, pago ni
 *      movimiento de caja anterior al día `--desde` (CDMX), y no más cuentas cobradas que `--ventas`;
 *      si algo no cuadra, se niega y no escribe nada;
 *   2. purga las ventas (`mantenimiento.purgar_ventas`, revirtiendo el inventario que movieron):
 *      cuentas, renglones, pagos, comandas, carritos del portal, movimientos de caja y de cuenta;
 *   3. borra las cajas y sus cortes (`mantenimiento.purgar_seccion` «cortes»): la caja de prueba que
 *      quedó abierta se va con ellas;
 *   4. reinicia los folios (`mantenimiento.reiniciar_folios`): las cuentas y los cortes vuelven a su
 *      «Primer folio» de Configuración (1001 y 101 en Don Poncho; 1 si nadie lo cambió) y el guion
 *      comprueba y dice cuál es el siguiente. Se niega si hay movimientos en otra serie (remisiones,
 *      fiado, liquidaciones). El número para llevar sale de las cuentas del día, así que vuelve a
 *      empezar en 1 solo;
 *   5. deja la auditoría como está (y le suma estos pasos, firmados por el dueño de `--persona`).
 * Las compras, los gastos, el catálogo, las personas, las mesas y la configuración no se tocan.
 * Si el negocio ya opera de verdad (`operacion_desde`, DP-21 · H1: una sola cuenta creada después de
 * esa fecha), el guion se niega desde la comprobación previa, también con `--ensayo`: lo cobrado ya
 * no se borra.
 * `--ensayo` sólo dice lo que encontró y lo que haría.
 *
 * En producción se corre SÓLO cuando Miguel lo pide en el chat, primero con `--ensayo`, y por la
 * conexión de sesión (5432), nunca por el pooler de transacción (DP-D92).
 */
import { argumento, cargarEntorno } from './lib/guion.mjs';
import { exigirConexionDirecta } from './lib/lectura-segura.mjs';

cargarEntorno();
const slug = argumento('org');
const persona = argumento('persona');
const desde = argumento('desde');
const ventas = argumento('ventas');
const ensayo = process.argv.includes('--ensayo');
if (slug === null || persona === null || desde === null || ventas === null) {
  console.error(
    'Uso: dejar-en-ceros.mjs --org <slug> --persona "<dueño>" --desde AAAA-MM-DD --ventas <n> [--ensayo]',
  );
  process.exit(2);
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d+$/.test(ventas)) {
  console.error('✗ --desde va como AAAA-MM-DD y --ventas es un número entero.');
  process.exit(2);
}
// Nunca por el pooler de transacción: lo que un guion deje pegado lo hereda la app (DP-D92).
exigirConexionDirecta(process.env['DATABASE_URL']);

const { NEGOCIOS_REALES, NEGOCIOS_DE_PRUEBA, negocioAjeno } =
  await import('../packages/contracts/src/negocios/index.ts');
const { obtenerDb, cerrarDb } = await import('../packages/data/src/cliente.ts');
const { comando } = await import('../packages/app/src/produccion.ts');
const { purgarVentas, purgarSeccionDelHistorico } =
  await import('../packages/app/src/mantenimiento/index.ts');
const { reiniciarFolios, loQueHayParaDejarEnCeros, motivosParaNoDejarEnCeros } =
  await import('../packages/app/src/mantenimiento/en-ceros.ts');
const { exigirQueNoHayaOperacionReal } =
  await import('../packages/app/src/mantenimiento/operacion-real.ts');
const { foliosEn } = await import('../packages/app/src/configuracion/folios-del-negocio.ts');

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

  // 0 · El negocio que ya opera no se deja en ceros (H1). También en el ensayo.
  try {
    await exigirQueNoHayaOperacionReal(db, org.id, new Date());
  } catch (error) {
    console.error(
      `✗ ${error instanceof Error ? error.message : String(error)} No se escribe nada.`,
    );
    process.exit(1);
  }
  console.log('◦ El negocio todavía no opera de verdad (sin cuentas posteriores al arranque).');

  // 1 · Sólo datos de prueba.
  const hay = await loQueHayParaDejarEnCeros(db, org.id, desde);
  console.log(`«${org.nombre}» desde el ${desde} (CDMX):`);
  for (const [que, n] of Object.entries(hay.conteos)) console.log(`  ${que}: ${String(n)}`);
  const motivos = motivosParaNoDejarEnCeros(hay, Number(ventas));
  if (motivos.length > 0) {
    console.error(`✗ No es sólo lo de prueba (${motivos.join('; ')}): no se escribe nada.`);
    process.exit(1);
  }
  if (ensayo) {
    console.log(
      `◦ Ensayo: purgaría ${String(hay.conteos.cuentas)} cuentas (revirtiendo inventario), ` +
        `borraría ${String(hay.conteos.cajas)} cajas con sus cortes y reiniciaría los folios a su «Primer folio». La auditoría se queda.`,
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
  const confirmacionNombreNegocio = org.nombre;
  const marca = `${org.id}:${desde}:${ventas}`;

  // 2 · Las ventas de prueba, con el inventario que movieron de vuelta.
  const v = await comando(purgarVentas, {
    ambito,
    entrada: { confirmacionNombreNegocio, revertirInventario: true },
    idempotencyKey: `dejar-en-ceros:ventas:${marca}`,
  });
  if (!v.ok) throw new Error(`purgar ventas: ${v.error.codigo} · ${v.error.mensaje}`);
  console.log(`✓ Ventas purgadas: ${JSON.stringify(v.datos.borrado)}`);

  // 3 · Las cajas y sus cortes (la que quedó abierta, también).
  const c = await comando(purgarSeccionDelHistorico, {
    ambito,
    entrada: { confirmacionNombreNegocio, seccion: 'cortes' },
    idempotencyKey: `dejar-en-ceros:cortes:${marca}`,
  });
  if (!c.ok) throw new Error(`purgar cajas: ${c.error.codigo} · ${c.error.mensaje}`);
  console.log(`✓ Cajas y cortes borrados: ${JSON.stringify(c.datos.borrado)}`);

  // 4 · Los folios, desde el 1.
  const f = await comando(reiniciarFolios, {
    ambito,
    entrada: { confirmacionNombreNegocio },
    idempotencyKey: `dejar-en-ceros:folios:${marca}`,
  });
  if (!f.ok) throw new Error(`reiniciar folios: ${f.error.codigo} · ${f.error.mensaje}`);
  console.log(`✓ Folios reiniciados: ${JSON.stringify(f.datos.borrado)}`);
  const configuracion = await db
    .selectFrom('configuracion')
    .select('valores')
    .where('organizacion_id', '=', org.id)
    .executeTakeFirst();
  const primeros = foliosEn(configuracion?.valores);
  const siguientes = await db
    .selectFrom('folios')
    .select(['serie', 'siguiente'])
    .where('organizacion_id', '=', org.id)
    .where('serie', 'in', ['A', 'CC'])
    .execute();
  const falta = [
    ['A', 'cuentas', primeros.primerFolioDeCuentas],
    ['CC', 'cortes', primeros.primerFolioDeCortes],
  ].filter(([serie, , primero]) =>
    siguientes.some((fila) => fila.serie === serie && fila.siguiente !== BigInt(primero)),
  );
  if (falta.length > 0) {
    console.error(`✗ El siguiente folio no quedó en el «Primer folio»: ${JSON.stringify(falta)}`);
    process.exit(1);
  }
  console.log(
    `✓ El siguiente folio de las cuentas es el ${String(primeros.primerFolioDeCuentas)} y el de los cortes el ${String(primeros.primerFolioDeCortes)}.`,
  );

  const despues = await loQueHayParaDejarEnCeros(db, org.id, desde);
  console.log(`✓ Hecho «${slug}»: ${JSON.stringify(despues.conteos)}`);
  if (Object.values(despues.conteos).some((n) => n !== 0)) process.exit(1);
} finally {
  await cerrarDb();
}
