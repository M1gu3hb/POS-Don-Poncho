import { describe, expect, it } from 'vitest';

import { emular } from '../termico/emulador.ts';
import { mapaVacio } from '../termico/mapa.ts';
import { cajonPorOmision, perfilPorOmision } from '../termico/perfil.ts';
import { armarTrabajo } from '../termico/trabajo.ts';
import { conMiles } from './resultado-de-prueba.ts';
import { resumenDeLaVista } from './resumen-de-la-vista.ts';

/** DP-20 · el resumen de la vista previa mide el papel que leyó la impresora falsa. */

const perfil = {
  ...perfilPorOmision(80, { conexion: 'spooler' }),
  tieneCajon: true,
  cajon: cajonPorOmision(),
};

describe('el resumen de la vista previa', () => {
  it('mide el papel, cuenta los bytes y dice dónde cortó', () => {
    const mapa = mapaVacio(576, 100);
    const bytes = armarTrabajo(perfil, [mapa], { abrirCajon: true });
    const papel = emular(bytes, perfil.puntos);
    const resumen = resumenDeLaVista(papel, bytes.length, 203);
    expect(resumen.medidas).toContain('576 puntos de ancho');
    expect(resumen.medidas).toContain(`${String(papel.alto)} de alto`);
    expect(resumen.medidas).toContain('72.1 ×');
    expect(resumen.bytes).toBe(`${conMiles(bytes.length)} bytes`);
    expect(resumen.cortes).toMatch(/^Corta una vez, parcial, en la fila \d+/);
    expect(resumen.cajon).toBe('Pulsa el cajón 1 vez');
  });

  it('con varias copias dice cuántos cortes y sin cajón no lo menciona', () => {
    const mapa = mapaVacio(576, 20);
    const bytes = armarTrabajo(perfil, [mapa, mapa, mapa]);
    const resumen = resumenDeLaVista(emular(bytes, 576), bytes.length, 203);
    expect(resumen.cortes).toBe('Corta 3 veces (una por copia)');
    expect(resumen.cajon).toBeNull();
  });

  it('sin corte lo dice', () => {
    const sinCorte = { ...perfil, corte: 'ninguno' as const };
    const bytes = armarTrabajo(sinCorte, [mapaVacio(576, 8)]);
    expect(resumenDeLaVista(emular(bytes, 576), bytes.length, 203).cortes).toBe('Sin cortes');
  });
});
