import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  PUESTOS_DE_MANDO,
  PUESTOS_QUE_ELIMINAN_CORTES,
  esDeMando,
  puedeEliminarCortes,
} from '../../heredado/components/configuracion/puestos.js';

/**
 * DP-21 · Bloque 20 · LOS BOTONES QUE EL SERVIDOR NIEGA NO SE OFRECEN.
 *
 * «Eliminar corte» (Registros) y «Vaciar todas» (solicitudes QR) salían a quien el servidor
 * rechazaba: `posUser.rol` junta dueño, administrador y gerente en «administrador». Ahora sólo los
 * ve quien el comando deja, con el puesto REAL (`usePuesto`). Esta prueba ata la pantalla a la
 * matriz de permisos (la verdad del servidor) y lee el texto de las dos pantallas heredadas.
 */
const RAIZ = join(__dirname, '..', '..', '..', '..');
const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

interface RutaDeLaMatriz {
  readonly ruta: string;
  readonly roles: readonly string[];
}
const matriz = JSON.parse(leer('pruebas/e2e/matriz-de-permisos.json')) as {
  readonly incluidas: readonly RutaDeLaMatriz[];
};
const rolesDe = (ruta: string): readonly string[] => {
  const fila = matriz.incluidas.find((r) => r.ruta === ruta);
  if (fila === undefined) throw new Error(`La matriz no trae ${ruta}.`);
  return fila.roles;
};

describe('Eliminar corte', () => {
  it('lo ve exactamente quien el comando deja (la matriz de permisos)', () => {
    expect([...PUESTOS_QUE_ELIMINAN_CORTES].sort()).toEqual(
      [...rolesDe('/api/caja/eliminar-corte')].sort(),
    );
    for (const puesto of [
      'administrador',
      'gerente',
      'cajero',
      'mesero',
      'cocina',
      'almacen',
      null,
    ]) {
      expect(puedeEliminarCortes(puesto), String(puesto)).toBe(false);
    }
    expect(puedeEliminarCortes('dueno')).toBe(true);
  });

  it('Registros decide con el puesto real, no con el rol de cuatro', () => {
    const registros = leer('apps/web/heredado/pages/Registros.jsx');
    expect(registros).toContain('puedeEliminarCortes(miPuesto)');
    expect(registros).not.toMatch(/posUser\?\.rol === 'administrador'/);
    expect(registros).toMatch(/onDelete=\{puedeEliminar \? eliminarCorte : null\}/);
    expect(registros).toMatch(/if \(!puedeEliminar\) return;/);
  });
});

describe('«Vaciar todas» las solicitudes QR', () => {
  it('lo ve exactamente quien el comando deja (la matriz de permisos)', () => {
    expect([...PUESTOS_DE_MANDO].sort()).toEqual(
      [...rolesDe('/api/restaurante/vaciar-solicitudes')].sort(),
    );
    expect(esDeMando('gerente')).toBe(false);
    expect(esDeMando('dueno')).toBe(true);
    expect(esDeMando('administrador')).toBe(true);
  });

  it('la pestaña pinta el botón sólo con el puesto real de mando', () => {
    const pestana = leer('apps/web/heredado/components/portalqr/SolicitudesQRTab.jsx');
    expect(pestana).toMatch(/const puedeVaciar = esDeMando\(usePuesto\(\)\);/);
    expect(pestana).toMatch(/\{puedeVaciar && \(\s*<Button[\s\S]{0,260}onClick=\{vaciarDia\}/);
  });
});
