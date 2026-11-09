import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-15 · «DATOS» E «INTEGRACIONES» SON DEL DUEÑO Y DEL ADMINISTRADOR, NO DEL GERENTE.
 *
 * `posUser.rol` junta dueño, administrador y gerente en «administrador» (el vocabulario de cuatro
 * roles del frontend heredado), así que una pestaña condicionada a `posUser?.rol === 'administrador'`
 * la ve también la gerente. Las que deciden quién manda de verdad se condicionan al puesto REAL
 * (`esDeMando(miPuesto)`), como ya hacían «Caja» y «Descuentos» (DP-14). Este contrato ata las dos
 * pestañas y su contenido a esa regla. El servidor, aparte, no le deja leer la bitácora de
 * integraciones (`autorizacion.test.ts`).
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

describe('DP-15 · las pestañas de mando de Configuración', () => {
  it.each(['datos', 'integraciones'])(
    'la pestaña «%s» y su contenido se ven sólo con un puesto de mando',
    (pestana) => {
      const c = codigo();
      expect(c).toContain(`{esDeMando(miPuesto)&&(<TabsTriggervalue="${pestana}">`);
      expect(c).toContain(`{esDeMando(miPuesto)&&(<TabsContentvalue="${pestana}">`);
      for (const etiqueta of ['TabsTrigger', 'TabsContent']) {
        expect(c).not.toContain(`'administrador'&&(<${etiqueta}value="${pestana}">`);
      }
    },
  );

  it('el selector de apariencia sólo lo ve el dueño (el servidor sólo a él le deja guardar)', () => {
    expect(codigo()).toContain("{miPuesto==='dueno'?(<SelectorDeApariencia/>):(");
  });
});
