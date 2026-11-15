import { describe, expect, it } from 'vitest';

import {
  comoActualizacion,
  fraseDelModoLigero,
  opcionDelModoLigero,
  OPCIONES_DEL_MODO_LIGERO,
  textoDeLaActualizacion,
  valorDelModoLigero,
} from './ajustes-de-la-app.ts';

describe('DP-20 · los ajustes de este aparato', () => {
  it('el modo ligero guarda null, true o false y vuelve a su opción', () => {
    expect(OPCIONES_DEL_MODO_LIGERO.map((o) => o.nombre)).toEqual([
      'Automático',
      'Encendido',
      'Apagado',
    ]);
    for (const opcion of ['automatico', 'encendido', 'apagado'] as const) {
      expect(opcionDelModoLigero(valorDelModoLigero(opcion))).toBe(opcion);
    }
    expect(valorDelModoLigero('automatico')).toBeNull();
    expect(valorDelModoLigero('encendido')).toBe(true);
    expect(valorDelModoLigero('apagado')).toBe(false);
    expect(opcionDelModoLigero(undefined)).toBe('automatico');
  });

  it('dice el estado del modo ligero con su motivo', () => {
    expect(
      fraseDelModoLigero({
        activo: true,
        origen: 'auto',
        motivo: 'este aparato tiene poca memoria',
      }),
    ).toBe('Ahora está encendido (automático): este aparato tiene poca memoria');
    expect(fraseDelModoLigero({ activo: false, origen: 'manual', motivo: '' })).toBe(
      'Ahora está apagado (a mano).',
    );
  });

  it('cada estado de la actualización se dice, y sólo disponible y lista se instalan', () => {
    const v = { versionActual: '1.0.0', versionNueva: '1.1.0' };
    expect(textoDeLaActualizacion({ ...v, estado: 'al-dia' })).toMatchObject({
      titulo: 'Tienes la última versión',
      instalable: false,
    });
    expect(textoDeLaActualizacion({ ...v, estado: 'disponible' })).toMatchObject({
      titulo: 'Hay una versión nueva: 1.1.0',
      instalable: true,
    });
    expect(textoDeLaActualizacion({ ...v, estado: 'lista' }).instalable).toBe(true);
    expect(textoDeLaActualizacion({ ...v, estado: 'descargando', avance: 0.426 })).toMatchObject({
      avance: 43,
      instalable: false,
    });
  });

  it('el avance se mantiene entre 0 y 100', () => {
    const v = { versionActual: '1.0.0', estado: 'descargando' as const };
    expect(textoDeLaActualizacion({ ...v, avance: 7 }).avance).toBe(100);
    expect(textoDeLaActualizacion({ ...v, avance: -1 }).avance).toBe(0);
  });

  it('un error de actualización es un fallo con su detalle', () => {
    const texto = textoDeLaActualizacion({
      estado: 'error',
      versionActual: '1.0.0',
      mensaje: 'Sin internet',
    });
    expect(texto).toMatchObject({ fallo: true, detalle: 'Sin internet', instalable: false });
    expect(textoDeLaActualizacion({ estado: 'error', versionActual: '1.0.0' }).detalle).toContain(
      'conexión',
    );
  });

  it('el evento de la app sólo se acepta con la forma correcta', () => {
    expect(comoActualizacion({ estado: 'lista', versionActual: '1.0.0' })).not.toBeNull();
    expect(comoActualizacion({ estado: 'rara', versionActual: '1.0.0' })).toBeNull();
    expect(comoActualizacion({ estado: 'lista' })).toBeNull();
    expect(comoActualizacion('lista')).toBeNull();
    expect(comoActualizacion(null)).toBeNull();
  });
});
