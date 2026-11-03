import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { empleosDePlataforma } from './plataforma.ts';
import { quitarPlataforma } from './plataforma-cambios.ts';

/** DP-12.1 · La marca del usuario de plataforma, y que nadie la pueda llamar por HTTP. */

const UNO = '0b0e8c35-4c35-4b6e-9b46-6a9a3e5d7c11';
const OTRO = '6f4a3d21-9e0c-4f7b-8a55-2d1c0b9e8f77';

describe('empleosDePlataforma', () => {
  it('lee la lista de la marca', () => {
    expect(empleosDePlataforma({ plataforma: { empleos: [UNO, OTRO] } })).toEqual([UNO, OTRO]);
  });

  it('cualquier otra forma es ninguno: nunca se adivina a favor de borrar', () => {
    for (const valores of [
      null,
      undefined,
      'plataforma',
      [],
      {},
      { plataforma: null },
      { plataforma: [UNO] },
      { plataforma: { empleos: UNO } },
      { plataforma: { empleos: ['no-es-uuid'] } },
      { plataforma: { empleos: [UNO, 7] } },
    ]) {
      expect(empleosDePlataforma(valores)).toEqual([]);
    }
  });
});

function archivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name === 'node_modules' || e.name === '.next') return [];
    if (e.isDirectory()) return archivos(join(dir, e.name));
    return /\.(ts|tsx|js|jsx)$/.test(e.name) && !e.name.includes('.test.')
      ? [join(dir, e.name)]
      : [];
  });
}

/**
 * Los comandos que sólo corre un guion: ni por su identificador ni por su nombre de comando puede
 * aparecer en ningún archivo de la aplicación web (rutas, pantallas, servidor).
 */
const SOLO_POR_GUION = [
  'marcarPlataforma',
  'quitarPlataforma',
  'mantenimiento.marcar_plataforma',
  'mantenimiento.quitar_plataforma',
];

describe('marcar y quitar la marca de plataforma no tienen ruta HTTP', () => {
  const web = join(process.cwd(), 'apps', 'web');

  it('ningún archivo de la aplicación web los sirve: un dueño que pudiera llamarlos se marcaría', () => {
    const rutas = archivos(join(web, 'app'));
    const todos = [...rutas, ...archivos(join(web, 'src'))];
    expect(rutas.filter((r) => r.endsWith('route.ts')).length).toBeGreaterThan(50);
    const conMarca = todos.filter((archivo) => {
      const codigo = readFileSync(archivo, 'utf8');
      return SOLO_POR_GUION.some((nombre) => codigo.includes(nombre));
    });
    expect(conMarca).toEqual([]);
  });

  it('y por eso ninguna de las dos está en la matriz de permisos ni en las rutas de aislamiento', () => {
    // Las dos se GENERAN de los `route.ts`: si aparecieran, alguien les habría puesto ruta.
    for (const generado of ['matriz-de-permisos.json', 'aislamiento.json']) {
      const texto = readFileSync(join(process.cwd(), 'pruebas', 'e2e', generado), 'utf8');
      for (const nombre of SOLO_POR_GUION)
        expect(texto, `${generado} · ${nombre}`).not.toContain(nombre);
    }
  });
});

describe('scripts/marcar-plataforma.mjs', () => {
  const codigo = readFileSync(join(process.cwd(), 'scripts', 'marcar-plataforma.mjs'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('ejecuta con la clave que lleva la lista resultante y la versión del documento', () => {
    expect(codigo).toMatch(/idempotencyKey:\s*claveDePlataforma\(\s*plan\s*\)/);
    // La clave de antes (sólo negocio y empleo) devolvía la respuesta de la primera vez.
    expect(codigo).not.toMatch(/marcar-plataforma:\$\{/);
    const plan = /const plan = \{([\s\S]*?)\n {2}\};/.exec(codigo)?.[1] ?? '';
    expect(plan).toMatch(/\bantes\b/);
    expect(plan).toMatch(/\bversion\b/);
  });

  it('lee la versión del documento ANTES de ejecutar', () => {
    const lectura = codigo.search(/\.select\(\[\s*'valores',\s*'version'\s*\]\)/);
    const ejecucion = codigo.search(/await comando\(/);
    expect(lectura).toBeGreaterThanOrEqual(0);
    expect(ejecucion).toBeGreaterThan(lectura);
  });
});

describe('mantenimiento.quitar_plataforma', () => {
  it('sólo la ejecuta un dueño, y no acepta ámbito en el cuerpo', () => {
    expect(quitarPlataforma.roles).toEqual(['dueno']);
    expect(quitarPlataforma.escribe).toBe(true);
    const conAtaque = quitarPlataforma.entrada.safeParse({
      empleado: UNO,
      rol: 'dueno',
      empleoId: OTRO,
    });
    // El envoltorio valida en estricto; aquí se afirma lo que el esquema deja pasar.
    expect(Object.keys(conAtaque.success ? conAtaque.data : {})).not.toEqual(
      expect.arrayContaining(['rol']),
    );
    expect(Object.keys(conAtaque.success ? conAtaque.data : {})).not.toContain('empleoId');
  });

  it('el reemplazo no puede ser el mismo empleo', () => {
    const mismo = quitarPlataforma.entrada.safeParse({ empleado: UNO, reemplazarPor: UNO });
    expect(mismo.success).toBe(false);
    expect(quitarPlataforma.entrada.safeParse({ empleado: UNO, reemplazarPor: OTRO }).success).toBe(
      true,
    );
  });

  it('exige ser de plataforma ANTES de leer, validar el reemplazo o escribir nada', () => {
    const fuente = readFileSync(join(import.meta.dirname, 'plataforma-cambios.ts'), 'utf8');
    const cuerpo = (
      /async ejecutar\(ctx, entrada\) \{([\s\S]*?)\n {2}\},\n\}\);/.exec(fuente)?.[1] ?? ''
    ).replace(/^\s*\/\/.*$/gm, '');
    expect(cuerpo.length).toBeGreaterThan(200); // se recortó el cuerpo de verdad
    const orden = [
      'exigirPlataforma(',
      'exigirDuenoActivo(',
      'leerDocumentoConCandado(',
      'guardarEmpleosDePlataforma(',
    ].map((llamada) => cuerpo.indexOf(llamada));
    expect(orden.every((posicion) => posicion >= 0)).toBe(true);
    expect([...orden].sort((a, b) => a - b)).toEqual(orden);
  });
});
