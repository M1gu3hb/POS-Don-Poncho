import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SECCIONES, TARJETAS } from '~/configuracion/secciones';

/**
 * DP-20 · LAS PANTALLAS DE IMPRESIÓN, COMO ESTÁN ESCRITAS (contrato estático).
 *
 * Se lee el código de verdad: la contraseña del proveedor no puede ir a ningún almacén ni a la
 * consola, tiene que salir del campo ANTES de enviarse, y Configuración tiene que montar las
 * tres piezas donde el encargo dice. Se valida por mutación: romper cada punto en el código real
 * pone la prueba en rojo.
 */

const AQUI = import.meta.dirname;
const WEB = join(AQUI, '..', '..', '..');
const CONFIGURACION =
  process.env['MORPHIQPOS_CONFIGURACION_SOURCE_PATH'] ??
  join(WEB, 'heredado', 'pages', 'Configuracion.jsx');
const ENTRADA =
  process.env['MORPHIQPOS_ENTRADA_SOURCE_PATH'] ?? join(AQUI, 'EntradaAlLaboratorio.tsx');
const MAXIMO_DE_LINEAS = 300;

function fuentes(): readonly string[] {
  return readdirSync(AQUI).filter(
    (nombre) => /\.(ts|tsx|jsx)$/.test(nombre) && !nombre.includes('.test.'),
  );
}

const leer = (ruta: string): string => readFileSync(ruta, 'utf8');
const compacto = (texto: string): string => texto.replace(/\s+/g, '');

/** El código sin comentarios: lo que se explica en un comentario no es lo que se ejecuta. */
const sinComentarios = (texto: string): string =>
  texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');

describe('el laboratorio y la contraseña del proveedor', () => {
  it('ningún archivo de las pantallas usa localStorage, sessionStorage, la consola ni cookies', () => {
    for (const nombre of fuentes()) {
      const codigo = sinComentarios(leer(join(AQUI, nombre)));
      expect(codigo, nombre).not.toMatch(/\b(localStorage|sessionStorage|indexedDB)\b/);
      expect(codigo, nombre).not.toMatch(/\bconsole\./);
      expect(codigo, nombre).not.toMatch(/document\.cookie/);
    }
  });

  it('el campo de la contraseña es de tipo password y la contraseña sale del campo ANTES de enviarse', () => {
    const codigo = leer(ENTRADA);
    expect(codigo).toContain('tipo="password"');
    const sale = codigo.indexOf("setClave('')");
    const envia = codigo.indexOf("invocarComando('/api/proveedor/entrar'");
    expect(sale).toBeGreaterThan(-1);
    expect(envia).toBeGreaterThan(-1);
    expect(sale).toBeLessThan(envia);
  });

  it('el aviso del laboratorio es el del encargo y no hay contraseñas escritas en el código', () => {
    const codigo = leer(join(AQUI, 'acceso-al-laboratorio.ts'));
    expect(codigo).toContain('Sólo tu proveedor MORPHIQ puede entrar aquí');
    for (const nombre of fuentes()) {
      expect(sinComentarios(leer(join(AQUI, nombre))), nombre).not.toMatch(
        /\b(contrase[nñ]a|password)\w*\s*[:=]\s*['"`][^'"`\s]{4,}|\bconst\s+clave\w*\s*=\s*['"`]/i,
      );
    }
  });
});

describe('Configuración monta las tres piezas', () => {
  const codigo = compacto(leer(CONFIGURACION));

  // DP-21 · Bloque 21: la Configuración se ordenó en secciones (`~/configuracion/secciones`).
  it('la impresora y el cajón están en «Este aparato», y las pinta la pantalla', () => {
    const tarjeta = TARJETAS.find((t) => t.id === 'impresora-y-cajon');
    expect(tarjeta?.seccion).toBe('este-aparato');
    expect(codigo).toContain("'impresora-y-cajon':()=><ImpresionDelAparatorol={posUser?.rol}/>");
  });

  it('las copias van en «Ticket y folios» y la entrada al laboratorio, discreta, casi al final', () => {
    expect(TARJETAS.find((t) => t.id === 'copias')?.seccion).toBe('ticket-y-folios');
    expect(codigo).toContain('copias:()=><CopiasDeImpresionpuedeCambiar={esDeMando(miPuesto)}/>');
    expect(codigo).toContain('laboratorio:()=><EntradaAlLaboratorio/>');
    const ids = SECCIONES.map((x) => x.id);
    expect(ids.indexOf('laboratorio')).toBeGreaterThan(ids.indexOf('este-aparato'));
    expect(ids.slice(-3)).toEqual(['laboratorio', 'mantenimiento', 'avanzado']);
  });

  it('se importan de ~/impresion/pantallas', () => {
    for (const pieza of ['ImpresionDelAparato', 'CopiasDeImpresion', 'EntradaAlLaboratorio']) {
      expect(codigo).toContain(`import{${pieza}}from'~/impresion/pantallas/${pieza}'`);
    }
  });
});

describe('la calidad del repositorio', () => {
  it(`ningún archivo pasa de ${String(MAXIMO_DE_LINEAS)} líneas`, () => {
    for (const nombre of fuentes()) {
      const lineas = leer(join(AQUI, nombre)).split('\n').length;
      expect(lineas, nombre).toBeLessThanOrEqual(MAXIMO_DE_LINEAS);
    }
  });

  it('sin any, sin @ts-ignore y sin catch vacío', () => {
    for (const nombre of fuentes()) {
      const codigo = leer(join(AQUI, nombre));
      expect(codigo, nombre).not.toMatch(/:\s*any\b|\bas any\b|<any>/);
      expect(codigo, nombre).not.toContain('@ts-ignore');
      expect(codigo, nombre).not.toMatch(/catch\s*(\([^)]*\))?\s*\{\s*\}/);
    }
  });
});
