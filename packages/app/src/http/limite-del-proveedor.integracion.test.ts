import { randomInt, randomUUID } from 'node:crypto';

import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { dejarRastroDelBloqueo, ACCION_BLOQUEAR } from '../identidad/proveedor.ts';
import { sembrarNegocio, type NegocioReal } from '../pruebas/negocio-real.ts';
import { esElPrimerRechazo, LIMITES, permitir } from './limite.ts';

/**
 * X4 (DP-D125) · EL TOPE DE LA ENTRADA DEL LABORATORIO DEL PROVEEDOR ES POR IP (Postgres real).
 *
 * `/api/proveedor/entrar` cuenta el intento ANTES de comparar la contraseña, en un cubo que se
 * llama con el HMAC de «proveedor:IP». Lo que se prueba aquí, contra la base y sin sustitutos:
 *
 *   · una IP que falla cinco veces queda bloqueada quince minutos aunque cambie de negocio, de
 *     sesión, de cookie o de agente de usuario: el cubo no mira nada más que el origen;
 *   · otra IP no queda bloqueada por ella;
 *   · el intento rechazado por el tope (429) deja UNA fila en la auditoría por ventana (no una
 *     por cada petición: una persona con sesión no puede llenar la auditoría golpeando el 429).
 */

const PIMIENTA = 'pimienta-de-las-pruebas-de-integracion-0123456789';
const INTENTOS = LIMITES.proveedor.intentos;
const VENTANA = LIMITES.proveedor.ventanaSegundos;

/** Una IP de la prueba que no se repite entre corridas (la tabla de límites persiste). */
const nuevaIp = (): string => `198.51.100.${randomUUID().slice(0, 8)}`;

const desde = (ip: string, extra: Record<string, string> = {}): Headers =>
  new Headers({ 'x-forwarded-for': ip, ...extra });

let negocio: NegocioReal;
beforeAll(async () => {
  negocio = await sembrarNegocio({ nombre: 'Fonda del proveedor', rol: 'gerente' });
}, 60_000);

describe('el cubo es el de la IP', () => {
  it('cinco intentos pasan; el sexto y los siguientes quedan bloqueados con su espera', async () => {
    const ip = nuevaIp();
    for (let i = 1; i <= INTENTOS; i += 1) {
      expect((await permitir('proveedor', desde(ip), PIMIENTA)).ok, `intento ${String(i)}`).toBe(
        true,
      );
    }
    const sexto = await permitir('proveedor', desde(ip), PIMIENTA);
    const septimo = await permitir('proveedor', desde(ip), PIMIENTA);

    expect(sexto.ok).toBe(false);
    expect(septimo.ok).toBe(false);
    expect(sexto.esperaSegundos).toBeGreaterThan(0);
    expect(sexto.esperaSegundos).toBeLessThanOrEqual(VENTANA);
  });

  it('cambiar de negocio, de sesión, de cookie o de agente NO libra a la IP bloqueada', async () => {
    const ip = nuevaIp();
    for (let i = 0; i < INTENTOS; i += 1) await permitir('proveedor', desde(ip), PIMIENTA);

    const disfrazadas = [
      desde(ip, { cookie: `sesion=${randomUUID()}`, 'user-agent': 'otro aparato' }),
      desde(ip, { 'x-morphiqpos-negocio': randomUUID(), 'x-correlation-id': randomUUID() }),
      desde(ip, { authorization: `Bearer ${randomUUID()}` }),
    ];
    for (const cabeceras of disfrazadas) {
      expect((await permitir('proveedor', cabeceras, PIMIENTA)).ok).toBe(false);
    }
  });

  it('otra IP no queda bloqueada por la primera', async () => {
    const mala = nuevaIp();
    for (let i = 0; i < INTENTOS + 2; i += 1) await permitir('proveedor', desde(mala), PIMIENTA);

    const buena = await permitir('proveedor', desde(nuevaIp()), PIMIENTA);

    expect(buena.ok).toBe(true);
    expect(buena.intentos).toBe(1);
  });

  it('el origen es el que añade el proxy más cercano: una lista falsa por delante no lo cambia', async () => {
    const ip = nuevaIp();
    for (let i = 0; i < INTENTOS; i += 1) await permitir('proveedor', desde(ip), PIMIENTA);

    const conLaFalsa = desde(`203.0.113.${String(randomInt(1, 200))}, ${ip}`);

    expect((await permitir('proveedor', conLaFalsa, PIMIENTA)).ok).toBe(false);
  });

  it('el cubo del proveedor no es el de «entrar»: fallar la contraseña no gasta los PIN', async () => {
    const ip = nuevaIp();
    for (let i = 0; i < INTENTOS + 1; i += 1) await permitir('proveedor', desde(ip), PIMIENTA);

    expect((await permitir('entrar', desde(ip), PIMIENTA)).ok).toBe(true);
  });
});

describe('sólo el primer rechazo de la ventana deja rastro', () => {
  it('de las peticiones bloqueadas, exactamente una es «el primer rechazo»', async () => {
    const ip = nuevaIp();
    const rechazos: boolean[] = [];
    for (let i = 0; i < INTENTOS + 4; i += 1) {
      const permiso = await permitir('proveedor', desde(ip), PIMIENTA);
      rechazos.push(esElPrimerRechazo('proveedor', permiso));
    }
    expect(rechazos.filter(Boolean)).toHaveLength(1);
    expect(rechazos.indexOf(true)).toBe(INTENTOS);
  });
});

describe('el 429 deja su fila en la auditoría', () => {
  it('«proveedor.bloquear» con quién, de qué aparato y cuánto espera, sin la contraseña', async () => {
    const correlationId = randomUUID();
    await dejarRastroDelBloqueo(
      {
        organizacionId: negocio.organizacionId,
        identidadId: negocio.identidadId,
        terminalId: null,
        empleoId: negocio.empleoId,
        rol: negocio.rol,
        correlationId,
      },
      840,
    );

    const filas = await obtenerDb()
      .selectFrom('auditoria')
      .select(['accion', 'entidad', 'identidad_id', 'payload'])
      .where('organizacion_id', '=', negocio.organizacionId)
      .where('correlation_id', '=', correlationId)
      .execute();

    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      accion: ACCION_BLOQUEAR,
      entidad: 'laboratorio_de_impresion',
      identidad_id: negocio.identidadId,
    });
    expect(ACCION_BLOQUEAR).toBe('proveedor.bloquear');
    const payload = JSON.stringify(filas[0]?.payload);
    expect(payload).toContain('840');
    expect(payload).not.toMatch(/clave|contrase/i);
  });
});
