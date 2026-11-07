import type { Ambito, Resultado } from '@morphiqpos/contracts';
import { conTransaccion } from '@morphiqpos/data';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { firmarAutorizacion, type CargaDeAutorizacion } from '../identidad/supervisor.ts';
import { comando } from '../produccion.ts';
import { clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { permitirDescuentos } from '../venta/descuentos-permitidos.ts';
import { descontarCuenta, type ResultadoDescuentoDeCuenta } from './descuento-de-cuenta.ts';
import {
  abrirLasCajas,
  ambitoDeCaja,
  pedirLaCuenta,
  sembrarSalon,
  sentarYPedir,
  type Salon,
} from './pruebas/salon-real.ts';

/**
 * LOS DESCUENTOS CON CLAVE, contra Postgres (DP-14.2, decisión DP-D61).
 *
 * Lo que decidió Miguel: todo descuento pide el PIN de un gerente, administrador o dueño, aunque
 * sea de $1, y aunque quien tiene la sesión sea gerente (vuelve a teclear el suyo). La autorización
 * va atada a la cuenta y al MONTO, y se gasta al usarla. El límite es el tope del puesto de quien
 * autoriza. Y el negocio puede apagar los descuentos: entonces el servidor los rechaza con su
 * propio código, haya PIN o no.
 *
 * El secreto con que se firma sale de `validarEntorno`, que en esta suite no tiene el entorno del
 * servidor: se sustituye sólo esa función (como en `descuento-de-mostrador.integracion.test.ts`).
 */

const SECRETO = 'secreto_de_integracion_de_los_descuentos_con_clave_2026';
vi.mock('@morphiqpos/contracts', async (original) => ({
  ...(await original<typeof import('@morphiqpos/contracts')>()),
  validarEntorno: () => ({ SESSION_SECRET: SECRETO }),
}));

/** Siembra el salón y cobra por los comandos de producción: bajo carga, 30 s no alcanzan. */
const POR_COMANDOS = 120_000;

let salon: Salon;
let gerenteId = '';
let duenoId = '';
let mesaLibre = 0;

/** Una cuenta de dos arracheras ($659.80) pedida en una mesa nueva. */
async function cuentaPedida(): Promise<string> {
  const { ordenId } = await sentarYPedir(salon, mesaLibre, [
    { platillo: 'arrachera', cantidad: '2' },
  ]);
  mesaLibre += 1;
  await pedirLaCuenta(salon, ordenId);
  return ordenId;
}

function firma(
  quien: { readonly empleoId: string; readonly rol: string },
  solicita: string,
  ordenId: string,
  montoCentavos: number | null,
  n = clave(),
): string {
  const carga: CargaDeAutorizacion = {
    org: salon.negocio.organizacionId,
    supervisor: quien.empleoId,
    rol: quien.rol,
    solicita,
    exp: Math.floor(Date.now() / 1000) + 120,
    n,
    cuenta: ordenId,
    para: 'descuento',
    ...(montoCentavos === null ? {} : { monto: String(montoCentavos) }),
  };
  return firmarAutorizacion(carga, SECRETO);
}

const cajera = (): Ambito => ambitoDeCaja(salon);
const gerente = (): Ambito => ({ ...ambitoDeCaja(salon), rol: 'gerente', empleoId: gerenteId });
const dueno = (): Ambito => ({ ...ambitoDeCaja(salon), rol: 'dueno', empleoId: duenoId });

function descontar(
  ambito: Ambito,
  ordenId: string,
  descuentoCentavos: number,
  autorizacion?: string,
): Promise<Resultado<ResultadoDescuentoDeCuenta>> {
  return comando(descontarCuenta, {
    entrada: {
      ordenId,
      descuentoCentavos,
      motivo: 'Cliente frecuente',
      ...(autorizacion === undefined ? {} : { autorizacion }),
    },
    ambito,
    idempotencyKey: clave(),
  });
}

/** El código del dominio: `comando` lo entrega como `REGLA_DE_NEGOCIO` con su `regla`. */
function codigo<T>(resultado: Resultado<T>): string | null {
  if (resultado.ok) return null;
  const regla = (resultado.error.datos as { readonly regla?: unknown } | undefined)?.regla;
  return typeof regla === 'string' ? regla : resultado.error.codigo;
}

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Restaurante de la clave', mesas: 12 });
  gerenteId = await sembrarCompanero(salon.negocio, { nombre: 'La Gerente', rol: 'gerente' });
  duenoId = await sembrarCompanero(salon.negocio, { nombre: 'Don Poncho', rol: 'dueno' });
  await abrirLasCajas(salon);
}, POR_COMANDOS);

describe('todo descuento pide la clave de quien autoriza', () => {
  it(
    'sin autorización no se descuenta ni $1: ni la cajera ni la gerente con su sesión',
    { timeout: POR_COMANDOS },
    async () => {
      const ordenId = await cuentaPedida();
      expect(codigo(await descontar(cajera(), ordenId, 100))).toBe('PUESTO_NO_OTORGABLE');
      expect(codigo(await descontar(gerente(), ordenId, 100))).toBe('PUESTO_NO_OTORGABLE');
    },
  );

  it(
    'con el PIN de la gerente para $20 se aplican $20, y no $100 ni $19.99',
    { timeout: POR_COMANDOS },
    async () => {
      const ordenId = await cuentaPedida();
      const veinte = firma(
        { empleoId: gerenteId, rol: 'gerente' },
        salon.negocio.empleoId,
        ordenId,
        2_000,
      );
      // $100 cabe en el tope de la gerente (15 %): se rechaza sólo porque el PIN fue para $20.
      expect(codigo(await descontar(cajera(), ordenId, 10_000, veinte))).toBe(
        'PUESTO_NO_OTORGABLE',
      );
      expect(codigo(await descontar(cajera(), ordenId, 1_999, veinte))).toBe('PUESTO_NO_OTORGABLE');
      const hecho = exigirOk(await descontar(cajera(), ordenId, 2_000, veinte), 'descontar');
      expect(hecho).toMatchObject({
        descuentoCentavos: '2000',
        totalCentavos: '63980',
        autorizadoPor: gerenteId,
      });
    },
  );

  it('una autorización firmada sin monto no sirve', { timeout: POR_COMANDOS }, async () => {
    const ordenId = await cuentaPedida();
    const sinMonto = firma(
      { empleoId: gerenteId, rol: 'gerente' },
      salon.negocio.empleoId,
      ordenId,
      null,
    );
    expect(codigo(await descontar(cajera(), ordenId, 2_000, sinMonto))).toBe('PUESTO_NO_OTORGABLE');
  });

  it(
    'la autorización se gasta: reusarla para el mismo monto se rechaza',
    { timeout: POR_COMANDOS },
    async () => {
      const ordenId = await cuentaPedida();
      const token = firma(
        { empleoId: gerenteId, rol: 'gerente' },
        salon.negocio.empleoId,
        ordenId,
        1_000,
      );
      exigirOk(await descontar(cajera(), ordenId, 1_000, token), 'primer uso');
      expect(codigo(await descontar(cajera(), ordenId, 1_000, token))).toBe('AUTORIZACION_USADA');
    },
  );

  it(
    'dos usos a la vez de la misma autorización: entra uno solo',
    { timeout: POR_COMANDOS },
    async () => {
      const ordenA = await cuentaPedida();
      const token = firma(
        { empleoId: gerenteId, rol: 'gerente' },
        salon.negocio.empleoId,
        ordenA,
        1_500,
      );
      const [uno, otro] = await Promise.all([
        descontar(cajera(), ordenA, 1_500, token),
        descontar(cajera(), ordenA, 1_500, token),
      ]);
      const codigos = [codigo(uno), codigo(otro)].sort();
      expect(codigos).toEqual(['AUTORIZACION_USADA', null].sort());
    },
  );

  it(
    'la gerente con su sesión abierta vuelve a teclear SU PIN, y entra',
    { timeout: POR_COMANDOS },
    async () => {
      const ordenId = await cuentaPedida();
      const suyo = firma({ empleoId: gerenteId, rol: 'gerente' }, gerenteId, ordenId, 5_000);
      const hecho = exigirOk(await descontar(gerente(), ordenId, 5_000, suyo), 'descontar');
      expect(hecho.autorizadoPor).toBe(gerenteId);
    },
  );

  it(
    'el límite es el tope de quien autoriza: la gerente 30 %, el dueño 100 %',
    { timeout: POR_COMANDOS },
    async () => {
      const ordenId = await cuentaPedida();
      // 40 % de $659.80 = $263.92.
      const deLaGerente = firma(
        { empleoId: gerenteId, rol: 'gerente' },
        salon.negocio.empleoId,
        ordenId,
        26_392,
      );
      expect(codigo(await descontar(cajera(), ordenId, 26_392, deLaGerente))).toBe(
        'PUESTO_NO_OTORGABLE',
      );
      const delDueno = firma(
        { empleoId: duenoId, rol: 'dueno' },
        salon.negocio.empleoId,
        ordenId,
        26_392,
      );
      exigirOk(await descontar(cajera(), ordenId, 26_392, delDueno), 'descontar');
    },
  );

  it(
    'el respaldo de los topes va por puesto: con una fila sólo de la cajera, la gerente sigue en 30 %',
    { timeout: POR_COMANDOS },
    async () => {
      await conTransaccion((tx) =>
        tx
          .insertInto('topes_descuento')
          .values({
            organizacion_id: salon.negocio.organizacionId,
            rol: 'cajero',
            tope_centavos: 5_000n,
            tope_bp: 1_000,
          })
          .execute(),
      );
      const ordenId = await cuentaPedida();
      // 20 % = $131.96: cabe en el 30 % de la gerente. Con «sólo si no hay ninguna fila», su tope
      // caía a cero en cuanto alguien escribía la de la cajera (QA2-009 otra vez).
      const token = firma(
        { empleoId: gerenteId, rol: 'gerente' },
        salon.negocio.empleoId,
        ordenId,
        13_196,
      );
      exigirOk(await descontar(cajera(), ordenId, 13_196, token), 'descontar');
    },
  );
});

describe('el negocio puede apagar los descuentos', () => {
  it(
    'sólo el dueño o el administrador los apagan, y apagados se rechazan aun con PIN',
    { timeout: POR_COMANDOS },
    async () => {
      const apagar = (ambito: Ambito, permitir: boolean) =>
        comando(permitirDescuentos, { entrada: { permitir }, ambito, idempotencyKey: clave() });
      expect((await apagar(gerente(), false)).ok).toBe(false);
      exigirOk(await apagar(dueno(), false), 'apagar');

      const ordenId = await cuentaPedida();
      const token = firma(
        { empleoId: duenoId, rol: 'dueno' },
        salon.negocio.empleoId,
        ordenId,
        1_000,
      );
      expect(codigo(await descontar(cajera(), ordenId, 1_000, token))).toBe('DESCUENTOS_APAGADOS');

      exigirOk(await apagar(dueno(), true), 'encender');
      exigirOk(await descontar(cajera(), ordenId, 1_000, token), 'descontar');
    },
  );
});
