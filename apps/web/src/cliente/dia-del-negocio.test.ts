import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { diaDelNegocioDe, diaDelNegocioDeUnValor, hoyDelNegocio } from './dia-del-negocio.ts';

/**
 * DP-22 · hallazgo 1 · DESPUÉS DE LAS 18:00 «HOY» ERA MAÑANA.
 *
 * Los instantes van escritos en UTC para que la prueba diga lo mismo en la laptop (hora de
 * México) y en la CI (UTC): lo que se prueba es la zona del negocio, no la de quien corre.
 */

describe('el día del negocio', () => {
  it('a las 18:30 de México sigue siendo hoy, aunque en UTC ya sea mañana', () => {
    // 16-11-2026 18:30 en México = 17-11-2026 00:30 UTC.
    const ahora = new Date('2026-11-17T00:30:00.000Z');
    expect(ahora.toISOString().slice(0, 10)).toBe('2026-11-17'); // lo que hacían las pantallas
    expect(hoyDelNegocio(ahora)).toBe('2026-11-16');
  });

  it('a las 23:59 de México sigue siendo hoy y a las 00:00 ya es mañana', () => {
    expect(hoyDelNegocio(new Date('2026-11-17T05:59:59.000Z'))).toBe('2026-11-16');
    expect(hoyDelNegocio(new Date('2026-11-17T06:00:00.000Z'))).toBe('2026-11-17');
  });

  it('a media mañana coincide con UTC', () => {
    expect(hoyDelNegocio(new Date('2026-11-16T16:00:00.000Z'))).toBe('2026-11-16');
  });

  it('cruza de mes y de año en la hora del negocio', () => {
    expect(hoyDelNegocio(new Date('2027-01-01T03:00:00.000Z'))).toBe('2026-12-31');
    expect(hoyDelNegocio(new Date('2027-03-01T05:59:00.000Z'))).toBe('2027-02-28');
  });

  it('con otra zona, el día de esa zona', () => {
    expect(diaDelNegocioDe(new Date('2026-11-17T00:30:00.000Z'), 'UTC')).toBe('2026-11-17');
    expect(diaDelNegocioDe(new Date('2026-11-17T00:30:00.000Z'), 'America/Tijuana')).toBe(
      '2026-11-16',
    );
  });

  it('una fecha que no existe no da un día', () => {
    expect(diaDelNegocioDe(new Date('no es una fecha'))).toBe('');
  });
});

describe('el día de un valor que viene del servidor', () => {
  it('un día suelto se queda como está', () => {
    expect(diaDelNegocioDeUnValor('2026-11-16')).toBe('2026-11-16');
  });

  it('un instante cae en el día del negocio en que pasó', () => {
    expect(diaDelNegocioDeUnValor('2026-11-17T01:30:00.000Z')).toBe('2026-11-16');
    expect(diaDelNegocioDeUnValor('2026-11-16T15:00:00+00:00')).toBe('2026-11-16');
  });

  it('lo que no se entiende no coincide con ningún día', () => {
    expect(diaDelNegocioDeUnValor(null)).toBe('');
    expect(diaDelNegocioDeUnValor('')).toBe('');
    expect(diaDelNegocioDeUnValor('ayer')).toBe('');
  });
});

/**
 * EL CONTRATO: ninguna pantalla vuelve a sacar «hoy» de `toISOString()`. Se mira el código sin
 * comentarios de `apps/web/heredado` y `apps/web/src` (las pruebas no cuentan). La única forma
 * permitida de cortar un `toISOString()` a diez letras es sobre un instante que ya es medianoche
 * UTC a propósito (aritmética de días), y esos sitios se declaran aquí con su razón.
 */
const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIA_EN_UTC =
  /toISOString\(\)\s*\.\s*(?:slice\(\s*0\s*,\s*10\s*\)|split\(\s*['"]T['"]\s*\)\s*\[\s*0\s*\]|substring\(\s*0\s*,\s*10\s*\)|substr\(\s*0\s*,\s*10\s*\))/u;
const PERMITIDOS: Readonly<Record<string, string>> = {
  'src/registros/periodo-de-registros.ts':
    'suma días a un día que ya viene como AAAA-MM-DD (medianoche UTC a propósito); no pregunta qué día es hoy',
};

const sinComentarios = (texto: string): string =>
  texto.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/gu, '$1');

function archivos(carpeta: string): string[] {
  const salida: string[] = [];
  for (const nombre of readdirSync(carpeta)) {
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) salida.push(...archivos(ruta));
    else if (/\.(?:jsx?|tsx?)$/u.test(nombre) && !/\.(?:test|spec)\./u.test(nombre))
      salida.push(ruta);
  }
  return salida;
}

describe('ninguna pantalla saca «hoy» de UTC', () => {
  it('el día de hoy se pide a `hoyDelNegocio`, no a `toISOString()`', () => {
    const culpables = [...archivos(join(WEB, 'heredado')), ...archivos(join(WEB, 'src'))]
      .map((ruta) => relative(WEB, ruta).replaceAll('\\', '/'))
      .filter((ruta) => !(ruta in PERMITIDOS))
      .filter((ruta) => DIA_EN_UTC.test(sinComentarios(readFileSync(join(WEB, ruta), 'utf8'))));
    expect(culpables).toEqual([]);
  });

  it('cada permitido sigue existiendo y sigue necesitando su permiso', () => {
    for (const ruta of Object.keys(PERMITIDOS)) {
      expect(DIA_EN_UTC.test(sinComentarios(readFileSync(join(WEB, ruta), 'utf8'))), ruta).toBe(
        true,
      );
    }
  });
});
