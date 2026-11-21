import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * DP-21 · Bloque 1 · CONTRATO: «si el IVA está en cero, ni se menciona» (M9).
 *
 * Miguel puso el IVA en cero y los tickets seguían diciendo «IVA incluido». La regla es una
 * sola (`se-menciona-el-iva.ts`) y este contrato vigila que NADIE pinte el IVA por su cuenta:
 *
 *   · cada renglón «IVA» o «Impuestos» de una pantalla o de un papel va dentro de
 *     `seMencionaElIva(...)`; uno nuevo que no pregunte rompe esta prueba;
 *   · la columna «Impuestos» de una exportación pasa por `sinColumnaDeIvaEnCeros`;
 *   · `iva_porcentaje`, la clave que la pantalla guardaba y nadie leía, no vuelve a aparecer.
 *
 * Se afirma sobre el código de las pantallas (sin sus pruebas). Lo que NO ve: un texto «IVA»
 * armado a pedazos o traído del servidor; para eso está la e2e `pruebas/e2e/sin-iva.spec.ts`,
 * que cobra una cuenta sin IVA y lee los papeles.
 */

const WEB = fileURLToPath(new URL('../..', import.meta.url));
const CARPETAS = ['heredado', 'src', 'app'];

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (nombre === 'node_modules' || nombre === '.next') return [];
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.(ts|tsx|js|jsx)$/.test(nombre) && !/\.(test|spec)\./.test(nombre) ? [ruta] : [];
  });
}

/** El código sin comentarios de bloque ni de línea (los `{/* … *\/}` de JSX incluidos). */
function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
}

const pantallas = CARPETAS.flatMap((carpeta) => archivos(join(WEB, carpeta))).map((ruta) => ({
  ruta: relative(WEB, ruta).replaceAll('\\', '/'),
  codigo: sinComentarios(readFileSync(ruta, 'utf8')),
}));

/** Un rótulo de IVA a la vista: texto de JSX o una cadena que es sólo eso. */
const ROTULO = />\s*(IVA|Impuestos?)\s*<|['"`](IVA|IVA incluido|Impuestos?)['"`]/g;

/**
 * Los que nombran el IVA sin ser un renglón de una cuenta, y por qué.
 * Añadir uno aquí es una decisión: se escribe la razón.
 */
const NO_SON_RENGLONES: Readonly<Record<string, string>> = {
  'src/configuracion/IvaDelNegocio.tsx': 'es el ajuste: el título «IVA» de su tarjeta',
  'src/configuracion/secciones.ts': 'el mapa de la Configuración: el título «IVA» de su tarjeta',
  'heredado/lib/exportColumns.js':
    'define la columna; quien exporta la quita con `sinColumnaDeIvaEnCeros` (se afirma abajo)',
};

describe('ningún papel ni pantalla pinta el IVA por su cuenta', () => {
  const conRotulo = pantallas.filter(
    (p) => p.codigo.search(ROTULO) !== -1 && !(p.ruta in NO_SON_RENGLONES),
  );

  it('encuentra los renglones de IVA que hoy existen (si no, el contrato estaría ciego)', () => {
    expect(conRotulo.map((p) => p.ruta).sort()).toEqual([
      'heredado/components/tickets/PreCuentaTicket.jsx',
      'src/restaurante/Cobro.tsx',
      'src/restaurante/Precuenta.tsx',
      // DP-24 · El cobro de la Caja es la tarjeta de cobro: ahí vive su renglón de IVA.
      'src/venta/TarjetaDeCobro.tsx',
    ]);
  });

  it.each(conRotulo)('$ruta pregunta `seMencionaElIva` antes de cada renglón', ({ codigo }) => {
    expect(codigo).toMatch(/from '~\/venta\/se-menciona-el-iva'/);
    for (const hallazgo of codigo.matchAll(ROTULO)) {
      // La pregunta va justo antes del renglón: en las 400 letras anteriores, sin otro cierre
      // de bloque condicional en medio que la deje fuera.
      const antes = codigo.slice(Math.max(0, hallazgo.index - 400), hallazgo.index);
      expect(antes, `«${hallazgo[0]}» sin su pregunta`).toMatch(/seMencionaElIva\(/);
    }
  });

  it('las exclusiones siguen existiendo y siguen nombrando el IVA', () => {
    for (const ruta of Object.keys(NO_SON_RENGLONES)) {
      const pantalla = pantallas.find((p) => p.ruta === ruta);
      expect(pantalla, ruta).toBeDefined();
      expect(pantalla?.codigo.search(ROTULO), ruta).not.toBe(-1);
    }
  });
});

describe('las exportaciones', () => {
  it('quien exporta las ventas quita la columna del IVA cuando va en ceros', () => {
    const usanLaColumna = pantallas.filter(
      (p) => p.codigo.includes('COLUMNS_VENTAS') && p.ruta !== 'heredado/lib/exportColumns.js',
    );
    expect(usanLaColumna.map((p) => p.ruta)).toEqual(['heredado/pages/Registros.jsx']);
    for (const { codigo } of usanLaColumna) {
      const usos = [...codigo.matchAll(/COLUMNS_VENTAS/g)].length;
      const protegidos = [...codigo.matchAll(/sinColumnaDeIvaEnCeros\(\s*COLUMNS_VENTAS/g)].length;
      // Un uso es el `import`; todos los demás pasan por la regla.
      expect(protegidos).toBe(usos - 1);
      expect(protegidos).toBeGreaterThan(0);
    }
  });
});

describe('`iva_porcentaje` se retiró', () => {
  it('ninguna pantalla lo lee ni lo escribe', () => {
    const lo = pantallas.filter((p) => p.codigo.includes('iva_porcentaje')).map((p) => p.ruta);
    expect(lo).toEqual([]);
  });

  it('el campo «IVA» de la Configuración es la tarjeta nueva, con su comando', () => {
    const configuracion = pantallas.find((p) => p.ruta === 'heredado/pages/Configuracion.jsx');
    expect(configuracion?.codigo).toMatch(/<IvaDelNegocio puedeCambiar=\{esDeMando\(miPuesto\)\}/);
    const tarjeta = pantallas.find((p) => p.ruta === 'src/configuracion/IvaDelNegocio.tsx');
    expect(tarjeta?.codigo).toMatch(/invocarComando\('\/api\/configuracion\/fijar-impuesto'/);
    expect(tarjeta?.codigo).not.toMatch(/ConfiguracionNegocio\.update|actualizarPuente/);
  });
});
