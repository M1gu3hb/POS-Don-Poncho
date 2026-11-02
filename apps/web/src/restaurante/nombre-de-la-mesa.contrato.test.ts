import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * DP-12.6 · CONTRATO: NINGUNA PANTALLA REPITE EL NOMBRE DE LA MESA.
 *
 * «Mesa 2 · Mesa 2» salía de pegar a mano `mesa.nombre` detrás del número en nueve lugares. La
 * regla ahora vive en `nombre-de-la-mesa.ts`; este contrato lee las pantallas y exige que cada
 * una que escribe el nombre junto al número lo haga por el ayudante, y que ninguna vuelva a
 * pegarlo a mano.
 */

const WEB = join(__dirname, '..', '..');

const PANTALLAS = [
  'heredado/components/caja/MesasPendientesCierreDialog.jsx',
  'heredado/components/mesas/MesaEditDialog.jsx',
  'heredado/components/mesero/MesaGridMobile.jsx',
  'heredado/components/portalqr/AbrirMesaQRDialog.jsx',
  'heredado/components/portalqr/MesasQRTab.jsx',
  'heredado/components/portalqr/QRMesaDialog.jsx',
  'heredado/components/tickets/PreCuentaTicket.jsx',
  'heredado/pages/Configuracion.jsx',
  'heredado/pages/PortalCliente.jsx',
] as const;

function fuente(ruta: string): string {
  return readFileSync(join(WEB, ruta), 'utf8');
}

function archivosDe(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivosDe(ruta);
    return /\.(jsx|tsx)$/.test(nombre) ? [ruta] : [];
  });
}

/** «{mesa?.nombre ? ` · ${mesa.nombre}` : ''}», con la variable que sea (mesa, m…). */
const NOMBRE_PEGADO_A_MANO = /\b\w+\??\.nombre \? `\s*·\s*\$\{\w+\??\.nombre\}`/;

describe('el nombre de la mesa junto al número', () => {
  for (const ruta of PANTALLAS) {
    it(`${ruta} lo escribe con el ayudante`, () => {
      const texto = fuente(ruta);
      expect(texto).toMatch(/from '~\/restaurante\/nombre-de-la-mesa'/);
      expect(texto).toMatch(/sufijoDelNombreDeLaMesa\(|nombreDistintivoDeLaMesa\(/);
    });
  }

  it('el mosaico del mesero sólo pinta el nombre si agrega algo al número', () => {
    const mosaico = fuente('heredado/components/mesero/MesaGridMobile.jsx');
    expect(mosaico).toMatch(/\{nombreDistintivoDeLaMesa\(mesa\) && \(/);
    expect(mosaico).not.toMatch(/\{mesa\.nombre && \(/);
  });

  it('ninguna pantalla pega el nombre a mano detrás del número', () => {
    const culpables = [...archivosDe(join(WEB, 'heredado')), ...archivosDe(join(WEB, 'src'))]
      .filter((ruta) => NOMBRE_PEGADO_A_MANO.test(readFileSync(ruta, 'utf8')))
      .map((ruta) => relative(WEB, ruta));
    expect(culpables).toEqual([]);
  });
});
