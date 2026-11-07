import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

/**
 * DP-13.3b · EL DOCUMENTO DE CONFIGURACIÓN: QUIÉN LO LEE, QUIÉN LO ESCRIBE.
 *
 * `configuracion.valores` guarda, junto a lo que se enseña, claves del servidor: la marca de
 * plataforma, el hash de la presentación, la versión del teléfono de cocina. Dos cosas sostienen
 * que nada se pierda ni se filtre, y las dos son fáciles de romper con un archivo nuevo:
 *
 *   · ESCRITURA: quien lee el documento y lo escribe entero lo hace con candado
 *     (`leerDocumentoConCandado`), o lo mezcla en una sola sentencia (`valores || …`).
 *   · LECTURA: de todos los que leen el documento, uno solo lo devuelve entero
 *     (`puente/configuracion.ts`) y ése quita `NUNCA_SALEN`. Los demás sacan campos con nombre
 *     o no sacan nada.
 *
 * Este contrato inventaría los archivos de `packages/` y `apps/web/` que tocan la tabla y exige
 * que cada uno esté clasificado. Un lector o un escritor nuevo rompe la prueba hasta que alguien
 * decide qué es, que es lo que no pasó con ninguno de los seis. Se afirma sobre el CÓDIGO sin
 * comentarios y sobre el ORDEN (el candado antes de la escritura), no sobre un nombre suelto.
 * Lo que NO ve: que el SQL de un lector «interno» no termine, algún día, en una respuesta. Para
 * eso está `puente/claves-del-servidor.integracion.test.ts`, que ejecuta los caminos que salen.
 */

const RAIZ = process.cwd();
const CARPETAS = ['packages/app/src', 'packages/data/src', 'apps/web/app', 'apps/web/src'];

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (['node_modules', '.next', 'migraciones'].includes(nombre)) return [];
    if (statSync(ruta).isDirectory()) return nombre === 'pruebas' ? [] : archivos(ruta);
    return /\.(ts|tsx|js|jsx|mjs)$/.test(nombre) && !nombre.includes('.test.') ? [ruta] : [];
  });
}

/** El código sin comentarios, respetando las comillas (`'http://…'` no abre un comentario). */
function sinComentarios(codigo: string): string {
  let salida = '';
  let comilla: string | null = null;
  for (let i = 0; i < codigo.length; i += 1) {
    const c = codigo[i] ?? '';
    const sig = codigo[i + 1] ?? '';
    if (comilla !== null) {
      salida += c;
      if (c === '\\') {
        salida += sig;
        i += 1;
      } else if (c === comilla) comilla = null;
      continue;
    }
    if (c === '/' && sig === '/') {
      while (i < codigo.length && codigo[i] !== '\n') i += 1;
      i -= 1;
      continue;
    }
    if (c === '/' && sig === '*') {
      const fin = codigo.indexOf('*/', i + 2);
      i = fin === -1 ? codigo.length : fin + 1;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') comilla = c;
    salida += c;
  }
  return salida;
}

const LEE = [
  /selectFrom\(\s*['"]configuracion(\s+as\s+\w+)?['"]/,
  /[jJ]oin\(\s*['"]configuracion/,
  /\b(from|join)\s+configuracion\b/,
];
const ESCRIBE = [
  /insertInto\(\s*['"]configuracion['"]/,
  /updateTable\(\s*['"]configuracion['"]/,
  /deleteFrom\(\s*['"]configuracion['"]/,
  /\binsert\s+into\s+configuracion\b/i,
  /\bupdate\s+configuracion\b/i,
  /\bdelete\s+from\s+configuracion\b/i,
];

/** Cada archivo se lee y se limpia una sola vez: son más de mil y la máquina no siempre vuela. */
const CRUDOS = new Map<string, string>();
const CODIGOS = new Map<string, string>();

function crudo(ruta: string): string {
  const leido = CRUDOS.get(ruta) ?? readFileSync(join(RAIZ, ruta), 'utf8');
  CRUDOS.set(ruta, leido);
  return leido;
}

function codigoDe(ruta: string): string {
  const limpio = CODIGOS.get(ruta) ?? sinComentarios(crudo(ruta));
  CODIGOS.set(ruta, limpio);
  return limpio;
}

const TODOS = CARPETAS.flatMap((carpeta) =>
  archivos(join(RAIZ, carpeta)).map((a) => relative(RAIZ, a).replaceAll('\\', '/')),
);

function tocan(patrones: readonly RegExp[]): string[] {
  // Todos los patrones nombran `configuracion`: el que no la nombra ni se limpia.
  return TODOS.filter(
    (ruta) => crudo(ruta).includes('configuracion') && patrones.some((p) => p.test(codigoDe(ruta))),
  ).sort();
}

beforeAll(() => {
  tocan(LEE);
}, 120_000);

/** Cada lector, con lo que hace con lo que lee. */
const LECTORES: Readonly<Record<string, 'documento-filtrado' | 'proyeccion' | 'interno'>> = {
  // Devuelve el documento ENTERO al navegador: por eso filtra `NUNCA_SALEN`.
  'packages/app/src/puente/configuracion.ts': 'documento-filtrado',
  // Sacan campos con nombre: la apariencia, la experiencia, el impuesto, la configuración tipada.
  'packages/app/src/configuracion/apariencia.ts': 'proyeccion',
  'packages/app/src/configuracion/configuracion.ts': 'proyeccion',
  'packages/app/src/configuracion/experiencia.ts': 'proyeccion',
  'packages/app/src/venta/cotizar.ts': 'proyeccion',
  'packages/app/src/caja/corte/consultas.ts': 'proyeccion', // `negocioDe`: campos con nombre
  // No sacan el documento: lo comparan, lo cuentan o se lo dan a quien lo vuelve a escribir.
  'packages/app/src/archivos/en-uso.ts': 'interno',
  'packages/app/src/configuracion/documento-con-candado.ts': 'interno',
  'packages/app/src/mantenimiento/plataforma.ts': 'interno',
  'packages/app/src/portal/negocio.ts': 'interno', // sale por `portal/consulta.ts`, con proyecciones
  // DP-13.2: lee la bandera `pin_al_cancelar_cuenta_pedida`; no devuelve el documento.
  'packages/app/src/restaurante/cancelar-con-permiso.ts': 'interno',
  'packages/app/src/telefono-de-cocina/ambito.ts': 'interno',
  // DP-14.2: lee la bandera `descuentos_permitidos`; no devuelve el documento (escribe por el
  // guardado parcial del puente, con su candado).
  'packages/app/src/venta/descuentos-permitidos.ts': 'interno',
  'packages/data/src/repos/archivos.ts': 'interno',
};

/** Cada escritor, y cómo evita pisar lo de otro. */
const ESCRITORES: Readonly<Record<string, 'candado' | 'atomico' | 'delegado'>> = {
  'packages/app/src/configuracion/configuracion.ts': 'candado',
  'packages/app/src/configuracion/apariencia.ts': 'candado',
  'packages/app/src/puente/configuracion.ts': 'candado',
  'packages/app/src/negocio-de-prueba/resetear.ts': 'candado',
  // Una sola sentencia `insert … on conflict do update set valores = valores || …`.
  'packages/app/src/telefono-de-cocina/conectar.ts': 'atomico',
  // Escribe con `valores || …` lo que sus llamadores leyeron con candado (se comprueba abajo).
  'packages/app/src/mantenimiento/plataforma.ts': 'delegado',
};

const PRIMERA_ESCRITURA = (codigo: string): number =>
  Math.min(
    ...ESCRIBE.map((p) => codigo.search(p)).filter((posicion) => posicion >= 0),
    Number.POSITIVE_INFINITY,
  );

describe('quién lee el documento de configuración', () => {
  it('el inventario ve lo que hay: si no, todo lo de abajo pasaría vacío', () => {
    const leen = tocan(LEE);
    expect(leen.length).toBeGreaterThanOrEqual(10);
    expect(leen).toContain('packages/app/src/puente/configuracion.ts');
  });

  it('todo lector está clasificado, y ninguna clasificación sobra', () => {
    expect(tocan(LEE)).toEqual(Object.keys(LECTORES).sort());
  });

  it('sólo un lector devuelve el documento entero, y ése quita las claves del servidor', () => {
    const enteros = Object.entries(LECTORES).filter(
      ([, salida]) => salida === 'documento-filtrado',
    );
    expect(enteros.map(([ruta]) => ruta)).toEqual(['packages/app/src/puente/configuracion.ts']);

    const codigo = codigoDe('packages/app/src/puente/configuracion.ts');
    const lista = /const NUNCA_SALEN = new Set\(\[([\s\S]*?)\]\);/.exec(codigo)?.[1] ?? '';
    for (const clave of [
      'plataforma',
      'telefonos_de_cocina',
      'presentacion_password',
      'presentacion_password_hash',
    ]) {
      expect(lista, `NUNCA_SALEN no incluye «${clave}»`).toContain(`'${clave}'`);
    }
    // La lectura copia SIN esas claves (y la escritura las rechaza): se afirma sobre el cuerpo de
    // cada función, no sobre el archivo.
    const lectura =
      /export async function leerConfiguracion\([\s\S]*?\n\}\n/.exec(codigo)?.[0] ?? '';
    expect(lectura).toMatch(/if\s*\(\s*!NUNCA_SALEN\.has\(\s*clave\s*\)\s*\)\s*visible\[clave\]/);
    const guardado =
      /export async function guardarConfiguracionParcial\([\s\S]*?\n\}\n/.exec(codigo)?.[0] ?? '';
    expect(guardado).toMatch(/for\s*\(\s*const prohibido of NUNCA_SALEN\s*\)/);
  });

  it('la ruta del puente sirve la configuración con ese lector y con ningún otro', () => {
    const ruta = codigoDe('apps/web/app/api/datos/consultar/route.ts');
    const rama = /if\s*\(\s*entidad === 'ConfiguracionNegocio'\s*\)\s*\{([\s\S]*?)\n\s{4}\}/.exec(
      ruta,
    )?.[1];
    expect(rama).toBeDefined();
    expect(rama).toMatch(/leerConfiguracionMH\(\s*sesion\.organizacionId\s*\)/);
    expect(rama).not.toMatch(/obtenerDb|selectFrom|valores/);
    const indice = codigoDe('packages/app/src/puente/index.ts');
    expect(indice).toMatch(
      /export\s*\{[^}]*\bleerConfiguracion\s+as\s+leerConfiguracionMH\b[^}]*\}\s*from\s*'\.\/configuracion\.ts'/,
    );
  });
});

describe('quién escribe el documento de configuración', () => {
  it('todo escritor está clasificado, y ninguna clasificación sobra', () => {
    expect(tocan(ESCRIBE)).toEqual(Object.keys(ESCRITORES).sort());
  });

  for (const [ruta, forma] of Object.entries(ESCRITORES)) {
    if (forma !== 'candado') continue;
    it(`${ruta} · toma el documento con candado ANTES de escribirlo`, () => {
      const codigo = codigoDe(ruta);
      expect(codigo).toMatch(
        /import\s*\{[^}]*\bleerDocumentoConCandado\b[^}]*\}\s*from\s*'[^']*documento-con-candado\.ts'/,
      );
      const candado = codigo.search(/\bleerDocumentoConCandado\(/);
      expect(candado, 'no llama a leerDocumentoConCandado').toBeGreaterThanOrEqual(0);
      expect(candado).toBeLessThan(PRIMERA_ESCRITURA(codigo));
    });
  }

  it('el teléfono de cocina mezcla en UNA sentencia atómica, sin leer antes', () => {
    const codigo = codigoDe('packages/app/src/telefono-de-cocina/conectar.ts');
    expect(codigo).toMatch(
      /insert into configuracion[\s\S]*on conflict \(organizacion_id\) do update[\s\S]*set valores = configuracion\.valores\s*\|\|/,
    );
  });

  it('la lista de plataforma se escribe con `valores ||`, y quien la llama la leyó con candado', () => {
    const escritor = codigoDe('packages/app/src/mantenimiento/plataforma.ts');
    expect(escritor).toMatch(
      /set\(\{[\s\S]*valores:\s*sql`configuracion\.valores\s*\|\|\s*jsonb_build_object/,
    );
    for (const llamador of [
      'packages/app/src/mantenimiento/plataforma.ts',
      'packages/app/src/mantenimiento/plataforma-cambios.ts',
    ]) {
      const codigo = codigoDe(llamador);
      const llamadas = [...codigo.matchAll(/(?<!function )\bguardarEmpleosDePlataforma\(/g)];
      const candados = [...codigo.matchAll(/\bleerDocumentoConCandado\(/g)];
      expect(llamadas.length, `${llamador} no guarda la lista`).toBeGreaterThan(0);
      // Cada guardado tiene su propia lectura con candado, y la primera va antes que el primero.
      expect(candados.length, llamador).toBeGreaterThanOrEqual(llamadas.length);
      expect(candados[0]?.index ?? Infinity, llamador).toBeLessThan(llamadas[0]?.index ?? 0);
    }
  });

  it('el candado es un `select … for update` de la fila de la organización', () => {
    const codigo = codigoDe('packages/app/src/configuracion/documento-con-candado.ts');
    const donde = codigo.search(/\.where\(\s*'organizacion_id'/);
    const candado = codigo.search(/\.forUpdate\(\)/);
    expect(donde).toBeGreaterThanOrEqual(0);
    expect(candado).toBeGreaterThan(donde);
  });
});
