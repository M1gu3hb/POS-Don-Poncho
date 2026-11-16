import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-21 · Bloque 8 · CONTRATO: «ESTA PANTALLA ANUNCIA LAS COMANDAS» SE RESPETA DONDE SE HABLA.
 *
 * Los componentes no se pintan en estas pruebas (sin DOM); este contrato lee el código y exige
 * que quien habla de una comanda nueva —la pantalla de Cocina y el teléfono— pregunte antes por
 * el interruptor de SU aparato, y que el ajuste esté donde se enciende y se apaga.
 */

const WEB = join(__dirname, '..', '..');
const fuente = (ruta: string): string => readFileSync(join(WEB, ruta), 'utf8');

describe('el interruptor de este aparato, donde habla la cocina', () => {
  it('la pantalla de Cocina lo lee ANTES del timbre y de la voz', () => {
    const vigilante = fuente('heredado/components/cocina/CocinaNuevoPedidoWatcher.jsx');
    const lee = vigilante.indexOf('leerAnuncioDelAparato(almacenDelAparato())');
    expect(lee, 'no pregunta por el interruptor').toBeGreaterThan(-1);
    expect(lee).toBeLessThan(vigilante.indexOf("sonarAntesDeHablar('comandaNueva')"));
    expect(vigilante).toMatch(/if \(!anuncia\) return;/);
  });

  it('el teléfono de cocina sólo anuncia la llegada si el aparato anuncia', () => {
    expect(fuente('src/telefono-de-cocina/TelefonoDeCocina.tsx')).toMatch(
      /if \(leerAnuncioDelAparato\(almacenDelAparato\(\)\)\) speak\(frases, \{ cocina: true \}\)/,
    );
  });

  it('el ajuste está en Configuración → Este aparato y en el sonido del teléfono', () => {
    expect(fuente('heredado/pages/Configuracion.jsx')).toContain('<AnuncioDeComandasDelAparato />');
    const dialogo = fuente('src/configuracion/DialogoDelSonido.tsx');
    expect(dialogo).toContain('conAnuncioDeComandas ? <AnuncioDeComandasDelAparato />');
    expect(fuente('src/telefono-de-cocina/TelefonoDeCocina.tsx')).toContain('conAnuncioDeComandas');
  });

  it('la prueba «Así se oye una comanda» está en Configuración → Sonidos', () => {
    expect(fuente('src/configuracion/SonidosDelNegocio.tsx')).toContain(
      '<PruebaDeLaVozDeComandas />',
    );
  });

  it('hay UNA sola frase de comanda: voiceAlert la re-exporta, no la copia', () => {
    const voz = fuente('heredado/lib/voiceAlert.js');
    expect(voz).toContain("export { fraseNuevoPedidoCocina } from '~/voz/frase-de-la-comanda'");
    expect(voz).not.toMatch(/function fraseNuevoPedidoCocina/);
  });
});
