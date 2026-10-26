#!/usr/bin/env node
/**
 * Deja listo un restaurante dado de alta POR LOS COMANDOS DE LA APLICACIÓN (DP-4).
 *
 *   node --conditions=react-server scripts/preparar-negocio.mjs --org don-poncho \
 *     --persona "Miguel · Morphiq" --pines <archivo fuera del repo> \
 *     [--datos docs/cliente/negocio-don-poncho.json] [--ensayo]
 *
 * Configuración (nombre del sistema, dirección, logos y colores), apariencia, la zona con sus
 * mesas y el equipo. Cada cosa por su comando —`puente.escribir`, `configuracion.fijar_apariencia`,
 * `identidad.guardar_empleado`— con su rol, su transacción y su auditoría, firmado por el dueño
 * de `--persona`.
 *
 * LOS PIN NO ESTÁN EN EL REPOSITORIO: `--pines` es un JSON `{ "<nombre>": "<pin>" }` que vive en
 * `..\_PRIVADO\`. El guion no los imprime nunca.
 *
 * IDEMPOTENTE: la configuración y la apariencia se escriben con los mismos valores; la zona, cada
 * mesa (por número) y cada persona (por nombre) se crean sólo si no existen, y a quien ya existe
 * NO se le cambia el PIN. Sólo corre contra Don Poncho o un restaurante de prueba, por ID.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

for (const linea of (existsSync('.env') ? readFileSync('.env', 'utf8') : '').split('\n')) {
  const encontrado = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(linea.trim());
  if (encontrado !== null && process.env[encontrado[1]] === undefined) {
    process.env[encontrado[1]] = encontrado[2].replace(/^["']|["']$/g, '');
  }
}
process.env['MORPHIQPOS_DB_POOL_MAX'] ??= '3';

function argumento(nombre, porOmision = null) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? porOmision : (process.argv[i + 1] ?? porOmision);
}
const slug = argumento('org');
const persona = argumento('persona');
const rutaDePines = argumento('pines');
const rutaDeDatos = argumento('datos', 'docs/cliente/negocio-don-poncho.json');
const ensayo = process.argv.includes('--ensayo');
if (slug === null || persona === null || rutaDePines === null) {
  console.error(
    'Uso: preparar-negocio.mjs --org <slug> --persona "<dueño>" --pines <json> [--ensayo]',
  );
  process.exit(2);
}

const datos = JSON.parse(readFileSync(rutaDeDatos, 'utf8'));
const pines = JSON.parse(readFileSync(rutaDePines, 'utf8'));
const faltan = datos.equipo.filter((p) => !/^\d{4,8}$/.test(String(pines[p.nombre] ?? '')));
if (faltan.length > 0) {
  console.error(`✗ Sin PIN válido en --pines para: ${faltan.map((p) => p.nombre).join(', ')}.`);
  process.exit(1);
}

const { NEGOCIOS_REALES, NEGOCIOS_DE_PRUEBA, negocioAjeno } =
  await import('../packages/contracts/src/negocios/index.ts');
const { obtenerDb } = await import('../packages/data/src/cliente.ts');
const { comando } = await import('../packages/app/src/produccion.ts');
const { escribirDatos } = await import('../packages/app/src/puente/comandos.ts');
const { fijarApariencia } = await import('../packages/app/src/configuracion/index.ts');
const { guardarEmpleado } = await import('../packages/app/src/identidad/index.ts');

const permitido = [...NEGOCIOS_REALES, ...NEGOCIOS_DE_PRUEBA].find((n) => n.slug === slug);
if (negocioAjeno(slug) !== null || permitido === undefined) {
  console.error(`✗ «${slug}» no es Don Poncho ni un restaurante de prueba: no se toca.`);
  process.exit(1);
}

const db = obtenerDb();
const org = await db
  .selectFrom('organizaciones')
  .select('id')
  .where('id', '=', permitido.id)
  .where('slug', '=', slug)
  .executeTakeFirst();
const sucursal =
  org === undefined
    ? undefined
    : await db
        .selectFrom('sucursales')
        .select('id')
        .where('organizacion_id', '=', org.id)
        .orderBy('created_at', 'asc')
        .executeTakeFirst();
const actor =
  org === undefined
    ? undefined
    : await db
        .selectFrom('empleos')
        .innerJoin('personas', 'personas.id', 'empleos.persona_id')
        .innerJoin('identidades', 'identidades.persona_id', 'personas.id')
        .select(['empleos.id as empleoId', 'identidades.id as identidadId'])
        .where('empleos.organizacion_id', '=', org.id)
        .where('empleos.rol', '=', 'dueno')
        .where('empleos.activo', '=', true)
        .where('personas.nombre', '=', persona)
        .executeTakeFirst();
if (org === undefined || sucursal === undefined || actor === undefined) {
  console.error(`✗ «${slug}» sin alta, sin sucursal o sin «${persona}» como dueño activo.`);
  process.exit(1);
}

const ambito = {
  organizacionId: org.id,
  sucursalId: sucursal.id,
  terminalId: null,
  identidadId: actor.identidadId,
  empleoId: actor.empleoId,
  rol: 'dueno',
};
const hecho = [];

/**
 * La huella de lo que se manda: con los mismos datos, la misma clave (el comando devuelve lo de la
 * primera vez); con datos nuevos —otra versión de la configuración—, otra clave, en vez de un
 * `IDEMPOTENCIA_CONFLICTO` por reusar la vieja con otro contenido.
 */
function huella(entrada) {
  // El PIN NO entra: la clave se guarda en la base, y de cuatro dígitos se adivina a la fuerza.
  const sinPin = JSON.stringify(entrada, (campo, valor) => (campo === 'pin' ? undefined : valor));
  return createHash('sha256').update(sinPin).digest('hex').slice(0, 16);
}

async function ejecutar(definicion, entrada, clave) {
  if (ensayo) return null;
  const r = await comando(definicion, {
    ambito,
    entrada,
    idempotencyKey: `preparar-negocio:v${String(datos.version)}:${slug}:${clave}:${huella(entrada)}`,
  });
  if (!r.ok) throw new Error(`${clave}: ${r.error.codigo} · ${r.error.mensaje ?? ''}`);
  return r.datos;
}

// 1 · Configuración (con el portal QR) y apariencia: mismos valores, mismo resultado.
await ejecutar(
  escribirDatos,
  {
    entidad: 'ConfiguracionNegocio',
    operacion: 'update',
    datos: { ...datos.configuracion, ...datos.portal.configuracion },
  },
  'configuracion',
);
await ejecutar(fijarApariencia, datos.apariencia, 'apariencia');
hecho.push('configuración y portal QR', `estilo ${datos.apariencia.estilo}`);

// 1b · Las páginas del menú personalizado, por título. La imagen se sirve del propio sitio
// (`apps/web/public/menu-qr`, la genera `generar-menu-qr.mjs`) con la dirección del despliegue.
const origen = new URL(process.env['APP_URL'] ?? '').origin;
const paginasQueHay = new Set(
  (
    await db
      .selectFrom('menu_qr_secciones')
      .select('nombre')
      .where('organizacion_id', '=', org.id)
      .execute()
  ).map((p) => p.nombre),
);
let paginasNuevas = 0;
for (const [orden, pagina] of datos.portal.paginas.entries()) {
  if (paginasQueHay.has(pagina.titulo)) continue;
  paginasNuevas += 1;
  const seccion = {
    nombre: pagina.titulo,
    imagen_url: `${origen}/menu-qr/${pagina.archivo}.webp`,
    orden,
    activo: true,
  };
  await ejecutar(
    escribirDatos,
    { entidad: 'MenuQRSeccion', operacion: 'create', datos: seccion },
    `pagina:${pagina.archivo}`,
  );
}
hecho.push(
  `${String(paginasNuevas)} páginas del menú QR nuevas de ${String(datos.portal.paginas.length)}`,
);

// 2 · La zona y sus mesas, por nombre y por número.
let zona = await db
  .selectFrom('zonas')
  .select('id')
  .where('organizacion_id', '=', org.id)
  .where('nombre', '=', datos.sala.zona)
  .executeTakeFirst();
if (zona === undefined) {
  const creada = await ejecutar(
    escribirDatos,
    { entidad: 'Zona', operacion: 'create', datos: { nombre: datos.sala.zona, orden: 0 } },
    `zona:${datos.sala.zona}`,
  );
  zona = creada === null ? { id: null } : { id: creada.id };
}
const numeros = new Set(
  (
    await db.selectFrom('mesas').select('numero').where('organizacion_id', '=', org.id).execute()
  ).map((m) => Number(m.numero)),
);
let mesasNuevas = 0;
for (let numero = 1; numero <= datos.sala.mesas; numero += 1) {
  if (numeros.has(numero)) continue;
  mesasNuevas += 1;
  const mesa = {
    numero,
    nombre: `Mesa ${String(numero)}`,
    zona_id: zona.id,
    capacidad: datos.sala.capacidad,
    orden: numero,
    activo: true,
  };
  await ejecutar(
    escribirDatos,
    { entidad: 'Mesa', operacion: 'create', datos: mesa },
    `mesa:${String(numero)}`,
  );
}
hecho.push(
  `zona «${datos.sala.zona}»`,
  `${String(mesasNuevas)} mesas nuevas de ${String(datos.sala.mesas)}`,
);

// 3 · El equipo, por nombre. A quien ya existe no se le toca el PIN.
const yaEstan = new Set(
  (
    await db
      .selectFrom('empleos')
      .innerJoin('personas', 'personas.id', 'empleos.persona_id')
      .select('personas.nombre')
      .where('empleos.organizacion_id', '=', org.id)
      .execute()
  ).map((p) => p.nombre),
);
let personasNuevas = 0;
for (const integrante of datos.equipo) {
  if (yaEstan.has(integrante.nombre)) continue;
  personasNuevas += 1;
  await ejecutar(
    guardarEmpleado,
    { nombre: integrante.nombre, puesto: integrante.puesto, pin: String(pines[integrante.nombre]) },
    `empleado:${integrante.nombre}`,
  );
}
hecho.push(`${String(personasNuevas)} personas nuevas de ${String(datos.equipo.length)}`);

// 4 · Quién responde por cada mesa. Con la asignación encendida el comensal pide desde el QR
// y la comanda tiene dueño (`puedeOrdenarDesdeQR`). Sólo las mesas que siguen sin asignar.
let asignadas = 0;
if (!ensayo) {
  for (const [nombre, numerosDeMesa] of Object.entries(datos.sala.asignacion ?? {})) {
    const empleo = await db
      .selectFrom('empleos')
      .innerJoin('personas', 'personas.id', 'empleos.persona_id')
      .select('empleos.id')
      .where('empleos.organizacion_id', '=', org.id)
      .where('empleos.activo', '=', true)
      .where('personas.nombre', '=', nombre)
      .executeTakeFirst();
    if (empleo === undefined)
      throw new Error(`«${nombre}» no está en el equipo: no se le asignan mesas.`);
    const libres = await db
      .selectFrom('mesas')
      .select(['id', 'numero'])
      .where('organizacion_id', '=', org.id)
      .where('numero', 'in', numerosDeMesa)
      .where('empleado_asignado_id', 'is', null)
      .execute();
    for (const mesa of libres) {
      asignadas += 1;
      await ejecutar(
        escribirDatos,
        {
          entidad: 'Mesa',
          operacion: 'update',
          id: mesa.id,
          datos: { mesero_asignado_id: empleo.id },
        },
        `asignacion:${String(mesa.numero)}`,
      );
    }
  }
}
hecho.push(`${String(asignadas)} mesas asignadas`);

console.log(
  `${ensayo ? '◦ Ensayo' : '✓ Preparado'} «${slug}»: ${hecho.join(' · ')}. (Los PIN no se imprimen.)`,
);
await db.destroy();
