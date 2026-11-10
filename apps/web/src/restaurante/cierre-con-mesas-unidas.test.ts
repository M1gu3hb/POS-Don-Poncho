import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-16 (QA-J, H2) · EL CIERRE NO SE TRABA CON MESAS UNIDAS.
 *
 * Tras dividir y cobrar la cuenta de mesas unidas, quedan en «Limpieza» y unidas; el cierre las
 * lista y «Marcar libre» la principal pide decidir (`MESA_UNIDA_SIN_DECISION`). La pregunta salía
 * en un diálogo aparte, encima del diálogo del cierre, y el atrapafoco de éste la cerraba sola: la
 * cajera sólo veía el error. Ahora la decisión se toma AHÍ MISMO, en el renglón de la mesa.
 */

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const sinEspacios = (ruta: string) =>
  readFileSync(join(RAIZ_WEB, ruta), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+/g, '');

const DIALOGO = 'heredado/components/caja/MesasPendientesCierreDialog.jsx';

describe('el diálogo de mesas pendientes del cierre', () => {
  it('no abre otro diálogo encima: decide con la pregunta en línea', () => {
    const c = sinEspacios(DIALOGO);
    expect(c).not.toContain('liberarMesaConPregunta');
    expect(c).toContain('liberarConDecision(m.id,');
    expect(c).toContain('()=>newPromise((resolver)=>{decisionPendiente.current=resolver;setPorDecidir(m.id);})');
  });

  it('la pregunta se ve en el renglón de esa mesa, con las tres salidas', () => {
    const c = sinEspacios(DIALOGO);
    expect(c).toContain('{porDecidir===m.id&&(');
    expect(c).toContain("onClick={()=>decidir('separar')}");
    expect(c).toContain("onClick={()=>decidir('mantener')}");
    expect(c).toContain('onClick={()=>decidir(null)}');
  });
});
