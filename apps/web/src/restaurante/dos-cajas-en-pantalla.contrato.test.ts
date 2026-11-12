import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-14 · ronda 2, medio 3 · DOS CAJAS EN LA PANTALLA (revisado en DP-18, DP-D111).
 *
 *   · DP-18: las cajas abiertas en otros aparatos se ven SIEMPRE («Trasladar aquí», con confirmación:
 *     el otro aparato se queda sin caja) y, si cabe, «Abrir otra caja aquí (N de M)». Antes (DP-D74),
 *     si cabía otra, la de la tableta se callaba y parecía cerrada (Miguel, 11-11).
 *   · En la tercera, «Abrir caja» dice en pantalla (no en un tooltip) «Ya hay 2 cajas abiertas:
 *     cierra una».
 *   · Si otra caja ya cobró la cuenta, el cobro se cierra y la lista se relee.
 * Son pantallas heredadas: el contrato lee su texto (se valida mutándolo).
 */

const HEREDADO = join(__dirname, '..', '..', 'heredado');
const leer = (ruta: string) => readFileSync(join(HEREDADO, ruta), 'utf8');

describe('la Caja con dos cajas', () => {
  const caja = () => leer('pages/Caja.jsx');

  it('sin caja aquí ni en otro aparato, «No hay caja abierta en este aparato» y «Abrir caja»', () => {
    expect(caja()).toContain('{!hayCaja && !cargandoCaja && otrasCajas.length === 0 && (');
    expect(caja()).toMatch(/No hay caja abierta en este aparato/);
  });

  it('DP-18 · las cajas de otros aparatos se enseñan SIEMPRE, quepa otra o no, con caja aquí o sin ella', () => {
    expect(caja()).toMatch(/\{!cargandoCaja && \(\s*<CajasEnOtrosAparatos\s+cajas=\{otrasCajas\}/);
    expect(caja()).not.toMatch(/!puedoAbrir && cajaEnOtraTerminal/);
  });

  it('en la tercera, «Abrir caja» lo dice en pantalla', () => {
    expect(caja()).toMatch(
      /if \(!puedoAbrir\) \{\s*toast\.error\(`Ya hay \$\{cupoDeCajas \?\? 2\} cajas abiertas: cierra una\.`\);/,
    );
    expect(caja()).not.toMatch(/disabled=\{hayCaja \|\| cargandoCaja \|\| !puedoAbrir\}/);
    // Y su tooltip no dice «Ya hay una caja abierta» cuando lo que pasa es que se llenó el cupo.
    expect(caja()).not.toMatch(/hayCaja \|\| !puedoAbrir \? 'Ya hay una caja abierta'/);
    expect(caja()).toMatch(
      /: !puedoAbrir\s*\? `Ya hay \$\{cupoDeCajas \?\? 2\} cajas abiertas: cierra una\.`/,
    );
  });

  it('si otra caja ya la cobró, el cobro se cierra y la lista se relee', () => {
    expect(caja()).toMatch(
      /if \(err\?\.datos\?\.regla === 'ORDEN_NO_EDITABLE'\) \{\s*setVentaSeleccionada\(null\);\s*setDetallesSeleccionados\(\[\]\);\s*queryClient\.invalidateQueries\(\{ queryKey: \['ventas_pendientes_caja'\] \}\);/,
    );
  });
});

describe('trasladar la caja de otro aparato (DP-18)', () => {
  const aviso = () => leer('components/caja/CajasEnOtrosAparatos.jsx');

  it('se llama «Trasladar aquí» y pide confirmar que el otro aparato se queda sin caja', () => {
    const texto = aviso();
    expect(texto).toMatch(/Trasladar aquí/);
    expect(texto).toMatch(/se queda sin caja/);
    expect(texto).toContain('onClick={() => setConfirmando(caja.sesionCajaId)}');
    expect(texto).toMatch(/Sí, trasladarla/);
  });

  it('con caja aquí, las otras se enlistan sin botones; sin caja, se ofrece abrir otra si cabe', () => {
    const texto = aviso();
    expect(texto).toContain('!hayCaja && caja.puedoTraerla && confirmando !== caja.sesionCajaId');
    expect(texto).toContain('!hayCaja && puedoAbrir && (');
    expect(texto).toMatch(/Abrir otra caja aquí/);
  });
});
