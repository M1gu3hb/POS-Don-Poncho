import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-22 (día de bots, semilla 2212) · «CAMBIAR DE MESA» TAMBIÉN EN EL TELÉFONO.
 *
 * DP-15.1 le dio «Cambiar de mesa» al mesero en SUS mesas, pero sólo se pintaba en el panel de la
 * mesa de la tableta y del escritorio (`md:` en adelante). En el teléfono —el aparato del mesero—
 * el pedido de la mesa vive en una hoja inferior (`MeseroCartFAB`) que sólo ofrecía «Solicitar
 * cuenta»: el día de bots, el mesero del teléfono tocó la mesa que SÍ era suya veinte veces y nunca
 * encontró el botón (en la tableta, siempre). La regla de quién lo ve es la misma en los dos sitios
 * (`puedeMoverLaCuenta`); aquí se comprueba que el teléfono la usa.
 */

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const leer = (...ruta: string[]): string =>
  readFileSync(join(RAIZ_WEB, ...ruta), 'utf8').replace(/\s+/g, ' ');

describe('DP-22 · «Cambiar de mesa» en la hoja del pedido del teléfono', () => {
  const hoja = leer('heredado', 'components', 'mesero', 'MeseroCartFAB.jsx');
  const pagina = leer('heredado', 'pages', 'Mesero.jsx');

  it('la hoja pinta «Cambiar de mesa» sólo cuando la pantalla dice que se puede', () => {
    expect(hoja).toContain('puedeCambiarDeMesa');
    expect(hoja).toMatch(/puedeCambiarDeMesa && \(/);
    expect(hoja).toContain('Cambiar de mesa');
  });

  it('al tocarlo cierra la hoja primero y luego abre el panel de las mesas libres', () => {
    const inicio = hoja.indexOf('puedeCambiarDeMesa && (');
    const boton = hoja.slice(inicio, inicio + 700);
    expect(boton).toContain('setOpen(false)');
    // LLAMADO de verdad (`alCambiarDeMesa?.()`), no sólo nombrado: un manejador sin llamar dejaba el botón mudo.
    expect(boton).toContain('alCambiarDeMesa?.()');
    expect(boton.indexOf('setOpen(false)')).toBeLessThan(boton.indexOf('alCambiarDeMesa?.()'));
  });

  it('la página le pasa la MISMA regla que usa el panel de la tableta', () => {
    const inicio = pagina.indexOf('<MeseroCartFAB');
    const uso = pagina.slice(inicio, pagina.indexOf('/>', inicio));
    // La regla misma, no un valor fijo: con `true` la hoja ofrecería el botón a quien la regla no deja.
    expect(uso).toContain('puedeCambiarDeMesa={puedeCambiarDeMesaAqui}');
    expect(uso).toContain('alCambiarDeMesa={');
    expect(uso).toContain('setCambiandoDeMesa(true)');
    expect(pagina).toContain('const puedeCambiarDeMesaAqui');
    // Una sola definición de la regla: el panel de la tableta y la hoja la comparten.
    expect(pagina.match(/puedeMoverLaCuenta\(\{/g)).toHaveLength(1);
  });
});
