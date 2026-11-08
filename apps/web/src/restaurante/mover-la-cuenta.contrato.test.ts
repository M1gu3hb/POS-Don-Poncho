import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-15 · CAMBIAR DE MESA, UNIR Y DIVIDIR SE ALCANZAN DESDE EL MAPA (M6 de la auditoría 1).
 *
 * Esas acciones viven en «Mesa activa» (`/restaurante/mesa-activa`), y al gerente y al dueño sólo se
 * llegaba tecleando la dirección: su menú abre `/mesero`, sin esos botones. El panel de la mesa del
 * mapa tiene ahora el enlace, sólo para quien la ruta deja pasar (al mesero y a la cajera los regresa).
 */

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');

describe('DP-15 · mover la cuenta desde el mapa', () => {
  it('el panel de la mesa enlaza a «Mesa activa» para dueño, administrador y gerente', () => {
    const c = readFileSync(join(RAIZ_WEB, 'heredado', 'pages', 'Mesero.jsx'), 'utf8')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\s+/g, '');
    expect(c).toContain("constPUEDEN_MOVER_LA_CUENTA=['dueno','administrador','gerente'];");
    expect(c).toContain(
      '{ventaActiva&&mesaActiva?.id&&PUEDEN_MOVER_LA_CUENTA.includes(miPuesto)&&(<Linkto={`/restaurante/mesa-activa?mesa=${mesaActiva.id}`}',
    );
  });
});
