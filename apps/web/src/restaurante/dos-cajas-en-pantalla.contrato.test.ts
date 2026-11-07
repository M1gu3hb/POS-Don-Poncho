import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-14 · ronda 2, medio 3 · DOS CAJAS EN LA PANTALLA.
 *
 *   · Si cabe otra caja, este aparato ve «No hay caja abierta en este aparato · Abrir caja», no el
 *     aviso de la caja de otra terminal: con el cupo en 2, la segunda caja se ABRE, no se trae.
 *   · «Traer esta caja aquí» sólo aparece si ya no cabe otra, y pide confirmación: la otra terminal
 *     se queda sin caja.
 *   · En la tercera, «Abrir caja» dice en pantalla (no en un tooltip) «Ya hay 2 cajas abiertas:
 *     cierra una».
 *   · Si otra caja ya cobró la cuenta, el cobro se cierra y la lista se relee.
 * Son pantallas heredadas: el contrato lee su texto (se valida mutándolo).
 */

const HEREDADO = join(__dirname, '..', '..', 'heredado');
const leer = (ruta: string) => readFileSync(join(HEREDADO, ruta), 'utf8');

describe('la Caja con dos cajas', () => {
  const caja = () => leer('pages/Caja.jsx');

  it('si cabe otra caja, «No hay caja abierta en este aparato» y «Abrir caja»', () => {
    expect(caja()).toMatch(/\{!hayCaja && !cargandoCaja && puedoAbrir && \(/);
    expect(caja()).toMatch(/No hay caja abierta en este aparato/);
  });

  it('el aviso de la caja de otra terminal, sólo si ya no cabe otra', () => {
    expect(caja()).toMatch(
      /\{!hayCaja && !cargandoCaja && !puedoAbrir && cajaEnOtraTerminal && \(/,
    );
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

describe('traer la caja de otra terminal', () => {
  const aviso = () => leer('components/caja/CajaEnOtraTerminal.jsx');

  it('se llama «Traer esta caja aquí» y pide confirmar que la otra se queda sin caja', () => {
    const texto = aviso();
    expect(texto).toMatch(/Traer esta caja aquí/);
    expect(texto).toMatch(/se queda sin caja/);
    expect(texto).toMatch(/onClick=\{\(\) => setConfirmando\(true\)\}/);
    expect(texto).toMatch(/Sí, traerla/);
  });

  it('dice que ya no cabe otra caja', () => {
    expect(aviso()).toMatch(/cajas abiertas: cierra una para abrir otra aquí/);
  });
});
