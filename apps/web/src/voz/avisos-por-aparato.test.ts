import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * DP-22 · EL EFECTO DE LOS DOS AJUSTES DE VOZ DE ESTE APARATO que sólo guardan una clave del
 * navegador: `mh_mesero_alert_config` (cómo se avisa al mesero) y `mh_cocina_voz_config` (si la
 * cocina lee las comandas en voz alta).
 *
 * `speak()` de `heredado/lib/voiceAlert.js` es lo que leen los vigilantes de «pedido listo», de las
 * solicitudes del portal y de la cocina: con el ajuste en silencio no debe hablar, y con él puesto,
 * sí. Cada prueba carga el módulo de cero porque su cola de voz es estado de módulo.
 */

interface Utterance {
  lang: string;
  volume: number;
  rate: number;
  pitch: number;
  voice: unknown;
  onend: (() => void) | null;
  onerror: ((evento: { error: string }) => void) | null;
  readonly text: string;
}

class UtteranceSimulada implements Utterance {
  lang = '';
  volume = 1;
  rate = 1;
  pitch = 1;
  voice: unknown = null;
  onend: (() => void) | null = null;
  onerror: ((evento: { error: string }) => void) | null = null;
  constructor(public readonly text: string) {}
}

const PAULINA = { name: 'Paulina', lang: 'es-MX', localService: true };

async function cargar(guardado: Record<string, string>) {
  const dichas: Utterance[] = [];
  const datos = new Map(Object.entries(guardado));
  vi.stubGlobal('window', {
    speechSynthesis: {
      speaking: false,
      pending: false,
      getVoices: () => [PAULINA],
      speak: vi.fn((utter: Utterance) => {
        dichas.push(utter);
      }),
      cancel: vi.fn(),
    },
    SpeechSynthesisUtterance: UtteranceSimulada,
  });
  vi.stubGlobal('localStorage', {
    getItem: (clave: string) => datos.get(clave) ?? null,
    setItem: (clave: string, valor: string) => {
      datos.set(clave, valor);
    },
    removeItem: (clave: string) => {
      datos.delete(clave);
    },
  });
  vi.stubGlobal('navigator', { onLine: true });
  vi.resetModules();
  const modulo = await import('../../heredado/lib/voiceAlert.js');
  return { modulo, dichas };
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('mh_mesero_alert_config · cómo se avisa al mesero en este aparato', () => {
  it.each(['silencio', 'sonido'])('en «%s» no se lee nada en voz alta', async (modo) => {
    const { modulo, dichas } = await cargar({ mh_mesero_alert_config: JSON.stringify({ modo }) });
    modulo.speak('Mesa 4: pedido listo');
    expect(dichas).toEqual([]);
  });

  it.each(['voz', 'sonido_voz'])('en «%s» la frase se lee', async (modo) => {
    const { modulo, dichas } = await cargar({ mh_mesero_alert_config: JSON.stringify({ modo }) });
    modulo.speak('Mesa 4: pedido listo');
    expect(dichas.map((d) => d.text)).toEqual(['Mesa 4: pedido listo']);
  });

  it('sin elegir nada, el mesero oye sonido y voz', async () => {
    const { modulo, dichas } = await cargar({});
    const config = modulo.getAlertConfig() as { readonly modo?: string };
    expect(config.modo).toBe('sonido_voz');
    modulo.speak('Mesa 2: pidió la cuenta');
    expect(dichas).toHaveLength(1);
  });

  it('el volumen elegido llega a la voz', async () => {
    const { modulo, dichas } = await cargar({
      mh_mesero_alert_config: JSON.stringify({ modo: 'voz', volumen: 0.3 }),
    });
    modulo.speak('Mesa 9: ayuda');
    expect(dichas[0]?.volume).toBe(0.3);
  });
});

describe('mh_cocina_voz_config · si la cocina lee las comandas en este aparato', () => {
  it('con la voz de cocina apagada, la comanda no se lee', async () => {
    const { modulo, dichas } = await cargar({
      mh_cocina_voz_config: JSON.stringify({ voz_activa: false }),
    });
    modulo.speak('Nueva comanda: tres tacos', { cocina: true });
    expect(dichas).toEqual([]);
  });

  it('con la voz de cocina activa (o sin elegir), la comanda se lee', async () => {
    const encendida = await cargar({ mh_cocina_voz_config: JSON.stringify({ voz_activa: true }) });
    encendida.modulo.speak('Nueva comanda: tres tacos', { cocina: true });
    expect(encendida.dichas).toHaveLength(1);
    const porOmision = await cargar({});
    porOmision.modulo.speak('Nueva comanda: dos tortas', { cocina: true });
    expect(porOmision.dichas).toHaveLength(1);
  });

  it('el modo del mesero no mueve a la cocina, ni al revés', async () => {
    const { modulo, dichas } = await cargar({
      mh_mesero_alert_config: JSON.stringify({ modo: 'silencio' }),
    });
    modulo.speak('Nueva comanda: una sopa', { cocina: true });
    expect(dichas).toHaveLength(1);
  });
});
