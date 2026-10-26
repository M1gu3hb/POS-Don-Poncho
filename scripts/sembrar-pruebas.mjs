#!/usr/bin/env node
/**
 * Siembra LOS RESTAURANTES DE PRUEBA en una base desechable, sin levantar un servidor.
 *
 *   node --conditions=react-server scripts/sembrar-pruebas.mjs [--solo <slug>]
 *
 * Ejecuta el MISMO comando que `/api/pruebas/resetear` —`configuracion.resetear_negocio_de_prueba`—
 * con las dependencias de producción: la misma transacción, el mismo gate de rol, la misma
 * auditoría. Lo único que no pasa por HTTP es el ámbito, que se construye leyendo la
 * organización, su sucursal y su dueño de la base.
 *
 * ── Las guardas, que son lo primero ─────────────────────────────────────────
 * El comando BORRA el catálogo, el inventario y las ventas del negocio. Sólo corre sobre los
 * `NEGOCIOS_DE_PRUEBA` (por ID) y se niega si `DATABASE_URL` es de un proyecto intocable: en
 * la base compartida de la Fase A no hay nada que sembrar (DP-D06).
 */
import { existsSync, readFileSync } from 'node:fs';

/**
 * El `.env` a mano: este script no pasa por Next, que es quien lo carga.
 *
 * Y SI NO HAY, no pasa nada: en CI las variables llegan por el entorno del
 * trabajo y el archivo no existe. Antes esto reventaba con `ENOENT .env` antes de
 * leer una sola variable, lo que dejaba la siembra fuera de cualquier sitio que no
 * fuera una laptop con su `.env` — y con ella el rastreador, que necesita los restaurantes
 * de prueba sembrados para poder tocar algo.
 */
for (const linea of (existsSync('.env') ? readFileSync('.env', 'utf8') : '').split('\n')) {
  const encontrado = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(linea.trim());
  if (encontrado !== null && process.env[encontrado[1]] === undefined) {
    process.env[encontrado[1]] = encontrado[2].replace(/^["']|["']$/g, '');
  }
}
process.env['MORPHIQPOS_DB_POOL_MAX'] ??= '3';

const { obtenerDb } = await import('../packages/data/src/cliente.ts');
const { comando } = await import('../packages/app/src/produccion.ts');
const { resetearNegocioDePrueba } = await import('../packages/app/src/negocio-de-prueba/index.ts');
const { NEGOCIOS_DE_PRUEBA, exigirNegocioDePrueba } =
  await import('../packages/contracts/src/negocios/index.ts');

/**
 * La plantilla, el estilo, el IVA y los topes los repone el propio reseteo
 * (`packages/app/src/negocio-de-prueba/como-nueva.ts`). Y la lista de negocios tampoco vive
 * aquí: la regla es POSITIVA y está en `packages/contracts/src/negocios`.
 */
const soloEste = process.argv.includes('--solo')
  ? process.argv[process.argv.indexOf('--solo') + 1]
  : null;

/**
 * El sello de esta corrida, para la clave de idempotencia.
 *
 * Lleva la hora: sembrar dos veces el mismo día es lo normal mientras se
 * construye, y con sólo la fecha la segunda corrida devolvería la primera sin
 * volver a sembrar — que es lo contrario de lo que se quiere aquí.
 */
const sello = new Date()
  .toISOString()
  .replace(/[^0-9]/g, '')
  .slice(0, 14);

const db = obtenerDb();

// Los de prueba, POR ID y de la lista compartida: una regla de prefijo daría por buena una
// caja ajena (tres negocios de la base compartida tienen un slug que empieza por `demo-`).
const demos = await db
  .selectFrom('organizaciones')
  .select(['id', 'slug', 'nombre', 'giro', 'paquete'])
  .where(
    'id',
    'in',
    NEGOCIOS_DE_PRUEBA.map((d) => d.id),
  )
  .where('activa', '=', true)
  .orderBy('slug')
  .execute();

if (demos.length === 0) {
  console.error('✗ No hay ningún restaurante de prueba activo. Créalos con `db:alta-negocio`.');
  process.exit(1);
}
if (soloEste !== null && !demos.some((d) => d.slug === soloEste)) {
  // `--solo` con un negocio que no es una demo: se dice ANTES de tocar nada.
  try {
    exigirNegocioDePrueba({ slug: soloEste }, 'sembrar-pruebas');
  } catch (error) {
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  }
  process.exit(1);
}

let fallos = 0;

for (const demo of demos) {
  if (soloEste !== null && demo.slug !== soloEste) continue;

  // Segundo cerrojo, por ID y slug a la vez: la consulta ya filtró por la lista, así
  // que esto no puede fallar HOY. Se queda por si alguien cambia la consulta.
  exigirNegocioDePrueba({ id: demo.id, slug: demo.slug }, 'sembrar-pruebas');

  const sucursal = await db
    .selectFrom('sucursales')
    .select('id')
    .where('organizacion_id', '=', demo.id)
    .orderBy('created_at', 'asc')
    .executeTakeFirst();
  if (sucursal === undefined) {
    console.error(`✗ «${demo.slug}» no tiene sucursal. \`db:alta-negocio\` crea la primera.`);
    fallos += 1;
    continue;
  }

  // El dueño, que es quien puede resetear. `resetearNegocioDePrueba` declara
  // `roles: ['dueno','administrador']` a propósito: borra el negocio entero.
  const dueno = await db
    .selectFrom('empleos')
    .innerJoin('personas', 'personas.id', 'empleos.persona_id')
    .innerJoin('identidades', 'identidades.persona_id', 'personas.id')
    .select(['empleos.id as empleoId', 'identidades.id as identidadId'])
    .where('empleos.organizacion_id', '=', demo.id)
    .where('empleos.rol', '=', 'dueno')
    .where('empleos.activo', '=', true)
    .executeTakeFirst();
  if (dueno === undefined) {
    console.error(
      `✗ «${demo.slug}» no tiene dueño. Lo crea \`db:bootstrap --org ${demo.slug}\`, que es otro paso.`,
    );
    fallos += 1;
    continue;
  }

  const resultado = await comando(resetearNegocioDePrueba, {
    ambito: {
      organizacionId: demo.id,
      sucursalId: sucursal.id,
      // No hay terminal en el ámbito: esto no corre desde una caja. La terminal
      // en la que abre la sesión de caja la resuelve `sembrarArranque`.
      terminalId: null,
      identidadId: dueno.identidadId,
      empleoId: dueno.empleoId,
      rol: 'dueno',
    },
    entrada: { confirmacion: 'RESETEAR' },
    // La clave de idempotencia es OBLIGATORIA para todo comando que escribe: es
    // lo que evita cobrar dos veces. Aquí se deriva del slug y del día, así que
    // dos corridas seguidas del mismo día devuelven la primera en vez de sembrar
    // dos veces — que es exactamente lo que la clave existe para hacer.
    idempotencyKey: `sembrar-pruebas:${demo.slug}:${sello}`,
  });

  if (!resultado.ok) {
    console.error(`✗ «${demo.slug}»: ${resultado.error.codigo} · ${resultado.error.mensaje ?? ''}`);
    fallos += 1;
    continue;
  }

  const d = resultado.datos;
  const partes = [
    `${String(d.productos)} vendibles`,
    `${String(d.insumos)} insumos`,
    `${String(d.empleados)} empleados`,
    `caja con $${(Number(d.arranque.fondoCentavos) / 100).toFixed(2)}`,
    d.arranque.proveedor,
  ];
  partes.push(`${String(d.sala.mesas)} mesas`);
  console.log(`  ✓ ${demo.slug.padEnd(26)} ${partes.join(' · ')}`);
}

console.log(
  fallos === 0
    ? '\n✓ Los restaurantes de prueba están sembrados.\n'
    : `\n✗ ${String(fallos)} restaurante(s) de prueba sin sembrar.\n`,
);
process.exit(fallos === 0 ? 0 : 1);
