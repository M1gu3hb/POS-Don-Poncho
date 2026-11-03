import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * DP-13.2 · EL SONIDO QUE NO PUEDE QUEDAR MUDO.
 *
 * Antes del primer gesto el navegador no deja sonar: lo que quería sonar (la comanda nueva) se
 * perdía en silencio y nadie lo sabía. Ahora el gestor lo recuerda, la pantalla dice «Sonido
 * apagado · toca para activar», y el toque que lo desbloquea lo toca.
 */

const reproducir = vi.fn<(receta: string, ganancia: number) => Promise<void>>();
const precargar = vi.fn<(receta: string) => Promise<void>>();
const desbloquearAudio = vi.fn<() => Promise<void>>();

vi.mock('./reproductor', () => ({
  reproducir: (receta: string, ganancia: number) => reproducir(receta, ganancia),
  precargar: (receta: string) => precargar(receta),
  desbloquearAudio: () => desbloquearAudio(),
}));

async function gestorSinTocar() {
  vi.resetModules();
  const gestor = await import('./gestor');
  gestor.configurarSonidos({ ganancia: 0.5, tecla: 'nib', silencioDelPortal: false });
  return gestor;
}

describe('el sonido bloqueado (DP-13.2)', () => {
  beforeEach(() => {
    reproducir.mockReset();
    reproducir.mockResolvedValue(undefined);
    precargar.mockReset();
    precargar.mockResolvedValue(undefined);
    desbloquearAudio.mockReset();
    desbloquearAudio.mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lo que quiso sonar antes del primer toque se recuerda y la pantalla lo sabe', async () => {
    const { sonar, sonidoBloqueado, suscribirAlBloqueo } = await gestorSinTocar();
    const aviso = vi.fn();
    suscribirAlBloqueo(aviso);
    expect(sonidoBloqueado()).toBe(false);
    sonar('comandaNueva');
    expect(reproducir).not.toHaveBeenCalled();
    expect(sonidoBloqueado()).toBe(true);
    expect(aviso).toHaveBeenCalled();
  });

  it('el toque que desbloquea lo toca, y el aviso se va', async () => {
    const { sonar, desbloquearSonidos, sonidoBloqueado } = await gestorSinTocar();
    sonar('comandaNueva');
    desbloquearSonidos();
    expect(reproducir).toHaveBeenCalledExactlyOnceWith('ping', 0.5);
    expect(sonidoBloqueado()).toBe(false);
  });

  it('un toque de la pantalla no cuenta como «algo que quiso sonar»', async () => {
    const { sonar, sonidoBloqueado } = await gestorSinTocar();
    sonar('toque');
    expect(sonidoBloqueado()).toBe(false);
  });

  it('con el aparato en Apagado no hay nada bloqueado que avisar', async () => {
    const gestor = await gestorSinTocar();
    gestor.configurarSonidos({ ganancia: 0, tecla: 'nib', silencioDelPortal: false });
    gestor.sonar('comandaNueva');
    expect(gestor.sonidoBloqueado()).toBe(false);
  });

  it('la voz bloqueada también se avisa, y el desbloqueo le dice a la voz que reintente', async () => {
    const lanzados: string[] = [];
    const escuchas = new Map<string, () => void>();
    vi.stubGlobal('window', {
      addEventListener: (tipo: string, escucha: () => void) => {
        escuchas.set(tipo, escucha);
      },
      dispatchEvent: (evento: Event) => {
        lanzados.push(evento.type);
        return true;
      },
    });
    const gestor = await gestorSinTocar();
    escuchas.get(gestor.EVENTO_VOZ_BLOQUEADA)?.();
    expect(gestor.sonidoBloqueado()).toBe(true);
    gestor.desbloquearSonidos();
    expect(lanzados).toContain(gestor.EVENTO_AUDIO_DESBLOQUEADO);
    expect(gestor.sonidoBloqueado()).toBe(false);
  });

  it('con un timbre pendiente, la voz negada espera a que el timbre termine (no se le encima)', async () => {
    const lanzados: string[] = [];
    const escuchas = new Map<string, () => void>();
    vi.stubGlobal('window', {
      addEventListener: (tipo: string, escucha: () => void) => {
        escuchas.set(tipo, escucha);
      },
      dispatchEvent: (evento: Event) => {
        lanzados.push(evento.type);
        return true;
      },
    });
    let terminarElTimbre: () => void = () => undefined;
    reproducir.mockReturnValue(
      new Promise<void>((listo) => {
        terminarElTimbre = listo;
      }),
    );
    const gestor = await gestorSinTocar();
    gestor.sonar('comandaNueva');
    escuchas.get(gestor.EVENTO_VOZ_BLOQUEADA)?.();
    gestor.desbloquearSonidos();
    expect(reproducir).toHaveBeenCalledExactlyOnceWith('ping', 0.5);
    expect(lanzados).not.toContain(gestor.EVENTO_AUDIO_DESBLOQUEADO);
    terminarElTimbre();
    await vi.waitFor(() => {
      expect(lanzados).toContain(gestor.EVENTO_AUDIO_DESBLOQUEADO);
    });
  });
});

describe('encender el audio no se queda colgado (DP-13.2)', () => {
  it('si el navegador no contesta, se rinde a tiempo con un error', async () => {
    vi.useFakeTimers();
    const { conTiempoLimite, MS_PARA_ENCENDER } = await import('./motor/tiempo-limite');
    const nunca = new Promise<void>(() => undefined);
    const intento = conTiempoLimite(nunca, MS_PARA_ENCENDER, 'no encendió');
    const esperado = expect(intento).rejects.toThrow('no encendió');
    vi.advanceTimersByTime(MS_PARA_ENCENDER + 1);
    await esperado;
    vi.useRealTimers();
  });

  it('si contesta, pasa lo que contestó', async () => {
    const { conTiempoLimite } = await import('./motor/tiempo-limite');
    await expect(conTiempoLimite(Promise.resolve(7), 1000, 'x')).resolves.toBe(7);
  });
});
