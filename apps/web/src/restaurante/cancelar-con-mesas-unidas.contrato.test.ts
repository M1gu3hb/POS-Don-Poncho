import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DEJARLAS_UNIDAS,
  EXPLICACION_DEL_GRUPO,
  PREGUNTA_DEL_GRUPO,
  SEPARAR_MESAS,
} from './unir-mesas/liberar-mesa';

/**
 * DP-18 (A19) · CANCELAR LA CUENTA DE MESAS UNIDAS PREGUNTA POR EL GRUPO.
 *
 * Al cancelar la cuenta de la principal de mesas unidas, las mesas quedaban libres y unidas sin
 * que nadie lo decidiera. Ahora las dos pantallas que cancelan una cuenta de mesa (la del mesero y
 * la Caja, que montan `CancelarLaCuenta`) preguntan lo mismo que al liberar y mandan `grupo`.
 */

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const sinEspacios = (ruta: string) =>
  readFileSync(join(RAIZ_WEB, ruta), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+/g, '');

const AJUSTES = 'src/restaurante/AjustesDeLaCuenta.tsx';

describe('cancelar la cuenta de una mesa unida', () => {
  it('lee el grupo de la mesa y, si lo hay, pregunta ANTES de cancelar', () => {
    const c = sinEspacios(AJUSTES);
    expect(c).toContain('useUnionDeLaMesa(mesaId,lecturaDelGrupo)');
    expect(c).toContain('if(grupoDeLaMesa===null)voidcancelar();elsesetPreguntandoElGrupo(true);');
  });

  it('cada respuesta cancela con su decisión y la manda al comando', () => {
    const c = sinEspacios(AJUSTES);
    expect(c).toContain("voidcancelar('separar');");
    expect(c).toContain("voidcancelar('mantener');");
    expect(c).toContain('...(grupo===undefined?{}:{grupo})');
    expect(c).toContain("'/api/restaurante/cancelar-orden'");
  });

  it('es LA MISMA pregunta que al liberar: los textos salen de un solo lugar', () => {
    expect(PREGUNTA_DEL_GRUPO).toBe('¿Separar mesas o dejarlas unidas?');
    expect(SEPARAR_MESAS).toBe('Separar mesas');
    expect(DEJARLAS_UNIDAS).toBe('Dejarlas unidas');
    expect(EXPLICACION_DEL_GRUPO).toContain('cada mesa vuelve a su lugar');
    for (const ruta of [AJUSTES, 'src/restaurante/unir-mesas/liberar-con-pregunta.tsx']) {
      const c = sinEspacios(ruta);
      expect(c, ruta).toContain('{PREGUNTA_DEL_GRUPO}');
      expect(c, ruta).toContain('{SEPARAR_MESAS}');
      expect(c, ruta).toContain('{DEJARLAS_UNIDAS}');
      expect(c, ruta).toContain('{EXPLICACION_DEL_GRUPO}');
    }
  });

  it('la Caja y la mesa del mesero le dan su mesa al botón', () => {
    expect(sinEspacios('src/restaurante/Cobro.tsx')).toContain('mesaId={cuenta.mesa_id??null}');
    expect(sinEspacios('src/restaurante/CancelarDelMesero.tsx')).toContain('mesaId={mesaId}');
    expect(sinEspacios('heredado/pages/Mesero.jsx')).toContain('mesaId={mesaActiva?.id??null}');
  });
});
