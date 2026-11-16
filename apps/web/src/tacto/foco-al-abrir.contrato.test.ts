import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-21 · Bloque 9 · M16 y O7 · NINGÚN DIÁLOGO ENFOCA UN CAMPO DE TEXTO AL ABRIR, EN UN APARATO TÁCTIL.
 *
 * Dos cosas, las dos leídas del código (son pantallas heredadas y primitivas que un test de componentes
 * no alcanza) y validadas mutando el código real:
 *
 *  1 · Las ventanas del sistema (`Dialog`, `Sheet`, y las de `heredado`) mandan el foco al contenedor
 *      con dedo (`focoAlAbrir`), respetando el `onOpenAutoFocus` de quien llama. Las alertas
 *      (`AlertDialog`) no: Radix ya enfoca su botón «Cancelar», que no abre teclado.
 *  2 · Cada `autoFocus` que quede en el código o es `puedeEnfocarAlAbrir()` (con ratón enfoca, con
 *      dedo no) o está DECLARADO aquí con su razón. Un `autoFocus` nuevo sin declarar rompe esta
 *      prueba: es justo el que sacaría el teclado solo.
 */

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const RAIZ_UI = join(RAIZ_WEB, '..', '..', 'packages', 'ui', 'src');
const leer = (ruta: string): string => readFileSync(join(RAIZ_WEB, ruta), 'utf8');
/** La ruta de un archivo desde `apps/web`, con barras normales. */
const delRaiz = (archivo: string): string => relative(RAIZ_WEB, archivo).split(sep).join('/');

describe('las ventanas del sistema mandan el foco al contenedor con dedo', () => {
  it.each([
    join(RAIZ_UI, 'primitivas', 'dialog.tsx'),
    join(RAIZ_UI, 'primitivas', 'sheet.tsx'),
    join(RAIZ_WEB, 'heredado', 'components', 'ui', 'dialog.jsx'),
    join(RAIZ_WEB, 'heredado', 'components', 'ui', 'sheet.jsx'),
  ])('%s usa focoAlAbrir y respeta el onOpenAutoFocus de quien llama', (archivo) => {
    const codigo = readFileSync(archivo, 'utf8');
    expect(codigo).toMatch(/onOpenAutoFocus=\{focoAlAbrir\(onOpenAutoFocus\)\}/);
    // El manejador del que llama se desestructura: no se cuela dos veces por `{...props}`.
    expect(codigo).toMatch(
      /\n\s*onOpenAutoFocus,\s*\n|onOpenAutoFocus, \.\.\.props|onOpenAutoFocus,\s*\.\.\.props/,
    );
  });

  it('las ventanas heredadas llevan el `data-slot` por el que `teclado-en-pantalla.css` las encuentra', () => {
    expect(leer('heredado/components/ui/dialog.jsx')).toMatch(/data-slot="dialog-content"/);
    expect(leer('heredado/components/ui/sheet.jsx')).toMatch(/data-slot="sheet-content"/);
    expect(leer('heredado/components/ui/alert-dialog.jsx')).toMatch(
      /data-slot="alert-dialog-content"/,
    );
  });
});

/** Todo lo que se pinta: los `.ts/.tsx/.js/.jsx` de `src`, `heredado` y `packages/ui/src`, sin pruebas. */
function archivosDeCodigo(carpeta: string): string[] {
  return readdirSync(carpeta).flatMap((nombre) => {
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) {
      return nombre === 'node_modules' || nombre === '.next' ? [] : archivosDeCodigo(ruta);
    }
    return /\.(tsx?|jsx?)$/.test(nombre) && !/\.test\.tsx?$/.test(nombre) ? [ruta] : [];
  });
}

/**
 * LOS `autoFocus` QUE SE QUEDAN, cada uno con su razón. La clave es el archivo (desde `apps/web`, o
 * `packages/ui/src` desde la raíz del paquete) y `cuantos` los que lleva.
 */
const DECLARADOS: readonly {
  readonly archivo: string;
  readonly cuantos: number;
  readonly razon: string;
}[] = [
  {
    archivo: 'src/restaurante/AccesoPorPin.tsx',
    cuantos: 1,
    razon:
      'Es la TARJETA del empleado (un botón) a la que vuelve el foco desde el teclado del PIN: no es un campo de texto.',
  },
  {
    archivo: 'heredado/pages/POSLogin.jsx',
    cuantos: 1,
    razon:
      'El campo oculto del PIN de acceso: el PIN tiene su teclado propio en pantalla y es lo único que se teclea ahí.',
  },
  {
    archivo: 'heredado/components/productos/CategoriaSelect.jsx',
    cuantos: 1,
    razon:
      'Responde a un toque de quien ya pidió «Nueva categoría» en esa misma pantalla: no es un diálogo que se abre solo, y la persona viene a teclear el nombre.',
  },
];

const ENFOCADOS_POR_PUNTERO = /autoFocus=\{[^}]*puedeEnfocarAlAbrir\(\)[^}]*\}/g;

function autoFocusDe(archivo: string): { total: number; porPuntero: number } {
  const codigo = readFileSync(archivo, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const sinComentarios = codigo
    .split('\n')
    .filter((linea) => !/^\s*(\/\/|\*|\{\/\*)/.test(linea))
    .join('\n');
  return {
    total: (sinComentarios.match(/\bautoFocus\b/g) ?? []).length,
    porPuntero: (sinComentarios.match(ENFOCADOS_POR_PUNTERO) ?? []).length,
  };
}

describe('los autoFocus que quedan', () => {
  const hallados = [
    ...archivosDeCodigo(join(RAIZ_WEB, 'src')),
    ...archivosDeCodigo(join(RAIZ_WEB, 'heredado')),
    ...archivosDeCodigo(RAIZ_UI),
  ]
    .map((archivo) => ({ archivo, ...autoFocusDe(archivo) }))
    .filter((f) => f.total > 0);

  it('encuentra los que se conocen (la búsqueda no está ciega)', () => {
    expect(hallados.length).toBeGreaterThanOrEqual(DECLARADOS.length);
  });

  it('cada uno es `puedeEnfocarAlAbrir()` o está declarado con su razón, y ninguno más', () => {
    const sinDeclarar: string[] = [];
    for (const { archivo, total, porPuntero } of hallados) {
      const suyos = delRaiz(archivo);
      const declarado = DECLARADOS.find((d) => d.archivo === suyos);
      const quedan = total - porPuntero;
      if (quedan > (declarado?.cuantos ?? 0)) {
        sinDeclarar.push(`${suyos}: ${String(quedan)} autoFocus sin declarar`);
      }
    }
    expect(
      sinDeclarar,
      `autoFocus sin declarar (sacarían el teclado solo): ${sinDeclarar.join('; ')}`,
    ).toEqual([]);
  });

  it('lo declarado existe (no queda una excepción de un archivo que ya no la necesita)', () => {
    for (const d of DECLARADOS) {
      const encontrado = hallados.find((f) => delRaiz(f.archivo) === d.archivo);
      expect(encontrado?.total ?? 0, `«${d.archivo}»: ${d.razon}`).toBe(d.cuantos);
      expect(d.razon.length).toBeGreaterThan(30);
    }
  });
});
