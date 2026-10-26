#!/usr/bin/env node
/**
 * Da de alta un negocio y su primera sucursal.
 *
 *   pnpm db:alta-negocio --slug don-poncho --nombre "Don Poncho" --giro restaurante \
 *     --paquete restaurante --sucursal "San Lorenzo Atemoaya"
 *
 * `db:bootstrap` crea al dueño y su PIN, pero exige que la organización ya
 * exista: «aquí no se crean negocios». Hasta hoy la única forma de crear una
 * era una migración con SQL directo, que es exactamente lo que dejó `auditoria`
 * en cero durante tres sesiones. Esto lo hace con el rol de aplicación, que
 * tiene DML y no DDL — no es una migración, es un alta, y deja su fila en
 * `auditoria` dentro de la misma transacción.
 *
 * ── Las guardas (DP-2) ─────────────────────────────────────────────────────
 * · Un negocio AJENO de la base compartida se niega antes de abrir la base.
 * · Don Poncho y los restaurantes de prueba nacen con el ID que declara
 *   `packages/contracts/src/negocios`: el mismo ID viaja a la base propia de
 *   noviembre y al servidor de enero. Si el slug o el ID ya existen con OTRO
 *   par, se niega: ninguna guarda reconocería a ese negocio.
 * · Idempotente: si el negocio ya existe con su ID, no se toca NADA —ni nombre,
 *   ni giro, ni plantilla— y lo dice. Un alta no edita un negocio que ya cobra.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
config({ path: [join(RAIZ, '.env.local'), join(RAIZ, '.env'), '.env.local', '.env'], quiet: true });

function bandera(nombre, porOmision) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? porOmision : process.argv[i + 1];
}

const slug = bandera('slug');
const nombre = bandera('nombre');
const giro = bandera('giro', 'restaurante');
const paquete = bandera('paquete', 'restaurante');
const sucursal = bandera('sucursal', 'Matriz');
const zonaHoraria = bandera('zona-horaria', 'America/Mexico_City');
const moneda = bandera('moneda', 'MXN');

if (slug === undefined || nombre === undefined) {
  console.error(
    'Uso: pnpm db:alta-negocio --slug <slug> --nombre "<nombre>" [--giro restaurante] [--paquete restaurante] [--sucursal Matriz]',
  );
  process.exit(1);
}
if (!/^[a-z0-9-]{3,60}$/.test(slug)) {
  console.error('El slug son minúsculas, dígitos y guiones (3 a 60).');
  process.exit(1);
}

const { NEGOCIOS_REALES, negocioAjeno, negocioDePruebaPorSlug } =
  await import('../../contracts/src/negocios/index.ts');
const ajeno = negocioAjeno(slug);
if (ajeno !== null) {
  console.error(`✗ «${slug}» es ${ajeno.nombre}, un negocio AJENO. Aquí no se da de alta.`);
  process.exit(1);
}
// El ID declarado: el de Don Poncho o el de un restaurante de prueba. Un negocio que no
// está en ninguna lista nace con uno aleatorio (y ninguna operación de prueba lo toca).
const declarado =
  NEGOCIOS_REALES.find((n) => n.slug === slug) ?? negocioDePruebaPorSlug(slug) ?? null;

const { conTransaccion, cerrarDb } = await import('@morphiqpos/data');

try {
  const resultado = await conTransaccion(async (tx) => {
    const existente = await tx
      .selectFrom('organizaciones')
      .select(['id', 'nombre', 'giro', 'paquete'])
      .where('slug', '=', slug)
      .executeTakeFirst();

    if (existente !== undefined) {
      if (declarado !== null && existente.id !== declarado.id) {
        throw new Error(
          `«${slug}» ya existe con el id ${existente.id}, y el declarado es ${declarado.id}. ` +
            'Con otro id ninguna guarda lo reconoce: no se toca. Revísalo a mano.',
        );
      }
      const primera = await tx
        .selectFrom('sucursales')
        .select(['id', 'nombre'])
        .where('organizacion_id', '=', existente.id)
        .executeTakeFirst();
      return { organizacion: existente, sucursal: primera ?? null, reusada: true };
    }

    if (declarado !== null) {
      const ocupado = await tx
        .selectFrom('organizaciones')
        .select(['slug'])
        .where('id', '=', declarado.id)
        .executeTakeFirst();
      if (ocupado !== undefined) {
        throw new Error(`El id ${declarado.id} ya lo usa «${ocupado.slug}». No se da de alta.`);
      }
    }

    const organizacion = await tx
      .insertInto('organizaciones')
      .values({
        ...(declarado === null ? {} : { id: declarado.id }),
        nombre,
        slug,
        giro,
        paquete,
        zona_horaria: zonaHoraria,
        moneda,
      })
      .returning(['id', 'nombre', 'giro', 'paquete'])
      .executeTakeFirstOrThrow();

    const primeraSucursal = await tx
      .insertInto('sucursales')
      .values({ organizacion_id: organizacion.id, nombre: sucursal })
      .returning(['id', 'nombre'])
      .executeTakeFirstOrThrow();

    // El rastro del alta, en la misma transacción: sin ella, la organización nace sin que
    // conste quién, cuándo ni con qué. No hay identidad todavía —el dueño nace después—.
    await tx
      .insertInto('auditoria')
      .values({
        organizacion_id: organizacion.id,
        accion: 'negocio.alta',
        entidad: 'organizacion',
        entidad_id: organizacion.id,
        payload: JSON.stringify({
          v: 1,
          comando: 'negocio.alta',
          via: 'db:alta-negocio',
          slug,
          giro,
          paquete,
          zonaHoraria,
          moneda,
          sucursal: { id: primeraSucursal.id, nombre: primeraSucursal.nombre },
        }),
      })
      .execute();

    return { organizacion, sucursal: primeraSucursal, reusada: false };
  });

  console.log('');
  console.log(`  Negocio ....... ${resultado.organizacion.nombre} (${slug})`);
  console.log(`  Id ............ ${resultado.organizacion.id}`);
  console.log(`  Giro .......... ${resultado.organizacion.giro}`);
  console.log(`  Paquete ....... ${resultado.organizacion.paquete}`);
  console.log(`  Sucursal ...... ${resultado.sucursal?.nombre ?? '(sin sucursal)'}`);
  console.log(
    `  Estado ........ ${resultado.reusada ? 'ya existía: no se tocó nada' : 'creado y auditado'}`,
  );
  console.log('');
  console.log(`  Ahora: pnpm db:bootstrap --org ${slug} --persona "<nombre>" --pin <4-8 dígitos>`);
  console.log(`  Y en el entorno del despliegue: ORGANIZACION=${slug}`);
  console.log('');
} catch (error) {
  console.error('');
  console.error('✗ El alta falló. La base quedó como estaba.');
  console.error(`  ${error instanceof Error ? error.message : String(error)}`);
  console.error('');
  process.exitCode = 1;
} finally {
  await cerrarDb();
}
