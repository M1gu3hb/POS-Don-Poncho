import { describe, expect, it } from 'vitest';

import { exportarPerfil, importarPerfil, perfilPorOmision } from '../termico/perfil.ts';
import {
  nombreDelArchivo,
  problemaDelArchivo,
  TAMANO_MAXIMO_DEL_ARCHIVO,
} from './archivo-del-perfil.ts';

describe('DP-20 · el archivo del perfil', () => {
  it('el nombre del archivo no lleva acentos, espacios ni símbolos', () => {
    expect(nombreDelArchivo('Mostrador 80 mm')).toBe('perfil-mostrador-80-mm.json');
    expect(nombreDelArchivo('  Cocina / Barra ñandú  ')).toBe('perfil-cocina-barra-nandu.json');
    expect(nombreDelArchivo('???')).toBe('perfil-de-impresion.json');
  });

  it('un archivo que no es .json o es enorme no se lee', () => {
    expect(problemaDelArchivo({ name: 'perfil.txt', size: 10 })).toContain('.json');
    expect(
      problemaDelArchivo({ name: 'PERFIL.JSON', size: TAMANO_MAXIMO_DEL_ARCHIVO + 1 }),
    ).toContain('demasiado grande');
    expect(problemaDelArchivo({ name: 'perfil.json', size: 800 })).toBeNull();
  });

  it('exportar e importar devuelve el mismo perfil; un archivo ajeno dice su motivo', () => {
    const perfil = perfilPorOmision(58, { conexion: 'red', host: '10.0.0.2', puerto: 9100 });
    expect(importarPerfil(exportarPerfil(perfil))).toEqual({ ok: true, perfil });
    expect(importarPerfil('{"hola":1}')).toEqual({
      ok: false,
      motivo: 'Ese archivo no es un perfil de impresión.',
    });
    expect(importarPerfil('no es json')).toMatchObject({ ok: false });
  });
});
