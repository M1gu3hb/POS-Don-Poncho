import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * DP-11.3 · EL GESTOR DE SONIDO: el único lugar por donde suena la interfaz. Se prueba sin Web
 * Audio: el reproductor es de mentiras y se mira qué receta le llega.
 */

const reproducir = vi.fn<(receta: string, ganancia: number) => Promise<void>>();
const precargar = vi.fn<(receta: string) => Promise<void>>();
const desbloquearAudio = vi.fn<() => Promise<boolean>>();

vi.mock('./reproductor', () => ({
  reproducir: (receta: string, ganancia: number) => reproducir(receta, ganancia),
  precargar: (receta: string) => precargar(receta),
  desbloquearAudio: () => desbloquearAudio(),
}));

/** Deja correr las promesas del desbloqueo (el audio corre cuando el contexto contesta). */
const vaciar = async (): Promise<void> => {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
};

async function gestorNuevo() {
  vi.resetModules();
  const gestor = await import('./gestor');
  gestor.configurarSonidos({ ganancia: 0.5, tecla: 'nib', silencioDelPortal: false });
  gestor.desbloquearSonidos();
  await vaciar();
  return gestor;
}

describe('el gestor de sonido', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    reproducir.mockReset();
    reproducir.mockResolvedValue(undefined);
    precargar.mockReset();
    precargar.mockResolvedValue(undefined);
    desbloquearAudio.mockReset();
    desbloquearAudio.mockResolvedValue(true);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('suena la receta del evento con la ganancia del aparato', async () => {
    const { sonar } = await gestorNuevo();
    sonar('cobro');
    expect(reproducir).toHaveBeenCalledWith('halo', 0.5);
  });

  it('el toque espera un instante y suena si nada más sonó', async () => {
    const { sonar, ESPERA_DEL_TOQUE_MS } = await gestorNuevo();
    sonar('toque');
    expect(reproducir).not.toHaveBeenCalled();
    vi.advanceTimersByTime(ESPERA_DEL_TOQUE_MS);
    expect(reproducir).toHaveBeenCalledExactlyOnceWith('felt', 0.5);
  });

  it('un sonido preciso en ese instante calla al toque: un toque, un sonido', async () => {
    const { sonar } = await gestorNuevo();
    sonar('toque');
    sonar('abrir');
    vi.advanceTimersByTime(200);
    expect(reproducir).toHaveBeenCalledExactlyOnceWith('popover', 0.5);
  });

  it('el teclado suena con el sonido que eligió el negocio', async () => {
    const { sonar, configurarSonidos } = await gestorNuevo();
    configurarSonidos({ ganancia: 1, tecla: 'thock', silencioDelPortal: false });
    sonar('tecla');
    expect(reproducir).toHaveBeenCalledWith('thock', 1);
  });

  it('antes del primer toque no suena', async () => {
    vi.resetModules();
    const { sonar, configurarSonidos } = await import('./gestor');
    configurarSonidos({ ganancia: 1, tecla: 'nib', silencioDelPortal: false });
    sonar('cobro');
    expect(reproducir).not.toHaveBeenCalled();
  });

  it('apagado, en el portal sin sonidos o con la voz hablando, no suena', async () => {
    const { sonar, configurarSonidos } = await gestorNuevo();
    configurarSonidos({ ganancia: 0, tecla: 'nib', silencioDelPortal: false });
    sonar('cobro');
    configurarSonidos({ ganancia: 1, tecla: 'nib', silencioDelPortal: true });
    sonar('error');
    configurarSonidos({ ganancia: 1, tecla: 'nib', silencioDelPortal: false });
    vi.stubGlobal('window', { speechSynthesis: { speaking: false, pending: true } });
    sonar('aviso');
    expect(reproducir).not.toHaveBeenCalled();
    vi.stubGlobal('window', { speechSynthesis: { speaking: false, pending: false } });
    sonar('aviso');
    expect(reproducir).toHaveBeenCalledExactlyOnceWith('hint', 1);
  });

  it('el mismo sonido no se repite antes de 80 ms', async () => {
    const { sonar } = await gestorNuevo();
    sonar('cobro');
    vi.advanceTimersByTime(50);
    sonar('cobro');
    vi.advanceTimersByTime(30);
    sonar('cobro');
    expect(reproducir).toHaveBeenCalledTimes(2);
  });

  it('si el navegador no deja sonar, lo anota y avisa; nunca lanza', async () => {
    const { sonar, falloDelSonido, suscribirAlFallo } = await gestorNuevo();
    reproducir.mockRejectedValueOnce(new Error('NotAllowedError'));
    const aviso = vi.fn();
    const soltar = suscribirAlFallo(aviso);
    expect(() => {
      sonar('cobro');
    }).not.toThrow();
    await vi.waitFor(() => {
      expect(aviso).toHaveBeenCalled();
    });
    expect(falloDelSonido()).toBe('NotAllowedError');
    soltar();
  });

  it('antes de recargar (entrar, salir) espera sólo si de verdad suena', async () => {
    const { sonarAntesDeIrse, configurarSonidos, ESPERA_ANTES_DE_IRSE_MS } = await gestorNuevo();
    let listo = false;
    void sonarAntesDeIrse('entrar').then(() => {
      listo = true;
    });
    await Promise.resolve();
    expect(reproducir).toHaveBeenCalledWith('arrive', 0.5);
    expect(listo).toBe(false);
    await vi.advanceTimersByTimeAsync(ESPERA_ANTES_DE_IRSE_MS);
    expect(listo).toBe(true);

    configurarSonidos({ ganancia: 0, tecla: 'nib', silencioDelPortal: false });
    let apagado = false;
    void sonarAntesDeIrse('salir').then(() => {
      apagado = true;
    });
    await Promise.resolve();
    expect(apagado).toBe(true);
  });

  it('una acción calla al diálogo que cierra o abre, por un momento', async () => {
    const { sonar } = await gestorNuevo();
    sonar('cobro');
    sonar('cerrar');
    sonar('abrir');
    expect(reproducir.mock.calls.map(([receta]) => receta)).toEqual(['halo']);
    vi.advanceTimersByTime(400);
    sonar('abrir');
    expect(reproducir).toHaveBeenLastCalledWith('popover', 0.5);
  });

  it('un sonido que sí sale quita el aviso de un fallo anterior', async () => {
    const { sonar, falloDelSonido } = await gestorNuevo();
    reproducir.mockRejectedValueOnce(new Error('NotAllowedError'));
    sonar('cobro');
    await vi.waitFor(() => {
      expect(falloDelSonido()).toBe('NotAllowedError');
    });
    sonar('ticket');
    await vi.waitFor(() => {
      expect(falloDelSonido()).toBeNull();
    });
  });

  it('el audio se reanuda en CADA gesto (iOS lo interrumpe); lo que más suena, precargado una vez', async () => {
    const { desbloquearSonidos } = await gestorNuevo();
    desbloquearSonidos();
    desbloquearSonidos();
    await vaciar();
    expect(desbloquearAudio).toHaveBeenCalledTimes(3);
    expect(precargar.mock.calls.map(([receta]) => receta).sort()).toEqual([
      'arrive',
      'felt',
      'nib',
      'retreat',
    ]);
  });

  it('en «Apagado» o en el portal callado no se precarga nada', async () => {
    vi.resetModules();
    const gestor = await import('./gestor');
    gestor.configurarSonidos({ ganancia: 0, tecla: 'nib', silencioDelPortal: false });
    gestor.desbloquearSonidos();
    vi.resetModules();
    const otro = await import('./gestor');
    otro.configurarSonidos({ ganancia: 1, tecla: 'nib', silencioDelPortal: true });
    otro.desbloquearSonidos();
    await vaciar();
    expect(precargar).not.toHaveBeenCalled();
    expect(desbloquearAudio).toHaveBeenCalledTimes(2);
  });

  it('la comanda nueva de Cocina suena a Ping y el aviso del comensal a Signal (DP-12.6)', async () => {
    const { sonar } = await gestorNuevo();
    sonar('comandaNueva');
    sonar('solicitud');
    expect(reproducir.mock.calls.map(([receta]) => receta)).toEqual(['ping', 'signal']);
  });

  it('lo que sonó queda escrito en el documento, para que el navegador lo lea (DP-12.6)', async () => {
    const atributos = new Map<string, string>();
    vi.stubGlobal('document', {
      documentElement: {
        setAttribute: (nombre: string, valor: string) => atributos.set(nombre, valor),
      },
    });
    const { sonar } = await gestorNuevo();
    sonar('comandaNueva');
    expect(atributos.get('data-ultimo-sonido')).toBe('ping');
    sonar('solicitud');
    expect(atributos.get('data-ultimo-sonido')).toBe('signal');
  });

  it('con la voz hablando o en cola, ni el timbre de Cocina ni el aviso suenan (DP-12.6)', async () => {
    const { sonar } = await gestorNuevo();
    vi.stubGlobal('window', { speechSynthesis: { speaking: true, pending: false } });
    sonar('comandaNueva');
    vi.stubGlobal('window', { speechSynthesis: { speaking: false, pending: true } });
    sonar('solicitud');
    expect(reproducir).not.toHaveBeenCalled();
  });

  it('el primer toque desbloquea: antes no suena, y ese toque toca lo pendiente (DP-12.6, DP-13.2)', async () => {
    vi.resetModules();
    const { sonar, configurarSonidos, desbloquearSonidos } = await import('./gestor');
    configurarSonidos({ ganancia: 1, tecla: 'nib', silencioDelPortal: false });
    sonar('comandaNueva');
    expect(reproducir).not.toHaveBeenCalled();
    desbloquearSonidos();
    await vaciar();
    expect(reproducir).toHaveBeenCalledExactlyOnceWith('ping', 1);
    vi.advanceTimersByTime(5_000);
    sonar('cobro');
    expect(reproducir).toHaveBeenLastCalledWith('halo', 1);
  });

  it('la voz espera a que el sonido termine; si no suena, no espera (DP-12.6)', async () => {
    const { sonarAntesDeHablar, configurarSonidos } = await gestorNuevo();
    let termina: () => void = () => undefined;
    reproducir.mockReturnValueOnce(
      new Promise<void>((resolver) => {
        termina = resolver;
      }),
    );
    let habla = false;
    void sonarAntesDeHablar('comandaNueva').then(() => {
      habla = true;
    });
    await Promise.resolve();
    expect(reproducir).toHaveBeenCalledWith('ping', 0.5);
    expect(habla).toBe(false);
    termina();
    await vi.waitFor(() => {
      expect(habla).toBe(true);
    });

    configurarSonidos({ ganancia: 0, tecla: 'nib', silencioDelPortal: false });
    let sinSonido = false;
    void sonarAntesDeHablar('comandaNueva').then(() => {
      sinSonido = true;
    });
    await Promise.resolve();
    expect(sinSonido).toBe(true);
  });

  it('si el sonido falla, la voz habla igual: no se queda esperando (DP-12.6)', async () => {
    const { sonarAntesDeHablar } = await gestorNuevo();
    reproducir.mockRejectedValueOnce(new Error('NotAllowedError'));
    let habla = false;
    void sonarAntesDeHablar('solicitud').then(() => {
      habla = true;
    });
    await vi.waitFor(() => {
      expect(habla).toBe(true);
    });
  });

  it('«Oír» suena aunque el aparato esté apagado', async () => {
    const { oir, configurarSonidos } = await gestorNuevo();
    configurarSonidos({ ganancia: 0, tecla: 'nib', silencioDelPortal: false });
    oir('confetti', 0.35);
    expect(reproducir).toHaveBeenCalledWith('confetti', 0.35);
  });
});
