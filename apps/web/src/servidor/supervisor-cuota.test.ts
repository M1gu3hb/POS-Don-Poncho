import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '../../app/api/identidad/supervisor/route';

/**
 * QA2-001 (DP-13.5) · LA AUTORIZACIÓN DEL SUPERVISOR CUENTA SÓLO LOS PIN QUE FALLAN.
 *
 * `/api/identidad/supervisor` gasta su PROPIO cubo por origen (`LIMITES.supervisor`, DP-14.6):
 * probar el PIN del gerente desde la caja es un barrido igual que en la pantalla de acceso. Pero
 * contaba también los aciertos: en un restaurante todos los aparatos salen por la misma IP, y con
 * DP-13.2 cada cuenta pedida que se cancela pide el PIN; la autorización número veintiuno en cinco
 * minutos daba 429 y además dejaba a TODO el local sin poder entrar. Ahora, como la entrada
 * (`auth-entrar-cuota.test.ts`), la autorización buena devuelve su intento y la mala lo conserva.
 */

const SOLICITA = '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b';
const GERENTE = '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c';

const dobles = vi.hoisted(() => ({
  permitir: vi.fn(),
  devolver: vi.fn(),
  autorizarConPin: vi.fn(),
  topeDelAutorizador: vi.fn(),
}));

vi.mock('@morphiqpos/contracts', async () => {
  const original =
    await vi.importActual<typeof import('@morphiqpos/contracts')>('@morphiqpos/contracts');
  return {
    ...original,
    validarEntorno: () => ({
      APP_URL: 'https://pos.example',
      PIN_PEPPER: 'pimienta-de-prueba',
      SESSION_SECRET: 'secreto-de-prueba',
      NODE_ENV: 'test',
    }),
  };
});

vi.mock('@morphiqpos/app/http', async () => {
  const original =
    await vi.importActual<typeof import('@morphiqpos/app/http')>('@morphiqpos/app/http');
  return { ...original, permitir: dobles.permitir, devolver: dobles.devolver };
});

vi.mock('@morphiqpos/app/identidad', async () => {
  const original = await vi.importActual<typeof import('@morphiqpos/app/identidad')>(
    '@morphiqpos/app/identidad',
  );
  return {
    ...original,
    autorizarConPin: dobles.autorizarConPin,
    topeDelAutorizador: dobles.topeDelAutorizador,
  };
});

// La sesión de la cajera: aquí no se mide cómo se lee, sólo lo que hace la ruta con ella.
vi.mock('~/servidor/http', () => ({
  conSesion: async (
    _peticion: Request,
    fn: (sesion: { organizacionId: string; empleoId: string }) => Promise<unknown>,
  ) => {
    const salida = await fn({ organizacionId: 'org-de-prueba', empleoId: SOLICITA });
    return salida instanceof Response ? salida : Response.json({ ok: true, datos: salida });
  },
}));

const pedir = () =>
  POST(
    new Request('https://pos.example/api/identidad/supervisor', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
      body: JSON.stringify({ empleoId: GERENTE, pin: '000000', para: 'cancelacion' }),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  dobles.permitir.mockResolvedValue({ ok: true, esperaSegundos: 0 });
  dobles.topeDelAutorizador.mockResolvedValue({ topeCentavos: '200000', topeBp: 3000 });
});

describe('la cuota por origen de la autorización del supervisor', () => {
  it('con el PIN correcto, la autorización devuelve su intento', async () => {
    dobles.autorizarConPin.mockResolvedValue({
      ok: true,
      autorizacion: 'firmada',
      rol: 'gerente',
      vence: new Date(),
    });
    const respuesta = await pedir();
    expect(respuesta.status).toBe(200);
    expect(dobles.devolver).toHaveBeenCalledTimes(1);
    expect(dobles.devolver.mock.calls[0]?.[0]).toBe('supervisor');
  });

  it('ronda 2 · devuelve hasta cuánto llega ese PIN, sin quitar lo de antes', async () => {
    dobles.autorizarConPin.mockResolvedValue({
      ok: true,
      autorizacion: 'firmada',
      rol: 'gerente',
      vence: new Date(),
    });
    const cuerpo: unknown = await (await pedir()).json();
    expect(cuerpo).toMatchObject({
      ok: true,
      datos: { autorizacion: 'firmada', rol: 'gerente', topeCentavos: '200000', topeBp: 3000 },
    });
    expect(dobles.topeDelAutorizador).toHaveBeenCalledWith('org-de-prueba', 'gerente');
  });

  it('con el PIN equivocado (o bloqueado), el intento se queda contado', async () => {
    for (const motivo of ['credenciales', 'bloqueada', 'no_autoriza'] as const) {
      dobles.autorizarConPin.mockResolvedValue({ ok: false, motivo });
      const respuesta = await pedir();
      expect(respuesta.status).toBeGreaterThanOrEqual(400);
    }
    expect(dobles.devolver).not.toHaveBeenCalled();
  });

  it('sin cupo, ni siquiera se comprueba el PIN', async () => {
    dobles.permitir.mockResolvedValue({ ok: false, esperaSegundos: 120 });
    const respuesta = await pedir();
    expect(respuesta.status).toBe(429);
    expect(dobles.autorizarConPin).not.toHaveBeenCalled();
    expect(dobles.devolver).not.toHaveBeenCalled();
  });
});
