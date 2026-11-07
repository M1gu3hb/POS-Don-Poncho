import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-14.6-7 · CANCELAR SIN PODER COMPROBAR LA COCINA, del lado de la pantalla.
 *
 * Cuando la lectura de la cocina vence o falla, el diálogo pide el PIN de un gerente y, al
 * cancelar, le dice al servidor que no pudo comprobarla (`sinComprobarLaCocina`): él exige esa
 * autorización y cuenta TODO lo vivo como pérdida (lo prueba
 * `restaurante/cancelar-sin-comprobar-la-cocina.integracion.test.ts`). Si la pantalla dejara de
 * mandarlo, el PIN volvería a ser sólo fricción y la pérdida saldría con lo que la cocina marcó.
 */

const AJUSTES = join(__dirname, 'AjustesDeLaCuenta.tsx');

describe('el diálogo de cancelar, sin la cocina', () => {
  it('manda sinComprobarLaCocina cuando la cocina no se pudo comprobar', () => {
    expect(readFileSync(AJUSTES, 'utf8')).toMatch(
      /invocarComando\('\/api\/restaurante\/cancelar-orden', \{[\s\S]*?\.\.\.\(sinRespuesta \? \{ sinComprobarLaCocina: true \} : \{\}\),[\s\S]*?\}\);/,
    );
  });

  it('y en ese caso pide el PIN antes de dejar cancelar', () => {
    const fuente = readFileSync(AJUSTES, 'utf8');
    expect(fuente).toMatch(
      /const sinRespuesta = exigePinPorLaCocina\(cocina, vencida && abierto\);/,
    );
    expect(fuente).toMatch(/const necesitaPin = pidePin \|\| sinRespuesta;/);
    expect(fuente).toMatch(/\(!necesitaPin \|\| autorizada !== null\)/);
  });
});
