import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { TARJETAS } from './secciones.ts';

/**
 * DP-15 · «DATOS» ES DEL DUEÑO Y DEL ADMINISTRADOR, NO DEL GERENTE (DP-21 · Bloque 21: sus tarjetas).
 *
 * `posUser.rol` junta dueño, administrador y gerente en «administrador» (el vocabulario de cuatro
 * roles del frontend heredado), así que algo condicionado a `posUser?.rol === 'administrador'` lo ve
 * también la gerente. Lo que decide quién manda de verdad se condiciona al puesto REAL
 * (`esDeMando(miPuesto)`), como hacían «Caja», «Descuentos» y «Datos». Con la Configuración
 * ordenada, esa regla vive en el mapa (`secciones.ts`, `visiblePara: 'mando'`) y este contrato la ata
 * a las tarjetas de antes. («Integraciones» ya no existe: se quitó en el Bloque 21.)
 */

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const FUENTE =
  process.env['MORPHIQPOS_CONFIGURACION_SOURCE_PATH'] ??
  join(RAIZ_WEB, 'heredado', 'pages', 'Configuracion.jsx');

/** El código sin comentarios de línea ni espacios: un cambio de formato no cuenta. */
function codigo(): string {
  return readFileSync(FUENTE, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+/g, '');
}

describe('DP-15 · lo de mando de la Configuración', () => {
  it.each([
    'exportar',
    'importar',
    'las-cajas',
    'pin-en-retiros',
    'candado-de-mando',
    'descuentos',
  ])('la tarjeta «%s» se ve sólo con un puesto de mando', (id) => {
    expect(TARJETAS.find((t) => t.id === id)?.visiblePara).toBe('mando');
  });

  it('el mapa decide por el puesto REAL (`esDeMando`/`puesto`), nunca por `rol === administrador` a secas', () => {
    const c = codigo();
    expect(c).toContain('puesto:miPuesto??null');
    expect(c).not.toContain("posUser?.rol==='administrador'&&(<");
  });

  it('el selector de apariencia sólo lo ve el dueño (el servidor sólo a él le deja guardar)', () => {
    expect(codigo()).toContain("miPuesto==='dueno'?(<SelectorDeApariencia/>):(");
  });
});
