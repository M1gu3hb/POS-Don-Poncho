import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { firmarSesion } from './token.ts';

const dobles = vi.hoisted(() => ({
  obtenerDb: vi.fn(() => ({ nombre: 'db-falsa' })),
  conTransaccion: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({ nombre: 'tx-falsa' }),
  ),
  vencimientoDeLaSesion: vi.fn(),
  renovarSesion: vi.fn(),
  resolverAmbito: vi.fn(),
  terminalActiva: vi.fn(),
  autorizaPresentacion: vi.fn(),
}));
vi.mock('./permisos-presentacion.ts', () => ({
  autorizaPresentacion: dobles.autorizaPresentacion,
}));

vi.mock('@morphiqpos/data', () => ({
  obtenerDb: dobles.obtenerDb,
  conTransaccion: dobles.conTransaccion,
  repoSesion: {
    vencimientoDeLaSesion: dobles.vencimientoDeLaSesion,
    renovarSesion: dobles.renovarSesion,
    resolverAmbito: dobles.resolverAmbito,
    terminalActiva: dobles.terminalActiva,
  },
}));

import { resolverSesion } from './resolver.ts';

const SECRETO = 'secreto-de-prueba-largo-y-distinto-del-real';
const SID = '0123456789abcdef0123456789abcdef';
const EMPLEO = '22222222-2222-4222-8222-222222222222';
const IDENTIDAD = '33333333-3333-4333-8333-333333333333';
const FUENTE =
  process.env['MORPHIQPOS_SESSION_RESOLVER_SOURCE_PATH'] ??
  fileURLToPath(new URL('./resolver.ts', import.meta.url));

const MINUTO_MS = 60_000;
const HORA_MS = 60 * MINUTO_MS;
/** Dentro de cuánto vence la fila del servidor que devuelve el doble. */
const venceEn = (ms: number): Date => new Date(Date.now() + ms);

function token(sid = SID, exp = 4_102_444_800): string {
  return firmarSesion(
    {
      sid,
      identidadId: IDENTIDAD,
      empleoId: EMPLEO,
      terminalId: null,
      exp,
    },
    SECRETO,
  );
}

function conRol(rol: string): void {
  dobles.resolverAmbito.mockResolvedValue({
    organizacionId: '11111111-1111-4111-8111-111111111111',
    sucursalId: null,
    identidadId: IDENTIDAD,
    empleoId: EMPLEO,
    rol,
    nombrePersona: 'Rosa',
    paquete: 'restaurante',
    nombreNegocio: 'Morphiq',
    nombreSucursal: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Por omisión, una sesión de mando recién usada: viva y sin nada que renovar.
  dobles.vencimientoDeLaSesion.mockResolvedValue(venceEn(30 * MINUTO_MS));
  dobles.autorizaPresentacion.mockResolvedValue(true);
  conRol('dueno');
});

describe('resolverSesion · registro revocable', () => {
  it('revocar la sesión del dueño general revoca también su contexto de demostración', async () => {
    const firmado = firmarSesion(
      {
        sid: SID,
        empleoId: EMPLEO,
        identidadId: IDENTIDAD,
        terminalId: null,
        exp: 4_102_444_800,
        presentador: {
          sid: 'sesion-dueno',
          empleoId: 'dueno-general',
          identidadId: 'identidad-dueno',
          terminalId: null,
        },
      },
      SECRETO,
    );
    expect(await resolverSesion({ token: firmado, secreto: SECRETO })).toEqual({
      ok: false,
      motivo: 'revocada',
    });
    expect(dobles.autorizaPresentacion).not.toHaveBeenCalled();
  });

  it('una concesión retirada invalida el contexto aunque las dos sesiones sigan activas', async () => {
    dobles.autorizaPresentacion.mockResolvedValueOnce(false);
    const firmado = firmarSesion(
      {
        sid: SID,
        empleoId: EMPLEO,
        identidadId: IDENTIDAD,
        terminalId: null,
        exp: 4_102_444_800,
        presentador: {
          sid: 'sesion-dueno',
          empleoId: 'dueno-general',
          identidadId: 'identidad-dueno',
          terminalId: null,
        },
      },
      SECRETO,
    );
    expect(await resolverSesion({ token: firmado, secreto: SECRETO })).toEqual({
      ok: false,
      motivo: 'revocada',
    });
  });

  it('el código consulta el registro antes de resolver el ámbito', () => {
    const codigo = readFileSync(FUENTE, 'utf8');
    const registro = codigo.indexOf('await repoSesion.vencimientoDeLaSesion');
    const ambito = codigo.indexOf('await repoSesion.resolverAmbito');

    expect(registro).toBeGreaterThan(-1);
    expect(ambito).toBeGreaterThan(registro);
  });

  it('rechaza una cookie bien firmada cuyo sid no está activo', async () => {
    dobles.vencimientoDeLaSesion.mockResolvedValueOnce(null);

    const resultado = await resolverSesion({ secreto: SECRETO, token: token() });

    expect(resultado).toEqual({ ok: false, motivo: 'revocada' });
    expect(dobles.vencimientoDeLaSesion).toHaveBeenCalledWith(
      expect.anything(),
      SID,
      EMPLEO,
      expect.any(Date),
    );
    expect(dobles.resolverAmbito).not.toHaveBeenCalled();
  });

  it('no acepta el sid activo de otro empleo', async () => {
    dobles.vencimientoDeLaSesion.mockResolvedValueOnce(null);

    const resultado = await resolverSesion({
      secreto: SECRETO,
      token: token('sid-de-otra-sesion'),
    });

    expect(resultado).toEqual({ ok: false, motivo: 'revocada' });
    expect(dobles.vencimientoDeLaSesion).toHaveBeenCalledWith(
      expect.anything(),
      'sid-de-otra-sesion',
      EMPLEO,
      expect.any(Date),
    );
  });

  it('resuelve el ámbito sólo después de comprobar el sid', async () => {
    const resultado = await resolverSesion({ secreto: SECRETO, token: token() });

    expect(resultado.ok).toBe(true);
    expect(dobles.vencimientoDeLaSesion.mock.invocationCallOrder[0]).toBeLessThan(
      dobles.resolverAmbito.mock.invocationCallOrder[0] ?? 0,
    );
  });
});

/**
 * DP-21 · Bloque 2 · La vigencia manda en el servidor y se renueva con el uso, según el puesto.
 */
describe('resolverSesion · la sesión vence en el servidor y se renueva con el uso', () => {
  /** A cuánto de «ahora» quedó el vencimiento que se mandó escribir. */
  function minutosRenovados(): number {
    const llamada = dobles.renovarSesion.mock.calls[0] as [unknown, string, Date] | undefined;
    if (llamada === undefined) throw new Error('la sesión no se renovó');
    expect(llamada[1]).toBe(SID);
    return Math.round((llamada[2].getTime() - Date.now()) / MINUTO_MS);
  }

  it('con la fila vencida en el servidor no hay sesión, aunque la cookie y el token sigan bien', async () => {
    // La cookie de un administrador que cerró la app hace 31 minutos: el token no llegó a su
    // tope, pero `vencimientoDeLaSesion` ya no la encuentra viva.
    conRol('administrador');
    dobles.vencimientoDeLaSesion.mockResolvedValueOnce(null);

    const resultado = await resolverSesion({ secreto: SECRETO, token: token() });

    expect(resultado).toEqual({ ok: false, motivo: 'revocada' });
    expect(dobles.renovarSesion).not.toHaveBeenCalled();
  });

  it('el administrador que sigue trabajando corre su vencimiento a 30 minutos de ahora', async () => {
    conRol('administrador');
    dobles.vencimientoDeLaSesion.mockResolvedValueOnce(venceEn(8 * MINUTO_MS));

    const resultado = await resolverSesion({ secreto: SECRETO, token: token() });

    expect(resultado.ok).toBe(true);
    expect(dobles.renovarSesion).toHaveBeenCalledTimes(1);
    expect(minutosRenovados()).toBe(30);
    // La escritura va por una transacción de la app, no suelta por la conexión de lectura.
    expect(dobles.conTransaccion).toHaveBeenCalledTimes(1);
  });

  it('no escribe en cada petición: una sesión recién renovada se deja como está', async () => {
    conRol('gerente');
    dobles.vencimientoDeLaSesion.mockResolvedValueOnce(venceEn(30 * MINUTO_MS - 5_000));

    const resultado = await resolverSesion({ secreto: SECRETO, token: token() });

    expect(resultado.ok).toBe(true);
    expect(dobles.renovarSesion).not.toHaveBeenCalled();
    expect(dobles.conTransaccion).not.toHaveBeenCalled();
  });

  it('el cajero no se renueva: su sesión es la jornada, 12 h desde su PIN', async () => {
    conRol('cajero');
    dobles.vencimientoDeLaSesion.mockResolvedValueOnce(venceEn(20 * MINUTO_MS));

    const resultado = await resolverSesion({ secreto: SECRETO, token: token() });

    expect(resultado.ok).toBe(true);
    expect(dobles.renovarSesion).not.toHaveBeenCalled();
  });

  it('el mesero que sigue trabajando corre su vencimiento a 12 horas de ahora', async () => {
    conRol('mesero');
    dobles.vencimientoDeLaSesion.mockResolvedValueOnce(venceEn(3 * HORA_MS));

    const resultado = await resolverSesion({ secreto: SECRETO, token: token() });

    expect(resultado.ok).toBe(true);
    expect(minutosRenovados()).toBe(12 * 60);
  });

  it('nunca renueva más allá del tope del token', async () => {
    conRol('dueno');
    dobles.vencimientoDeLaSesion.mockResolvedValueOnce(venceEn(2 * MINUTO_MS));
    const topeEnDiezMinutos = Math.floor((Date.now() + 10 * MINUTO_MS) / 1000);

    const resultado = await resolverSesion({
      secreto: SECRETO,
      token: token(SID, topeEnDiezMinutos),
    });

    expect(resultado.ok).toBe(true);
    expect(minutosRenovados()).toBe(10);
  });

  it('una sesión que no resuelve su ámbito no se renueva', async () => {
    dobles.vencimientoDeLaSesion.mockResolvedValueOnce(venceEn(5 * MINUTO_MS));
    dobles.resolverAmbito.mockResolvedValueOnce(null);

    const resultado = await resolverSesion({ secreto: SECRETO, token: token() });

    expect(resultado).toEqual({ ok: false, motivo: 'revocada' });
    expect(dobles.renovarSesion).not.toHaveBeenCalled();
  });
});
