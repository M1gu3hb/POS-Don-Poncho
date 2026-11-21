import { randomBytes, randomUUID } from 'node:crypto';

import type { Rol } from '@morphiqpos/contracts';
import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { comando } from '../produccion.ts';
import { ambitoDe, clave, exigirOk, sembrarNegocio, type NegocioReal } from '../pruebas/negocio-real.ts';
import { establecerPin } from './comandos.ts';
import { firmarAutorizacion } from './supervisor.ts';
import { pinesVisibles, verElPin } from './ver-el-pin.ts';

/**
 * DP-25 · Parte 7 · EL DUEÑO VE EL PIN DE SU GENTE, contra Postgres.
 *
 * El PIN se sigue guardando como hash para entrar; al ponerlo se guarda además una copia cifrada
 * (AES-256-GCM, llave sólo en el entorno). Verla es del DUEÑO, con su propio PIN, una vez por firma, y
 * cada vista queda en la auditoría (quién vio el de quién y cuándo; nunca el PIN). Sin llave la función
 * se apaga sola y poner el PIN sigue igual.
 */

const ENTORNO = vi.hoisted(() => ({
  PIN_PEPPER: 'pimienta_de_integracion_de_ver_el_pin_2026',
  SESSION_SECRET: 'secreto_de_integracion_de_ver_el_pin_2026_xx',
  PIN_CIFRADO_CLAVE: undefined as string | undefined,
}));
vi.mock('@morphiqpos/contracts', async (original) => ({
  ...(await original<typeof import('@morphiqpos/contracts')>()),
  validarEntorno: () => ENTORNO,
}));

const LLAVE = randomBytes(32).toString('base64');
const PIN_DEL_MESERO = '482613';

let negocio: NegocioReal;
let ambito: ReturnType<typeof ambitoDe>;
const gente: Record<string, { empleoId: string; identidadId: string }> = {};

async function sembrarPersona(nombre: string, rol: Rol) {
  const ids = { persona: randomUUID(), identidadId: randomUUID(), empleoId: randomUUID() };
  await conTransaccion(async (tx) => {
    await tx
      .insertInto('personas')
      .values({ id: ids.persona, organizacion_id: negocio.organizacionId, nombre })
      .execute();
    await tx.insertInto('identidades').values({ id: ids.identidadId, persona_id: ids.persona }).execute();
    await tx
      .insertInto('empleos')
      .values({ id: ids.empleoId, persona_id: ids.persona, organizacion_id: negocio.organizacionId, rol })
      .execute();
  });
  return { empleoId: ids.empleoId, identidadId: ids.identidadId };
}

const copiaDe = async (identidadId: string) =>
  (
    await obtenerDb()
      .selectFrom('credenciales_pin')
      .select(['pin_cifrado', 'pin_hash'])
      .where('identidad_id', '=', identidadId)
      .executeTakeFirstOrThrow()
  );

const ponerPin = (empleado: string, pin: string) =>
  comando(establecerPin, { entrada: { empleado, pin }, ambito, idempotencyKey: clave() });

/** Lo que firma `/api/identidad/supervisor` cuando el dueño teclea SU PIN para ver uno. */
const suFirma = (supervisor = negocio.empleoId, rol: Rol = 'dueno') =>
  firmarAutorizacion(
    {
      org: negocio.organizacionId,
      supervisor,
      rol,
      solicita: negocio.empleoId,
      exp: Math.floor(Date.now() / 1000) + 120,
      n: `ver-${clave().slice(0, 8)}`,
      para: 'ver_pin',
    },
    ENTORNO.SESSION_SECRET,
  );

const ver = (empleado: string, autorizacion: string, como = ambito) =>
  comando(verElPin, { entrada: { empleado, autorizacion }, ambito: como, idempotencyKey: clave() });

const codigo = (r: { ok: boolean; error?: { codigo: string; datos?: Readonly<Record<string, unknown>> } }) =>
  r.ok ? 'ok' : (typeof r.error?.datos?.['regla'] === 'string' ? (r.error.datos['regla'] as string) : r.error?.codigo);

beforeAll(async () => {
  negocio = await sembrarNegocio({
    nombre: 'Fonda que olvida los PIN',
    rol: 'dueno',
    giro: 'restaurante',
    paquete: 'restaurante',
  });
  ambito = ambitoDe(negocio, null, null);
  for (const [nombre, rol] of [
    ['Lupita', 'mesero'],
    ['Gema', 'gerente'],
    ['Ana', 'administrador'],
    ['Rosa', 'cajero'],
    ['Memo', 'mesero'],
  ] as const) {
    gente[nombre] = await sembrarPersona(nombre, rol);
  }
});

describe('el dueño ve el PIN de su gente', () => {
  it('al poner el PIN se guarda una copia cifrada, y el PIN nunca queda a la vista', async () => {
    ENTORNO.PIN_CIFRADO_CLAVE = LLAVE;
    exigirOk(await ponerPin(gente['Lupita']?.empleoId ?? '', PIN_DEL_MESERO), 'identidad.establecer_pin');
    const fila = await copiaDe(gente['Lupita']?.identidadId ?? '');
    expect(fila.pin_cifrado).toMatch(/^v1\./);
    expect(fila.pin_cifrado).not.toContain(PIN_DEL_MESERO);
    expect(fila.pin_hash).not.toContain(PIN_DEL_MESERO);
  });

  it('el dueño lo ve con SU firma; la vista queda en la auditoría, sin el PIN', async () => {
    ENTORNO.PIN_CIFRADO_CLAVE = LLAVE;
    const visto = exigirOk(await ver(gente['Lupita']?.empleoId ?? '', suFirma()), 'identidad.ver_pin');
    expect(visto).toEqual({ disponible: true, pin: PIN_DEL_MESERO });
    const rastro = await obtenerDb()
      .selectFrom('auditoria')
      .select(['payload', 'entidad_id'])
      .where('organizacion_id', '=', negocio.organizacionId)
      .where('accion', '=', 'identidad.ver_pin')
      .orderBy('created_at', 'desc')
      .executeTakeFirstOrThrow();
    expect(rastro.entidad_id).toBe(gente['Lupita']?.empleoId);
    expect(rastro.payload).toMatchObject({ vio: negocio.empleoId, aQuien: 'Lupita' });
    expect(JSON.stringify(rastro.payload)).not.toContain(PIN_DEL_MESERO);
    // Ni en ninguna otra fila de la auditoría de este negocio.
    const conElPin = await sql<{ n: string }>`
      select count(*)::text as n from auditoria
       where organizacion_id = ${negocio.organizacionId} and payload::text like ${`%${PIN_DEL_MESERO}%`}`.execute(
      obtenerDb(),
    );
    expect(conElPin.rows[0]?.n).toBe('0');
  });

  it('cada firma sirve para UNA vista', async () => {
    ENTORNO.PIN_CIFRADO_CLAVE = LLAVE;
    const firma = suFirma();
    expect(codigo(await ver(gente['Lupita']?.empleoId ?? '', firma))).toBe('ok');
    expect(codigo(await ver(gente['Lupita']?.empleoId ?? '', firma))).toBe('AUTORIZACION_USADA');
  });

  it('la firma de OTRA persona no sirve: el dueño teclea el suyo', async () => {
    ENTORNO.PIN_CIFRADO_CLAVE = LLAVE;
    const deGema = suFirma(gente['Gema']?.empleoId, 'gerente');
    expect(codigo(await ver(gente['Lupita']?.empleoId ?? '', deGema))).toBe('PUESTO_NO_OTORGABLE');
  });

  it('nadie más lo ve: el servidor lo rechaza para cualquier otro puesto', async () => {
    ENTORNO.PIN_CIFRADO_CLAVE = LLAVE;
    for (const nombre of ['Gema', 'Ana', 'Rosa', 'Memo']) {
      const persona = gente[nombre];
      const rol = (await obtenerDb()
        .selectFrom('empleos')
        .select('rol')
        .where('id', '=', persona?.empleoId ?? '')
        .executeTakeFirstOrThrow()).rol as Rol;
      const como = { ...ambito, empleoId: persona?.empleoId ?? '', rol };
      expect(codigo(await ver(gente['Lupita']?.empleoId ?? '', suFirma(), como))).toBe('SIN_PERMISO');
      const lista = await comando(pinesVisibles, { entrada: {}, ambito: como });
      expect(codigo(lista)).toBe('SIN_PERMISO');
    }
  });

  it('el PIN de antes (sin copia) dice «No disponible»', async () => {
    ENTORNO.PIN_CIFRADO_CLAVE = undefined;
    exigirOk(await ponerPin(gente['Memo']?.empleoId ?? '', '9031'), 'identidad.establecer_pin');
    ENTORNO.PIN_CIFRADO_CLAVE = LLAVE;
    expect(exigirOk(await ver(gente['Memo']?.empleoId ?? '', suFirma()), 'identidad.ver_pin')).toEqual({
      disponible: false,
      motivo: 'sin_copia',
    });
    const lista = exigirOk(await comando(pinesVisibles, { entrada: {}, ambito }), 'identidad.pines_visibles');
    expect(lista.activa).toBe(true);
    expect(lista.conCopia).toContain(gente['Lupita']?.empleoId);
    expect(lista.conCopia).not.toContain(gente['Memo']?.empleoId);
  });

  it('sin la llave la función se apaga, poner el PIN sigue igual y la copia vieja se borra', async () => {
    ENTORNO.PIN_CIFRADO_CLAVE = undefined;
    exigirOk(await ponerPin(gente['Lupita']?.empleoId ?? '', '7700'), 'identidad.establecer_pin');
    expect((await copiaDe(gente['Lupita']?.identidadId ?? '')).pin_cifrado).toBeNull();
    expect(exigirOk(await comando(pinesVisibles, { entrada: {}, ambito }), 'identidad.pines_visibles')).toEqual({
      activa: false,
      conCopia: [],
    });
    expect(exigirOk(await ver(gente['Lupita']?.empleoId ?? '', suFirma()), 'identidad.ver_pin')).toEqual({
      disponible: false,
      motivo: 'apagada',
    });
  });
});
