import { createHmac, randomUUID } from 'node:crypto';

import { obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { vaciarElCarrito } from '../restaurante/carrito-del-mesero.ts';
import { agregarAlCarrito } from './carrito-comandos.ts';
import { servirElCarrito } from './carrito-http.ts';
import { ejecutarComandoPublico } from './comando-publico.ts';
import { LIMITES_PORTAL } from './limite.ts';
import type { PeticionDelPortal } from './http.ts';
import { mesaConPortal } from './pruebas/mesa-con-portal.ts';
import { ambitoDelPersonal } from './pruebas/personal-de-la-mesa.ts';
import { telefonoFirmado } from './telefono.ts';

/**
 * DP-13.3 · EL SONDEO POR HTTP, de punta a punta en el servidor (sin navegador): el teléfono llega sin
 * id y el servidor le emite uno firmado; con uno bueno no emite nada; con uno falso, otro; emitir
 * tiene límite por mesa; y la noticia de «el mesero vació el pedido» sale por el mismo sondeo, una vez.
 */

const HOST = 'www.pos-mh-astral-systems.com';
const PIMIENTA_HTTP = 'pimienta_de_integracion_del_sondeo_0123456789';

vi.mock('@morphiqpos/contracts', async (original) => ({
  ...(await original<typeof import('@morphiqpos/contracts')>()),
  validarEntorno: () => ({
    PIN_PEPPER: 'pimienta_de_integracion_del_sondeo_0123456789',
    APP_URL: `https://${HOST}`,
    ORGANIZACION: process.env['ORGANIZACION'],
  }),
}));

const organizacionAntes = process.env['ORGANIZACION'];
let caso: Awaited<ReturnType<typeof mesaConPortal>>;

beforeAll(async () => {
  caso = await mesaConPortal({ envian: 'mesero' });
  const { slug } = await obtenerDb()
    .selectFrom('organizaciones')
    .select('slug')
    .where('id', '=', caso.negocio.organizacionId)
    .executeTakeFirstOrThrow();
  process.env['ORGANIZACION'] = slug;
});

afterAll(() => {
  if (organizacionAntes === undefined) delete process.env['ORGANIZACION'];
  else process.env['ORGANIZACION'] = organizacionAntes;
});

function peticion(cuerpo: unknown, ip: string = randomUUID()): PeticionDelPortal {
  const cabeceras = new Map([
    ['content-type', 'application/json'],
    ['content-length', String(JSON.stringify(cuerpo).length)],
    ['x-morphiqpos-request', '1'],
    ['host', HOST],
    ['x-forwarded-for', ip],
  ]);
  return {
    method: 'POST',
    url: `https://${HOST}/api/publico/qr/${caso.qrToken}/carrito`,
    headers: { get: (nombre: string) => cabeceras.get(nombre.toLowerCase()) ?? null },
    json: () => Promise.resolve(cuerpo),
  };
}

interface Datos {
  readonly dispositivoEmitido?: string;
  readonly lineas: readonly unknown[];
  readonly vaciadoPorElMesero: { readonly en: string } | null;
}

async function sondear(cuerpo: unknown, ip?: string) {
  const salida = await servirElCarrito(caso.qrToken, peticion(cuerpo, ip));
  const sobre = salida.cuerpo as {
    ok: boolean;
    datos?: Datos;
    error?: { datos?: { regla?: string } };
  };
  return { estado: salida.estado, sobre };
}

describe('el sondeo emite el id del teléfono', () => {
  it('sin id: lo emite firmado con la pimienta del servidor y se lo da al teléfono', async () => {
    const { estado, sobre } = await sondear({});
    expect(estado).toBe(200);
    const id = sobre.datos?.dispositivoEmitido;
    expect(id).toBeDefined();
    expect(telefonoFirmado(PIMIENTA_HTTP, id)).toBe(true);
    expect(sobre.datos?.lineas).toEqual([]);
  });

  it('con el id bueno: no emite otro (el teléfono sigue siendo el mismo)', async () => {
    const primero = await sondear({});
    const id = primero.sobre.datos?.dispositivoEmitido ?? '';
    const segundo = await sondear({ dispositivo: id });
    expect(segundo.estado).toBe(200);
    expect(segundo.sobre.datos?.dispositivoEmitido).toBeUndefined();
  });

  it('con un id inventado (o de antes de las firmas): emite uno nuevo y no cuenta el falso', async () => {
    const falso = 'inventado_0123456789abcdef';
    const { estado, sobre } = await sondear({ dispositivo: falso });
    expect(estado).toBe(200);
    const id = sobre.datos?.dispositivoEmitido ?? '';
    expect(id).not.toBe(falso);
    expect(telefonoFirmado(PIMIENTA_HTTP, id)).toBe(true);
  });

  it('emitir cuenta contra la IP del teléfono (la última de x-forwarded-for) y contra la mesa', async () => {
    const ip = randomUUID();
    await sondear({}, ip);
    const claveDe = (accion: string, quien: string) =>
      createHmac('sha256', PIMIENTA_HTTP).update(`portal:${accion}:${quien}`, 'utf8').digest('hex');
    const cuenta = async (clave: string) =>
      (
        await obtenerDb()
          .selectFrom('limite_tasa')
          .select('intentos')
          .where('clave', '=', clave)
          .executeTakeFirst()
      )?.intentos;
    expect(await cuenta(claveDe('telefono_nuevo_ip', ip))).toBe(1);
    // Con un id bueno no se gasta nada de la cuota de emitir.
    const id = (await sondear({}, ip)).sobre.datos?.dispositivoEmitido ?? '';
    await sondear({ dispositivo: id }, ip);
    expect(await cuenta(claveDe('telefono_nuevo_ip', ip))).toBe(2);
    expect(await cuenta(claveDe('telefono_nuevo_mesa', caso.qrToken))).toBeGreaterThanOrEqual(2);
  });

  it('un cuerpo que no es de teléfono se rechaza como entrada inválida', async () => {
    const { estado } = await sondear({ dispositivo: 'x'.repeat(65) });
    expect(estado).toBe(400);
    expect((await sondear({ otro: 1 })).estado).toBe(400);
  });

  it('emitir tiene límite por mesa: pasado, 429; el teléfono que ya tiene id sigue leyendo', async () => {
    const conId = (await sondear({})).sobre.datos?.dispositivoEmitido ?? '';
    // Se deja el cubo de la mesa a UN intento de agotarse (sin repetir 40 sondeos).
    const clave = createHmac('sha256', PIMIENTA_HTTP)
      .update(`portal:telefono_nuevo_mesa:${caso.qrToken}`, 'utf8')
      .digest('hex');
    const gastados = LIMITES_PORTAL.telefono_nuevo_mesa.intentos - 1;
    await sql`
      insert into limite_tasa (clave, ventana_en, intentos) values (${clave}, now(), ${gastados})
      on conflict (clave) do update set intentos = excluded.intentos, ventana_en = excluded.ventana_en
    `.execute(obtenerDb());
    expect((await sondear({})).estado).toBe(200);
    const negado = await sondear({});
    expect(negado.estado).toBe(429);
    expect(negado.sobre.error?.datos?.regla).toBe('QR_DEMASIADAS_PETICIONES');
    expect((await sondear({ dispositivo: conId })).estado).toBe(200);
  });
});

describe('la noticia del vaciado sale por el sondeo, una vez', () => {
  it('el mesero vacía y el siguiente sondeo del teléfono lo trae; el otro ya no', async () => {
    const mesa = await mesaConPortal({ envian: 'mesero' });
    const { slug } = await obtenerDb()
      .selectFrom('organizaciones')
      .select('slug')
      .where('id', '=', mesa.negocio.organizacionId)
      .executeTakeFirstOrThrow();
    process.env['ORGANIZACION'] = slug;
    const sondearMesa = async (cuerpo: unknown) => {
      const salida = await servirElCarrito(mesa.qrToken, {
        ...peticion(cuerpo),
        url: `https://${HOST}/api/publico/qr/${mesa.qrToken}/carrito`,
      });
      return (salida.cuerpo as { datos?: Datos }).datos;
    };
    const id = (await sondearMesa({}))?.dispositivoEmitido ?? '';
    exigirOk(
      await ejecutarComandoPublico(agregarAlCarrito, {
        token: mesa.qrToken,
        organizacionId: mesa.negocio.organizacionId,
        entrada: { dispositivo: id, item: { productoId: mesa.taco, cantidad: '1', notas: '' } },
        idempotencyKey: clave(),
        pimienta: PIMIENTA_HTTP,
      }),
      'agregar',
    );
    exigirOk(
      await comando(vaciarElCarrito, {
        ambito: await ambitoDelPersonal(mesa, 'mesero'),
        entrada: { mesaId: mesa.mesaId },
        idempotencyKey: clave(),
      }),
      'vaciar',
    );
    expect((await sondearMesa({ dispositivo: id }))?.vaciadoPorElMesero).not.toBeNull();
    expect((await sondearMesa({ dispositivo: id }))?.vaciadoPorElMesero).toBeNull();
  });
});
