#!/usr/bin/env node
/**
 * Deja listo un restaurante dado de alta POR LOS COMANDOS DE LA APLICACIÓN (DP-4).
 *
 *   node --conditions=react-server scripts/preparar-negocio.mjs --org don-poncho \
 *     --persona "Miguel · Morphiq" --pines <archivo fuera del repo> \
 *     [--datos docs/cliente/negocio-don-poncho.json] [--ensayo]
 *
 * Configuración (con el portal QR encendido), apariencia, páginas del menú personalizado, zona y
 * mesas, equipo, quién responde por cada mesa y el QR de cada una. Cada cosa por su comando, con
 * su rol, su transacción y su auditoría, firmado por el dueño de `--persona`.
 *
 * LOS PIN NO ESTÁN EN EL REPOSITORIO: `--pines` es un JSON `{ "<nombre>": "<pin>" }` que vive en
 * `..\_PRIVADO\`. El guion no los imprime nunca.
 *
 * IDEMPOTENTE: lo que ya está no se toca (a quien existe NO se le cambia el PIN; la mesa que ya
 * tiene QR lo conserva). Sólo corre contra Don Poncho o un restaurante de prueba, por ID.
 */
import { readFileSync } from 'node:fs';

import { argumento, cargarEntorno, huella } from './lib/guion.mjs';

cargarEntorno();

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
const { rotarQr } = await import('../packages/app/src/restaurante/index.ts');

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
const paginasQueHay = new Map(
  (
    await db
      .selectFrom('menu_qr_secciones')
      .select(['id', 'nombre', 'imagen_url', 'updated_at'])
      .where('organizacion_id', '=', org.id)
      .execute()
  ).map((p) => [p.nombre, p]),
);
let paginasNuevas = 0;
let paginasMudadas = 0;
for (const [orden, pagina] of datos.portal.paginas.entries()) {
  const imagen = `${origen}/menu-qr/${pagina.archivo}.webp`;
  const existente = paginasQueHay.get(pagina.titulo);
  if (existente !== undefined) {
    // Al mudar de dominio (Fase B o C) la imagen apunta todavía al de antes: se corrige, pero
    // SÓLO si es la que puso este guion (`/menu-qr/<archivo>.webp`); una que subió el dueño, no.
    // La clave lleva el `updated_at` de la fila: ir y volver (A → B → A) es otra escritura, no
    // la respuesta guardada de la primera vez que se escribió A.
    const esLaNuestra = (existente.imagen_url ?? '').endsWith(`/menu-qr/${pagina.archivo}.webp`);
    if (esLaNuestra && existente.imagen_url !== imagen) {
      paginasMudadas += 1;
      await ejecutar(
        escribirDatos,
        {
          entidad: 'MenuQRSeccion',
          operacion: 'update',
          id: existente.id,
          datos: { imagen_url: imagen },
        },
        `pagina-mudada:${pagina.archivo}:${new Date(existente.updated_at).toISOString()}`,
      );
    }
    continue;
  }
  paginasNuevas += 1;
  const seccion = { nombre: pagina.titulo, imagen_url: imagen, orden, activo: true };
  await ejecutar(
    escribirDatos,
    { entidad: 'MenuQRSeccion', operacion: 'create', datos: seccion },
    `pagina:${pagina.archivo}`,
  );
}
hecho.push(
  `${String(paginasNuevas)} páginas del menú QR nuevas de ${String(datos.portal.paginas.length)}` +
    (paginasMudadas > 0 ? ` (${String(paginasMudadas)} con su dirección nueva)` : ''),
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

// 5 · El QR de cada mesa que no lo tiene, por `restaurante.rotar_qr` (el «Generar tokens» de
// Portal QR). La que ya tiene el suyo —impreso, quizá— lo conserva.
const sinQr = ensayo
  ? []
  : await db
      .selectFrom('mesas')
      .select(['id', 'numero'])
      .where('organizacion_id', '=', org.id)
      .where('qr_token', 'is', null)
      .execute();
for (const mesa of sinQr) await ejecutar(rotarQr, { mesaId: mesa.id }, `qr:${String(mesa.numero)}`);
hecho.push(`${String(sinQr.length)} QR de mesa nuevos`);

console.log(
  `${ensayo ? '◦ Ensayo' : '✓ Preparado'} «${slug}»: ${hecho.join(' · ')}. (Los PIN no se imprimen.)`,
);
await db.destroy();
