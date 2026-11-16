import { beforeEach, describe, expect, it, vi } from 'vitest';

import { invocarComando } from '~/cliente/api';

import {
  abreElCajon,
  abrirCajonCon,
  TEXTO_CAJON_ABIERTO,
  TEXTO_SENAL_AL_CAJON,
  textoDeLaApertura,
} from './cajon.ts';
import type { EstadoDeImpresora, MorphiqApp } from './puente/contrato.ts';
import { cajonPorOmision, perfilPorOmision, type PerfilDeImpresion } from './termico/perfil.ts';

vi.mock('~/cliente/api', () => ({ invocarComando: vi.fn() }));

/**
 * DP-21 · Bloque 7 · EL CAJÓN EN EL APARATO.
 *
 *   · sin el interruptor del perfil (o sin la app) no hay cajón: ni apertura manual ni al cobrar;
 *   · a mano lleva la autorización del supervisor hasta el servidor, y el servidor va ANTES del pulso;
 *   · el mensaje dice la verdad: «Cajón abierto» sólo si la impresora lo confirma (DLE EOT).
 */

const IMPRESORA = { conexion: 'spooler', nombre: 'POS-80' } as const;
const CON_CAJON: PerfilDeImpresion = {
  ...perfilPorOmision(80, IMPRESORA),
  tieneCajon: true,
  cajon: cajonPorOmision(),
};
const SIN_CAJON: PerfilDeImpresion = perfilPorOmision(80, IMPRESORA);
const SESION = '5e000000-0000-4000-8000-000000000001';
const ORDEN = 'a0000000-0000-4000-8000-000000000001';

const invocar = vi.mocked(invocarComando);

interface Falsa {
  readonly app: MorphiqApp;
  readonly pulsos: () => number;
  readonly consultasDeEstado: () => number;
}

function appCon(
  perfil: unknown,
  opciones: {
    readonly pulso?: { ok: true } | { ok: false; codigo: string; mensaje: string };
    readonly estado?: EstadoDeImpresora | Error;
  } = {},
): Falsa {
  let pulsos = 0;
  let consultas = 0;
  const app = {
    contrato: 1,
    ajustes: () => Promise.resolve({ perfil }),
    abrirCajon: () => {
      pulsos += 1;
      return Promise.resolve(opciones.pulso ?? { ok: true, estado: 'enviado' });
    },
    estado: () => {
      consultas += 1;
      const estado = opciones.estado ?? { soportado: false };
      return estado instanceof Error ? Promise.reject(estado) : Promise.resolve(estado);
    },
  } as unknown as MorphiqApp;
  return { app, pulsos: () => pulsos, consultasDeEstado: () => consultas };
}

/** Lo que guardaba la app antes del Bloque 7: el perfil sin el campo `tieneCajon`. */
function sinTieneCajon(perfil: PerfilDeImpresion): Record<string, unknown> {
  return Object.fromEntries(Object.entries(perfil).filter(([campo]) => campo !== 'tieneCajon'));
}

const sinEspera = (): Promise<void> => Promise.resolve();
const MANUAL = { por: 'manual', motivo: 'dar_cambio', autorizacion: 'x'.repeat(40) } as const;
const COBRO = { por: 'cobro', ordenId: ORDEN, referencia: '12' } as const;

beforeEach(() => {
  invocar.mockReset();
  invocar.mockImplementation((ruta: string) =>
    Promise.resolve(
      ruta === '/api/caja/estado' ? { abierta: true, sesionCajaId: SESION } : { registrado: true },
    ),
  );
});

describe('sin interruptor, sin cajón', () => {
  it('abreElCajon: sin perfil o con el interruptor apagado, no', () => {
    expect(abreElCajon(null, 'manual')).toBe(false);
    expect(abreElCajon(SIN_CAJON, 'manual')).toBe(false);
    expect(abreElCajon(SIN_CAJON, 'cobro')).toBe(false);
    expect(abreElCajon(CON_CAJON, 'manual')).toBe(true);
  });

  it('un perfil con el pulso cargado pero el interruptor apagado no abre', () => {
    const apagado: PerfilDeImpresion = { ...CON_CAJON, tieneCajon: false };
    expect(abreElCajon(apagado, 'manual')).toBe(false);
    expect(abreElCajon(apagado, 'cobro')).toBe(false);
  });

  it('al cobrar sólo si el perfil además lo pide', () => {
    const noAlCobrar = { ...CON_CAJON, cajon: { ...cajonPorOmision(), alCobrarEnEfectivo: false } };
    expect(abreElCajon(noAlCobrar, 'cobro')).toBe(false);
    expect(abreElCajon(noAlCobrar, 'manual')).toBe(true);
  });

  it('sin la app (navegador) no se hace nada', async () => {
    expect(await abrirCajonCon(null, MANUAL)).toEqual({ abierto: false, sinCajon: true });
    expect(await abrirCajonCon(null, COBRO)).toEqual({ abierto: false, sinCajon: true });
    expect(invocar).not.toHaveBeenCalled();
  });

  it('con el interruptor apagado no toca ni el servidor ni la impresora', async () => {
    const { app, pulsos } = appCon(SIN_CAJON);
    expect(await abrirCajonCon(app, MANUAL, sinEspera)).toEqual({ abierto: false, sinCajon: true });
    expect(await abrirCajonCon(app, COBRO, sinEspera)).toEqual({ abierto: false, sinCajon: true });
    expect(invocar).not.toHaveBeenCalled();
    expect(pulsos()).toBe(0);
  });

  it('un perfil guardado antes del interruptor, con cajón, sigue abriendo', async () => {
    const sinElCampo = sinTieneCajon(CON_CAJON);
    const { app, pulsos } = appCon(sinElCampo);
    const salida = await abrirCajonCon(app, COBRO, sinEspera);
    expect(salida.abierto).toBe(true);
    expect(pulsos()).toBe(1);
  });
});

describe('a mano', () => {
  it('lleva al servidor la autorización y el motivo, y DESPUÉS manda el pulso', async () => {
    const { app, pulsos } = appCon(CON_CAJON);
    invocar.mockImplementation((ruta: string) => {
      if (ruta === '/api/caja/cajon') expect(pulsos()).toBe(0);
      return Promise.resolve(
        ruta === '/api/caja/estado'
          ? { abierta: true, sesionCajaId: SESION }
          : { registrado: true },
      );
    });
    const salida = await abrirCajonCon(app, MANUAL, sinEspera);
    expect(salida.abierto).toBe(true);
    expect(invocar).toHaveBeenCalledWith('/api/caja/cajon', {
      sesionCajaId: SESION,
      motivo: 'dar_cambio',
      autorizacion: MANUAL.autorizacion,
    });
    expect(pulsos()).toBe(1);
  });

  it('si el servidor lo niega, NO se manda el pulso y se dice por qué', async () => {
    const { app, pulsos } = appCon(CON_CAJON);
    invocar.mockImplementation((ruta: string) =>
      ruta === '/api/caja/estado'
        ? Promise.resolve({ abierta: true, sesionCajaId: SESION })
        : Promise.reject(new Error('Esa autorización ya se usó.')),
    );
    expect(await abrirCajonCon(app, MANUAL, sinEspera)).toEqual({
      abierto: false,
      sinCajon: false,
      mensaje: 'Esa autorización ya se usó.',
    });
    expect(pulsos()).toBe(0);
  });

  it('sin caja abierta en el aparato no se pide nada y se dice', async () => {
    const { app, pulsos } = appCon(CON_CAJON);
    invocar.mockResolvedValue({ abierta: false, sesionCajaId: null });
    const salida = await abrirCajonCon(app, MANUAL, sinEspera);
    expect(salida).toMatchObject({ abierto: false, sinCajon: false });
    expect(pulsos()).toBe(0);
  });
});

describe('al cobrar', () => {
  it('manda al servidor la orden cobrada y su referencia', async () => {
    const { app } = appCon(CON_CAJON);
    await abrirCajonCon(app, COBRO, sinEspera);
    expect(invocar).toHaveBeenCalledWith('/api/caja/cajon-por-cobro', {
      ordenId: ORDEN,
      referencia: '12',
    });
  });

  it('sin PIN: no pide ninguna autorización', async () => {
    const { app } = appCon(CON_CAJON);
    await abrirCajonCon(app, { por: 'cobro', ordenId: ORDEN }, sinEspera);
    expect(invocar).toHaveBeenCalledWith('/api/caja/cajon-por-cobro', { ordenId: ORDEN });
  });

  it('un cajón que no abre no deshace nada: devuelve el aviso y ya', async () => {
    const { app } = appCon(CON_CAJON, {
      pulso: { ok: false, codigo: 'IMPRESORA_DESCONECTADA', mensaje: 'sin conexión' },
    });
    const salida = await abrirCajonCon(app, COBRO, sinEspera);
    expect(salida).toMatchObject({ abierto: false, sinCajon: false });
    expect(typeof (salida as { mensaje?: unknown }).mensaje).toBe('string');
  });
});

describe('el mensaje dice la verdad', () => {
  const confirmado: EstadoDeImpresora = { soportado: true, enLinea: true, cajonAbierto: true };

  it('con la impresora confirmando por DLE EOT: «Cajón abierto»', async () => {
    const { app } = appCon(CON_CAJON, { estado: confirmado });
    const salida = await abrirCajonCon(app, MANUAL, sinEspera);
    expect(salida).toEqual({ abierto: true, confirmado: true });
    expect(textoDeLaApertura({ abierto: true, confirmado: true })).toBe(TEXTO_CAJON_ABIERTO);
    expect(TEXTO_CAJON_ABIERTO).toBe('Cajón abierto');
  });

  it('si la impresora no sabe decirlo: «Se mandó la señal al cajón»', async () => {
    const { app } = appCon(CON_CAJON, { estado: { soportado: false } });
    const salida = await abrirCajonCon(app, MANUAL, sinEspera);
    expect(salida).toEqual({ abierto: true, confirmado: false });
    expect(textoDeLaApertura({ abierto: true, confirmado: false })).toBe(TEXTO_SENAL_AL_CAJON);
    expect(TEXTO_SENAL_AL_CAJON).toBe('Se mandó la señal al cajón');
  });

  it('si dice que el cajón sigue cerrado, o no lo informa: sólo la señal', async () => {
    const cerrado = appCon(CON_CAJON, { estado: { soportado: true, cajonAbierto: false } });
    expect(await abrirCajonCon(cerrado.app, MANUAL, sinEspera)).toEqual({
      abierto: true,
      confirmado: false,
    });
    const mudo = appCon(CON_CAJON, { estado: { soportado: true, enLinea: true } });
    expect(await abrirCajonCon(mudo.app, MANUAL, sinEspera)).toEqual({
      abierto: true,
      confirmado: false,
    });
  });

  it('si preguntar el estado falla, no se inventa la confirmación ni se rompe la apertura', async () => {
    const { app } = appCon(CON_CAJON, { estado: new Error('sin respuesta') });
    expect(await abrirCajonCon(app, MANUAL, sinEspera)).toEqual({
      abierto: true,
      confirmado: false,
    });
  });

  it('espera un instante antes de preguntar el estado (el cajón tarda en saltar)', async () => {
    const esperas: number[] = [];
    const { app } = appCon(CON_CAJON, { estado: confirmado });
    await abrirCajonCon(app, MANUAL, (ms) => {
      esperas.push(ms);
      return Promise.resolve();
    });
    expect(esperas).toHaveLength(1);
    expect(esperas[0]).toBeGreaterThan(0);
  });

  it('al cobrar no consulta el estado: no hay nadie esperando el mensaje', async () => {
    const { app, consultasDeEstado } = appCon(CON_CAJON, { estado: confirmado });
    await abrirCajonCon(app, COBRO, sinEspera);
    expect(consultasDeEstado()).toBe(0);
  });
});
