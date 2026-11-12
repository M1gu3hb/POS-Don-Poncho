/**
 * LA COPIA DE LA BASE PROPIA PARA EL SIMULADOR: una base `qa_…` en el clúster LOCAL, nunca otra.
 *
 *   # Desde la exportación de sólo lectura (`scripts/exportar-negocio.mjs`, sin archivos):
 *   node --conditions=react-server qa/simulador/copia.ts --base postgres://morphiqpos@localhost:5460/qa_dp18_base \
 *     --desde "D:/MIS PROYECTOS/MORPHIQ POS/_PRIVADO/mudanza/<exportación>" --pines D:/mpos-tmp/qa-dp18-base
 *
 *   # Clonando otra copia ya armada (un molde): rápido, con los mismos PIN de prueba.
 *   node --conditions=react-server qa/simulador/copia.ts --base postgres://…localhost:5460/qa_dp18_dia1 \
 *     --molde qa_dp18_molde --pines D:/mpos-tmp/qa-dp18-dia1 --pines-del-molde D:/mpos-tmp/qa-dp18-molde
 *
 * Desde la exportación: migra desde cero con `pnpm db:migrate` (el mismo camino que producción),
 * importa con `scripts/importar-negocio.mjs` y cambia TODOS los PIN copiados por PIN de prueba de
 * cuatro cifras, sembrados con la pimienta LOCAL de la base desechable (los reales dejan de servir
 * en la copia). Los PIN se escriben en `--pines`, fuera del repositorio, y nunca se imprimen.
 *
 * Pasa por el candado ANTES de tocar nada: la base tiene que ser local y llamarse `qa_…`.
 */
import { randomInt } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { exigirCopiaLocal } from './candado.ts';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? undefined : process.argv[i + 1];
}
function exigido(nombre: string): string {
  const v = arg(nombre);
  if (v === undefined || v === '') throw new Error(`Falta --${nombre}`);
  return v;
}

/** Los PIN de prueba viven en D:/mpos-tmp/, fuera del repositorio. */
function carpetaDePines(ruta: string): string {
  const normal = ruta.replaceAll('\\', '/');
  if (!normal.startsWith('D:/mpos-tmp/')) {
    throw new Error('Los PIN de prueba se escriben sólo en D:/mpos-tmp/ (fuera del repositorio).');
  }
  return normal;
}

interface Consulta {
  rows: Record<string, unknown>[];
}
interface Cliente {
  connect(): Promise<void>;
  end(): Promise<void>;
  query(texto: string, valores?: unknown[]): Promise<Consulta>;
}
type ClaseCliente = new (o: { connectionString: string }) => Cliente;

const pg = createRequire(join(RAIZ, 'packages/data/package.json'))('pg') as {
  Client: ClaseCliente;
};

function correr(comando: string, args: readonly string[], entorno: NodeJS.ProcessEnv): void {
  const r = spawnSync(comando, args, { cwd: RAIZ, env: entorno, stdio: 'inherit', shell: false });
  if (r.status !== 0)
    throw new Error(`${comando} ${args.join(' ')} terminó con ${String(r.status)}`);
}

/** La pimienta de la base desechable: con ella siembra los PIN esta copia y la usa el servidor. */
function pimientaLocal(): string {
  const r = spawnSync(
    process.execPath,
    ['--conditions=react-server', 'scripts/base-desechable.mjs', 'entorno'],
    { cwd: RAIZ, encoding: 'utf8' },
  );
  for (const linea of r.stdout.split('\n')) {
    const m = /^PIN_PEPPER=(.*)$/.exec(linea.trim());
    if (m?.[1] !== undefined && m[1] !== '') return m[1];
  }
  throw new Error('No se pudo leer la pimienta local de la base desechable.');
}

async function conCliente<T>(url: string, fn: (c: Cliente) => Promise<T>): Promise<T> {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

/** Los nombres van como identificadores en `create database`: sólo `qa_` y minúsculas, cifras y `_`. */
function nombreSeguro(nombre: string): string {
  if (!/^qa_[a-z0-9_]{1,50}$/.test(nombre)) {
    throw new Error(`«${nombre}» no es un nombre de copia válido (qa_ y minúsculas, cifras o _).`);
  }
  return nombre;
}

/** Crea la base vacía (o clonada de un molde) desde la base `postgres` del mismo clúster. */
async function crearLaBase(destino: URL, molde: string | undefined): Promise<void> {
  const nombre = nombreSeguro(destino.pathname.slice(1));
  if (molde !== undefined) nombreSeguro(molde);
  const admin = new URL(destino.href);
  admin.pathname = '/postgres';
  await conCliente(admin.href, async (c) => {
    await c.query(`drop database if exists ${nombre} with (force)`);
    if (molde === undefined) {
      await c.query(`create database ${nombre}`);
      return;
    }
    await c.query('select pg_terminate_backend(pid) from pg_stat_activity where datname = $1', [
      molde,
    ]);
    await c.query(`create database ${nombre} template ${molde}`);
  });
}

/** El reloj de QA cambia el `search_path` de la base, y eso no viaja con `template`. */
async function reponerElRelojSiLoTiene(destino: URL): Promise<void> {
  const nombre = nombreSeguro(destino.pathname.slice(1));
  const tiene = await conCliente(destino.href, async (c) => {
    const r = await c.query("select 1 from pg_namespace where nspname = 'qa_reloj'");
    return r.rows.length === 1;
  });
  if (!tiene) return;
  const admin = new URL(destino.href);
  admin.pathname = '/postgres';
  await conCliente(admin.href, async (c) => {
    await c.query(`alter database ${nombre} set search_path = qa_reloj, public, pg_catalog`);
  });
}

async function sembrarPinesDePrueba(destino: URL, carpeta: string): Promise<number> {
  const { hashearPin } = (await import(
    pathToFileURL(join(RAIZ, 'packages/app/src/identidad/pin.ts')).href
  )) as { hashearPin: (pin: string, pimienta: string) => Promise<string> };
  const pimienta = pimientaLocal();
  const pines: Record<string, string> = {};
  const personas: { nombre: string; rol: string }[] = [];
  await conCliente(destino.href, async (c) => {
    await c.query('begin');
    const { rows } = await c.query(
      `select i.id as identidad_id, p.nombre, e.rol
         from empleos e
         join identidades i on i.persona_id = e.persona_id
         join credenciales_pin cp on cp.identidad_id = i.id
         join personas p on p.id = e.persona_id
         join organizaciones o on o.id = e.organizacion_id
        where o.slug = 'don-poncho' and e.activo
        order by e.rol, p.nombre`,
    );
    const usados = new Set<string>();
    for (const fila of rows) {
      let pin: string;
      do pin = String(randomInt(1000, 10000));
      while (usados.has(pin) || /^(\d)\1{3}$/.test(pin) || '0123456789'.includes(pin));
      usados.add(pin);
      await c.query(
        `update credenciales_pin
            set pin_hash = $1, intentos_fallidos = 0, bloqueada_hasta = null
          where identidad_id = $2`,
        [await hashearPin(pin, pimienta), fila['identidad_id']],
      );
      pines[String(fila['nombre'])] = pin;
      personas.push({ nombre: String(fila['nombre']), rol: String(fila['rol']) });
    }
    await c.query('delete from limite_tasa');
    await c.query('commit');
  });
  mkdirSync(carpeta, { recursive: true });
  writeFileSync(join(carpeta, 'pines.json'), `${JSON.stringify(pines, null, 2)}\n`);
  writeFileSync(join(carpeta, 'personas.json'), `${JSON.stringify(personas, null, 2)}\n`);
  return personas.length;
}

async function main(): Promise<void> {
  const base = exigido('base');
  exigirCopiaLocal({ databaseUrl: base, entorno: process.env });
  const destino = new URL(base);
  const carpeta = carpetaDePines(exigido('pines'));
  const molde = arg('molde');

  if (molde !== undefined) {
    const urlDelMolde = new URL(base);
    urlDelMolde.pathname = `/${molde}`;
    exigirCopiaLocal({ databaseUrl: urlDelMolde.href, entorno: process.env });
    const pinesDelMolde = carpetaDePines(exigido('pines-del-molde'));
    await crearLaBase(destino, molde);
    await reponerElRelojSiLoTiene(destino);
    mkdirSync(carpeta, { recursive: true });
    copyFileSync(join(pinesDelMolde, 'pines.json'), join(carpeta, 'pines.json'));
    // `personas.json` sólo lo deja una copia armada desde la exportación.
    if (existsSync(join(pinesDelMolde, 'personas.json'))) {
      copyFileSync(join(pinesDelMolde, 'personas.json'), join(carpeta, 'personas.json'));
    }
    console.log(`Copia ${destino.pathname.slice(1)} clonada de ${molde}, con sus PIN de prueba.`);
    return;
  }

  const desde = exigido('desde');
  await crearLaBase(destino, undefined);
  await conCliente(destino.href, async (c) => {
    for (const rol of ['morphiqpos_app', 'anon', 'authenticated', 'service_role']) {
      const r = await c.query('select 1 from pg_roles where rolname = $1', [rol]);
      if (r.rows.length > 0) continue;
      await c.query(
        rol === 'morphiqpos_app'
          ? `create role ${rol} with login bypassrls`
          : `create role ${rol} nologin`,
      );
    }
  });
  const entorno: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: base };
  delete entorno['MORPHIQPOS_SUPABASE_PROJECT_REF'];
  delete entorno['STORAGE_ENDPOINT'];
  correr(process.execPath, ['scripts/db.mjs', 'migrate'], entorno);
  correr(
    process.execPath,
    [
      '--conditions=react-server',
      'scripts/importar-negocio.mjs',
      '--desde',
      desde,
      '--base',
      base,
      '--archivos-destino',
      `${carpeta}-archivos`,
    ],
    entorno,
  );
  const n = await sembrarPinesDePrueba(destino, carpeta);
  console.log(
    `Copia ${destino.pathname.slice(1)} lista: ${String(n)} PIN de prueba en ${carpeta}.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
