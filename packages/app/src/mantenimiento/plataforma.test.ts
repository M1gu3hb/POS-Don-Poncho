import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { empleosDePlataforma } from './plataforma.ts';

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

function rutas(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? rutas(join(dir, e.name)) : e.name === 'route.ts' ? [join(dir, e.name)] : [],
  );
}

describe('mantenimiento.marcar_plataforma no tiene ruta HTTP', () => {
  it('ningún route.ts lo sirve: un dueño que pudiera llamarlo se marcaría a sí mismo', () => {
    const api = join(process.cwd(), 'apps', 'web', 'app');
    const conMarca = rutas(api).filter((r) => readFileSync(r, 'utf8').includes('marcarPlataforma'));
    expect(rutas(api).length).toBeGreaterThan(50);
    expect(conMarca).toEqual([]);
  });
});
