import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * DP-12.6 · CONTRATO: QUIÉN PIDE LA LIMPIEZA DE SOLICITUDES Y CÓMO.
 *
 * El servidor decide si a un negocio le toca limpiar (una vez por hora), pero sólo para quien se
 * lo pide como `automatica`. Si la limpieza que la pantalla pide sola dejara de decirlo, volvería
 * a borrar y a auditar en cada visita a Mesas; si el botón «Limpiar antiguas» del dueño la dijera,
 * pulsarlo dentro de la hora no haría nada y la pantalla diría «borradas: 0».
 */

const WEB = join(__dirname, '..', '..');

function fuente(ruta: string): string {
  return readFileSync(join(WEB, ruta), 'utf8');
}

describe('la limpieza de solicitudes pedida por la pantalla', () => {
  it('la que se pide sola va como automática', () => {
    expect(fuente('heredado/lib/asignacionMesas.js')).toMatch(
      /ejecutar\('\/api\/restaurante\/limpiar-solicitudes', \{\s*automatica: true,?\s*\}\)/,
    );
  });

  it('el botón «Limpiar antiguas» del dueño NO la manda: limpia siempre', () => {
    const boton = fuente('heredado/components/portalqr/SolicitudesQRTab.jsx');
    expect(boton).toMatch(/ejecutar\('\/api\/restaurante\/limpiar-solicitudes', \{\}\)/);
    expect(boton).not.toMatch(/automatica/);
  });

  it('sólo el vigilante de solicitudes pide la automática', () => {
    const vigilante = fuente('heredado/components/common/SolicitudesQRWatcher.jsx');
    expect(vigilante).toMatch(/cleanupOldSolicitudes\(api, config\)/);
  });
});
