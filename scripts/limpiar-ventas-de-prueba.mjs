#!/usr/bin/env node
/**
 * LIMPIAR LAS VENTAS DE PRUEBA (DP-12.1), por los comandos de la aplicación.
 *
 *   node --conditions=react-server scripts/limpiar-ventas-de-prueba.mjs --org don-poncho \
 *     --persona "Miguel · Morphiq" --mesa 1 --motivo "Prueba" [--ensayo]
 *
 * Antes de que el restaurante opere con el sistema, lo único vendido es de prueba. Esto:
 *   1. comprueba que SÓLO hay datos de prueba: 0 pagos, 0 cajas y, como mucho, una cuenta, la de
 *      `--mesa`, sin cobrar (o ya cancelada, si se corre otra vez);
 *   2. cancela esa cuenta con `restaurante.cancelar_orden` y el motivo dado (la mesa queda libre);
 *   3. purga las ventas con `mantenimiento.purgar_ventas`, con el nombre del negocio como
 *      confirmación y SIN revertir inventario (una cuenta que no se cobró no consumió nada).
 * Todo firmado por el dueño de `--persona`, con su auditoría, como `acomodar-mesas.mjs`. Si algo
 * no cuadra, no escribe nada. `--ensayo` sólo dice lo que encontró y lo que haría.
 */
import { argumento, cargarEntorno } from './lib/guion.mjs';

cargarEntorno();
const slug = argumento('org');
const persona = argumento('persona');
const numeroMesa = argumento('mesa');
const motivo = argumento('motivo');
const ensayo = process.argv.includes('--ensayo');
if (slug === null || persona === null || numeroMesa === null || motivo === null) {
  console.error(
    'Uso: limpiar-ventas-de-prueba.mjs --org <slug> --persona "<dueño>" --mesa <n> --motivo "<texto>" [--ensayo]',
  );
  process.exit(2);
}

const { NEGOCIOS_REALES, NEGOCIOS_DE_PRUEBA, negocioAjeno } =
  await import('../packages/contracts/src/negocios/index.ts');
const { obtenerDb, cerrarDb } = await import('../packages/data/src/cliente.ts');
const { comando } = await import('../packages/app/src/produccion.ts');
const { cancelarOrden } = await import('../packages/app/src/restaurante/index.ts');
const { purgarVentas } = await import('../packages/app/src/mantenimiento/index.ts');

const permitido = [...NEGOCIOS_REALES, ...NEGOCIOS_DE_PRUEBA].find((n) => n.slug === slug);
if (negocioAjeno(slug) !== null || permitido === undefined) {
  console.error(`✗ «${slug}» no es Don Poncho ni un restaurante de prueba: no se toca.`);
  process.exit(1);
}

const db = obtenerDb();
/** Cuántas filas tiene la tabla para el negocio. */
async function cuantas(tabla, org) {
  const fila = await db
    .selectFrom(tabla)
    .select((eb) => eb.fn.countAll().as('n'))
    .where('organizacion_id', '=', org)
    .executeTakeFirstOrThrow();
  return Number(fila.n);
}

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

  // 1 · Sólo datos de prueba.
  const pagos = await cuantas('pagos', org.id);
  const cajas = await cuantas('sesiones_caja', org.id);
  const ordenes = await db
    .selectFrom('ordenes')
    .leftJoin('mesas', 'mesas.id', 'ordenes.mesa_id')
    .select([
      'ordenes.id',
      'ordenes.estado',
      'ordenes.total_centavos',
      'ordenes.created_at',
      'mesas.numero',
    ])
    .where('ordenes.organizacion_id', '=', org.id)
    .execute();
  console.log(
    `«${org.nombre}»: ${String(pagos)} pagos, ${String(cajas)} cajas, ${String(ordenes.length)} cuentas.`,
  );
  for (const o of ordenes) {
    console.log(
      `  cuenta ${o.id} · mesa ${String(o.numero)} · ${o.estado} · $${(Number(o.total_centavos) / 100).toFixed(2)} · ${new Date(o.created_at).toISOString()}`,
    );
  }
  const laDePrueba = ordenes.find((o) => String(o.numero) === String(numeroMesa));
  const motivos = [];
  if (pagos !== 0) motivos.push(`hay ${String(pagos)} pagos`);
  if (cajas !== 0) motivos.push(`hay ${String(cajas)} cajas`);
  if (ordenes.length > 1)
    motivos.push(`hay ${String(ordenes.length)} cuentas, no sólo la de prueba`);
  if (ordenes.length === 1 && laDePrueba === undefined) {
    motivos.push(`la única cuenta no es de la mesa ${numeroMesa}`);
  }
  if (laDePrueba !== undefined && laDePrueba.estado === 'pagada')
    motivos.push('la cuenta ya se cobró');
  if (motivos.length > 0) {
    console.error(`✗ No son sólo datos de prueba (${motivos.join('; ')}): no se escribe nada.`);
    process.exit(1);
  }

  if (ensayo) {
    console.log(
      `◦ Ensayo: cancelaría ${laDePrueba ? `la cuenta de la mesa ${numeroMesa} («${motivo}»)` : 'nada (no hay cuenta)'} y purgaría las ventas sin revertir inventario.`,
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

  // 2 · La cuenta de prueba, cancelada: la mesa queda libre.
  if (laDePrueba !== undefined) {
    const r = await comando(cancelarOrden, {
      ambito,
      entrada: { ordenId: laDePrueba.id, motivo },
      idempotencyKey: `limpiar-ventas-de-prueba:cancelar:${laDePrueba.id}`,
    });
    if (!r.ok) throw new Error(`cancelar: ${r.error.codigo} · ${r.error.mensaje}`);
    console.log(
      `✓ Cuenta de la mesa ${numeroMesa} cancelada${r.datos.yaEstabaCancelada ? ' (ya lo estaba)' : ''}; mesa liberada: ${String(r.datos.mesaLiberada)}.`,
    );
  }

  // 3 · Las ventas, purgadas, sin revertir inventario.
  const p = await comando(purgarVentas, {
    ambito,
    entrada: { confirmacionNombreNegocio: org.nombre, revertirInventario: false },
    idempotencyKey: `limpiar-ventas-de-prueba:purgar:${org.id}:${laDePrueba?.id ?? 'sin-cuenta'}`,
  });
  if (!p.ok) throw new Error(`purgar: ${p.error.codigo} · ${p.error.mensaje}`);
  console.log(`✓ Ventas purgadas: ${JSON.stringify(p.datos.borrado)}`);

  const mesa = await db
    .selectFrom('mesas')
    .select(['estado', 'orden_activa_id'])
    .where('organizacion_id', '=', org.id)
    .where('numero', '=', Number(numeroMesa))
    .where('activa', '=', true)
    .executeTakeFirst();
  const quedan = await cuantas('ordenes', org.id);
  console.log(
    `✓ Hecho «${slug}»: ${String(quedan)} cuentas; mesa ${numeroMesa} ${String(mesa?.estado)}${mesa?.orden_activa_id ? ' (¡con cuenta!)' : ''}.`,
  );
  if (quedan !== 0 || mesa?.estado !== 'libre' || mesa.orden_activa_id !== null) process.exit(1);
} finally {
  await cerrarDb();
}
