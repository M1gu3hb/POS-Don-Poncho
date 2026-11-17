import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-21 · Bloque 8 y DP-22 · CONTRATO: «ESTA PANTALLA ANUNCIA LAS COMANDAS» SE RESPETA DONDE SE HABLA.
 *
 * Los componentes no se pintan en estas pruebas (sin DOM); este contrato lee el código y exige
 * que quien habla de una comanda nueva —la pantalla de Cocina y el teléfono— pregunte antes por
 * el interruptor de SU aparato CON LA REGLA DEL PUESTO (`anunciaEsteAparato`), que la tarjeta de
 * Este aparato diga lo mismo que hace el vigilante, y que a la cocina se le pregunte una vez.
 */

const WEB = join(__dirname, '..', '..');
const fuente = (ruta: string): string => readFileSync(join(WEB, ruta), 'utf8');

/** El código de un archivo sin comentarios (lo que se afirma es lo que se ejecuta, no lo que se dice). */
const codigo = (ruta: string): string =>
  fuente(ruta)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

const VIGILANTE = 'heredado/components/cocina/CocinaNuevoPedidoWatcher.jsx';
const TELEFONO = 'src/telefono-de-cocina/TelefonoDeCocina.tsx';
const TARJETA = 'src/configuracion/AnuncioDeComandasDelAparato.tsx';
const PREGUNTA = 'src/cocina/PreguntaDelAnuncio.tsx';

describe('el interruptor de este aparato, donde habla la cocina', () => {
  it('la pantalla de Cocina lo decide por el puesto REAL, ANTES del timbre y de la voz', () => {
    const vigilante = codigo(VIGILANTE);
    expect(vigilante).toMatch(
      /import \{ usePuesto \} from '@\/components\/configuracion\/usePuesto'/,
    );
    const decide = vigilante.indexOf('anunciaEsteAparato(');
    expect(decide, 'no usa la regla del puesto').toBeGreaterThan(-1);
    expect(vigilante).toMatch(
      /anunciaEsteAparato\(\{\s*puesto: puestoRef\.current,\s*elegido: leerEleccionDelAparato\(almacenDelAparato\(\)\),?\s*\}\)/,
    );
    expect(decide).toBeLessThan(vigilante.indexOf("sonarAntesDeHablar('comandaNueva')"));
    expect(vigilante).toMatch(/if \(!anuncia\) return;/);
  });

  it('el vigilante ya no lee el interruptor «a secas» (que valía encendido para todos)', () => {
    expect(codigo(VIGILANTE)).not.toContain('leerAnuncioDelAparato');
    expect(codigo(TELEFONO)).not.toContain('leerAnuncioDelAparato');
  });

  it('el teléfono de cocina anuncia con el puesto «teléfono»: como hoy, salvo lo que se elija', () => {
    const telefono = codigo(TELEFONO);
    expect(telefono).toMatch(
      /anunciaEsteAparato\(\{\s*puesto: TELEFONO_DE_COCINA,\s*elegido: leerEleccionDelAparato\(almacenDelAparato\(\)\),?\s*\}\)/,
    );
    expect(telefono).toMatch(/\) speak\(frases, \{ cocina: true \}\)/);
  });

  it('la tarjeta de Este aparato dice la verdad de ESE aparato, con la misma regla', () => {
    const tarjeta = codigo(TARJETA);
    expect(tarjeta).toMatch(/anunciaEsteAparato\(\{\s*puesto,\s*elegido\s*\}\)/);
    expect(tarjeta).toContain('reglaDeEsteAparato({ puesto, elegido })');
    expect(tarjeta).toContain('leerEleccionDelAparato(');
    expect(codigo('heredado/pages/Configuracion.jsx')).toContain(
      '<AnuncioDeComandasDelAparato puesto={miPuesto} />',
    );
    expect(codigo('src/configuracion/DialogoDelSonido.tsx')).toContain(
      'conAnuncioDeComandas ? <AnuncioDeComandasDelAparato puesto={TELEFONO_DE_COCINA} />',
    );
  });

  it('el ajuste está en Configuración → Este aparato y en el sonido del teléfono', () => {
    expect(fuente('heredado/pages/Configuracion.jsx')).toContain('<AnuncioDeComandasDelAparato');
    expect(fuente('src/telefono-de-cocina/TelefonoDeCocina.tsx')).toContain('conAnuncioDeComandas');
  });

  it('a la cocina se le pregunta UNA vez, sin estorbar, con dos botones grandes', () => {
    const pregunta = codigo(PREGUNTA);
    expect(pregunta).toContain('hayQuePreguntar({ puesto, elegido })');
    expect(pregunta).toContain('¿Esta pantalla anuncia las comandas en voz?');
    expect(pregunta).toContain(
      'Si otra pantalla de esta estación ya las anuncia, elige No para que no se oigan doble.',
    );
    expect(pregunta).toContain('Sí, anunciar aquí');
    expect(pregunta).toContain('No, ya hay otra');
    // La respuesta se guarda en el aparato, con la misma llave, y no bloquea la pantalla.
    expect(pregunta).toContain('guardarAnuncioDelAparato(almacenDelAparato(), ');
    expect(pregunta).not.toMatch(/Dialog|AlertDialog|fixed inset-0/);
    expect(pregunta.match(/min-h-\(--altura-tactil\)/g)?.length).toBe(2);
    expect(codigo('heredado/pages/Cocina.jsx')).toContain(
      '<PreguntaDelAnuncio puesto={miPuesto} />',
    );
  });
});

describe('lo demás de la voz de cocina sigue donde estaba', () => {
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
