import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-12.4 · LAS PANTALLAS HEREDADAS DICEN LO QUE DICE EL SERVIDOR.
 *
 * El corte heredado de la Caja armaba su sección de cancelaciones en el navegador desde las
 * ventas y ponía como «Usuario» a quien cobraba o atendía, no a quien canceló; y los platillos
 * anulados no aparecían. Estas pantallas son JavaScript heredado que un test de componentes no
 * alcanza, así que el contrato lee su texto: que pidan las cancelaciones al servidor, que las
 * pinten con el MISMO código que arma el corte de Cierre diario, que la pantalla del mesero monte
 * sus botones y que Registros tenga su pestaña. Se valida mutando el código real (el banco de
 * mutaciones de DP-12.4 restaura cada pieza vieja y exige que esto se ponga rojo).
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');

const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

const VISOR = 'heredado/components/cortes/CorteViewerDialog.jsx';
const DESCARGA = 'heredado/components/cortes/CorteAutoDownloader.jsx';
const TICKET = 'heredado/components/tickets/CorteTicket.jsx';
const MESERO = 'heredado/pages/Mesero.jsx';
const REGISTROS = 'heredado/pages/Registros.jsx';

describe('el corte heredado lee las cancelaciones del servidor', () => {
  it.each([VISOR, DESCARGA])('%s las pide con la caja del corte', (archivo) => {
    expect(leer(archivo)).toMatch(/cancelacionesDeLaCaja\(\s*corteId\s*\)/);
  });

  it.each([VISOR, DESCARGA])('%s ya no las arma desde las ventas', (archivo) => {
    const texto = leer(archivo);
    // Las armaba filtrando `Venta.list` por `estado === 'cancelada'`.
    expect(texto).not.toMatch(/estado\s*[!=]==?\s*'cancelada'/);
  });

  it('el ticket las pinta con el código del corte del servidor, no con su tabla propia', () => {
    const texto = leer(TICKET);
    expect(texto).toMatch(
      /seccionesDeCancelaciones\(\s*cancelaciones\s*,\s*alcanceDeCancelaciones/,
    );
    expect(texto).toMatch(/<SeccionPintada\b/);
  });

  it('el ticket NO vuelve a poner como «Usuario» al cajero o al mesero de la venta', () => {
    const texto = leer(TICKET);
    expect(texto).not.toMatch(/c\.usuario_cajero_nombre/);
    expect(texto).not.toMatch(/usuario_mesero_nombre/);
    expect(texto).not.toMatch(/motivo_cancelacion/);
  });
});

describe('la pantalla del mesero y Registros', () => {
  it('el diálogo de la mesa monta los botones de cancelar', () => {
    const texto = leer(MESERO);
    expect(texto).toMatch(
      /import \{ CancelarDelMesero \} from '~\/restaurante\/CancelarDelMesero'/,
    );
    expect(texto).toMatch(/<CancelarDelMesero\b/);
  });

  it('Registros tiene su pestaña de cancelaciones con la lectura del servidor', () => {
    const texto = leer(REGISTROS);
    expect(texto).toMatch(/<TabsTrigger value="cancelaciones"/);
    expect(texto).toMatch(/<TabsContent value="cancelaciones"/);
    expect(texto).toMatch(/<CancelacionesRegistradas\b/);
  });

  it('los botones del mesero se esconden a quien el servidor no deja (falla cerrado)', () => {
    const texto = leer('src/restaurante/CancelarDelMesero.tsx');
    expect(texto).toMatch(/puedeCancelarPedidos\(rol\)/);
    expect(texto).toMatch(/if \(!puede\b.*\) return null/);
  });
});

describe('la hoja marca la pérdida con algo más que el color', () => {
  it('la sección de pérdida lleva su marca y el rojo del sistema', () => {
    const texto = leer('src/corte/HojaDelCorte.tsx');
    expect(texto).toMatch(/data-tono=\{esPerdida \? 'perdida' : undefined\}/);
    expect(texto).toMatch(/border-peligro/);
    expect(texto).toMatch(/text-peligro/);
  });
});
