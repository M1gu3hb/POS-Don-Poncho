import { describe, expect, it } from 'vitest';

import {
  GRUPOS_DE_AUDITORIA,
  accionesDelGrupo,
  esGrupoDeAuditoria,
  grupoDeLaAccion,
} from './grupos.ts';

describe('DP-15.1 · los grupos de acción de la auditoría', () => {
  it('son los siete que el dueño busca, con su nombre en palabras', () => {
    expect(Object.keys(GRUPOS_DE_AUDITORIA)).toEqual([
      'pin_y_usuarios',
      'agotado',
      'renombres',
      'descuentos',
      'cancelaciones',
      'efectivo',
      'configuracion',
    ]);
    for (const grupo of Object.values(GRUPOS_DE_AUDITORIA)) {
      expect(grupo.titulo.length).toBeGreaterThan(3);
      expect(grupo.acciones.length).toBeGreaterThan(0);
    }
  });

  it('ninguna acción cae en dos grupos (si no, un filtro enseñaría lo de otro)', () => {
    const todas = Object.values(GRUPOS_DE_AUDITORIA).flatMap((g) => g.acciones);
    expect(new Set(todas).size).toBe(todas.length);
  });

  it('dice las acciones de un grupo y a qué grupo pertenece una acción', () => {
    expect(accionesDelGrupo('pin_y_usuarios')).toEqual([
      'identidad.establecer_pin',
      'identidad.guardar_empleado',
    ]);
    expect(grupoDeLaAccion('catalogo.marcar_agotado')).toBe('agotado');
    expect(grupoDeLaAccion('caja.nombrar_terminal')).toBe('renombres');
    expect(grupoDeLaAccion('configuracion.permitir_descuentos')).toBe('descuentos');
    expect(grupoDeLaAccion('venta.cobrar')).toBeNull();
  });

  it('reconoce un grupo válido y rechaza cualquier otro texto', () => {
    expect(esGrupoDeAuditoria('efectivo')).toBe(true);
    expect(esGrupoDeAuditoria('todo')).toBe(false);
    expect(esGrupoDeAuditoria('constructor')).toBe(false);
  });
});
