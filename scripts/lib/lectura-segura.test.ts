import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { exigirConexionDirecta, leerEnSoloLectura } from './lectura-segura.mjs';

/** DP-15.1 (DP-D92) · Los guiones que leen una base real no tocan el pooler de la app. */

function clienteDePrueba(falla: string | null = null) {
  const enviadas: string[] = [];
  return {
    enviadas,
    query(texto: string): Promise<unknown> {
      enviadas.push(texto);
      if (falla !== null && texto.startsWith(falla)) return Promise.reject(new Error(falla));
      return Promise.resolve({ rows: [] });
    },
  };
}

describe('exigirConexionDirecta', () => {
  it('rechaza la cadena del pooler de transacción (6543)', () => {
    expect(() =>
      exigirConexionDirecta(
        'postgresql://app.ref:x@aws-0-us-east-2.pooler.supabase.com:6543/postgres',
      ),
    ).toThrow(/6543/);
  });

  it('acepta la de sesión (5432), la directa y la local', () => {
    expect(
      exigirConexionDirecta(
        'postgresql://postgres.ref:x@aws-0-us-east-2.pooler.supabase.com:5432/postgres',
      ).port,
    ).toBe('5432');
    expect(
      exigirConexionDirecta('postgresql://postgres:x@db.ref.supabase.co:5432/postgres').hostname,
    ).toBe('db.ref.supabase.co');
    expect(exigirConexionDirecta('postgres://u:p@localhost:5436/pruebas').port).toBe('5436');
  });

  it('una cadena que falta o no es URL no pasa', () => {
    expect(() => exigirConexionDirecta(undefined)).toThrow(/falta/);
    expect(() => exigirConexionDirecta('no es una url')).toThrow(/falta/);
  });
});

describe('leerEnSoloLectura', () => {
  it('abre read only, lee y cierra con rollback', async () => {
    const cliente = clienteDePrueba();
    const leido = await leerEnSoloLectura(cliente, async (c) => {
      await c.query('select 1');
      return 'ok';
    });
    expect(leido).toBe('ok');
    expect(cliente.enviadas).toEqual([
      'begin transaction isolation level repeatable read read only',
      'select 1',
      'rollback',
    ]);
  });

  it('si la lectura falla, igual cierra con rollback y el error sube', async () => {
    const cliente = clienteDePrueba('select');
    await expect(
      leerEnSoloLectura(cliente, async (c) => {
        await c.query('select roto');
      }),
    ).rejects.toThrow('select');
    expect(cliente.enviadas.at(-1)).toBe('rollback');
  });
});

describe('los guiones del repo que leen una base real', () => {
  const GUIONES = ['exportar-negocio.mjs', 'huella-ajena.mjs', 'importar-negocio.mjs'];

  it.each(GUIONES)('%s exige la conexión directa y no hace SET de sesión', (guion) => {
    const texto = readFileSync(new URL(`../${guion}`, import.meta.url), 'utf8');
    expect(texto).toContain('exigirConexionDirecta(');
    expect(texto).not.toMatch(/\bset\s+(?!local\b)(session\s+)?[a-z_]+\s*(=|to)\s/i);
  });

  it.each(['exportar-negocio.mjs', 'huella-ajena.mjs'])('%s lee con leerEnSoloLectura', (guion) => {
    const texto = readFileSync(new URL(`../${guion}`, import.meta.url), 'utf8');
    expect(texto).toContain('leerEnSoloLectura(');
  });
});
