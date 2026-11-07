import { describe, expect, it } from 'vitest';

import { filtrarMesasParaUsuario } from '../../heredado/lib/asignacionMesas.js';

/**
 * Una mesa sin mesero asignado la ven TODOS los meseros (DP-14, ronda 2).
 *
 * Al desactivar a un mesero el servidor suelta sus mesas. Con la asignación activa, el filtro sólo
 * dejaba pasar las asignadas a quien mira: una mesa sin asignar no la veía NADIE y quedaba
 * invisible hasta que alguien se acordara de ella.
 */

const MESAS = [
  { id: 'a', numero: 1, mesero_asignado_id: 'ana' },
  { id: 'b', numero: 2, mesero_asignado_id: 'beto' },
  { id: 'c', numero: 3, mesero_asignado_id: null },
  { id: 'd', numero: 4, mesero_asignado_id: '' },
];
const ANA = { id: 'ana', rol: 'mesero' };

describe('filtrarMesasParaUsuario', () => {
  it('con la asignación activa, el mesero ve las suyas y las que nadie tiene', () => {
    const vistas = filtrarMesasParaUsuario(MESAS, ANA, { asignacion_mesas_activa: true });
    expect(vistas.map((m: { id: string }) => m.id)).toEqual(['a', 'c', 'd']);
  });

  it('no ve las de otro mesero', () => {
    const vistas = filtrarMesasParaUsuario(MESAS, ANA, { asignacion_mesas_activa: true });
    expect(vistas.map((m: { id: string }) => m.id)).not.toContain('b');
  });

  it('un mesero sin ninguna asignada ve todas las sueltas', () => {
    const vistas = filtrarMesasParaUsuario(
      MESAS.map((m) => ({ ...m, mesero_asignado_id: null })),
      ANA,
      { asignacion_mesas_activa: true },
    );
    expect(vistas).toHaveLength(4);
  });

  it('con la asignación apagada ve todas, y la administración siempre ve todas', () => {
    expect(filtrarMesasParaUsuario(MESAS, ANA, { asignacion_mesas_activa: false })).toHaveLength(4);
    const admin = { id: 'x', rol: 'administrador' };
    expect(filtrarMesasParaUsuario(MESAS, admin, { asignacion_mesas_activa: true })).toHaveLength(
      4,
    );
  });
});
