import type { Ambito, Resultado } from '@morphiqpos/contracts';
import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { firmarAutorizacion, type CargaDeAutorizacion } from '../identidad/supervisor.ts';
import { comando } from '../produccion.ts';
import { abrirCajaReal, clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { ambitoDeCaja, sembrarSalon, type Salon } from '../restaurante/pruebas/salon-real.ts';
import { hojaDelCorte } from './corte/documento.ts';
import { fijarUmbralDeRetiro } from './retiro-con-pin.ts';
import { registrarMovimientoCaja } from './sesion.ts';

/**
 * DP-16 (1.4) · «PEDIR PIN DE GERENTE EN RETIROS MAYORES A $X», contra Postgres.
 *
 * Vacío = no se pide. Arriba del umbral el servidor exige la autorización firmada del supervisor,
 * atada a ese monto y de un solo uso (la misma pieza del descuento). Sólo dueño y administrador
 * fijan el umbral; el corte trae quién autorizó cada retiro.
 */

const SECRETO = 'secreto_de_integracion_del_retiro_con_pin_2026';
vi.mock('@morphiqpos/contracts', async (original) => ({
  ...(await original<typeof import('@morphiqpos/contracts')>()),
  validarEntorno: () => ({ SESSION_SECRET: SECRETO }),
}));

const POR_COMANDOS = 120_000;
const UMBRAL = 100_000; // $1,000

let salon: Salon;
let cajera: Ambito;
let gerente: Ambito;
let dueno: Ambito;
let gerenteId = '';
let sesionId = '';

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Fonda del retiro con PIN', mesas: 1, terminales: 1 });
  const cajeraId = await sembrarCompanero(salon.negocio, { nombre: 'La Cajera', rol: 'cajero' });
  gerenteId = await sembrarCompanero(salon.negocio, { nombre: 'La Gerente', rol: 'gerente' });
  const duenoId = await sembrarCompanero(salon.negocio, { nombre: 'Don Poncho', rol: 'dueno' });
  cajera = { ...ambitoDeCaja(salon), rol: 'cajero', empleoId: cajeraId };
  gerente = { ...ambitoDeCaja(salon), rol: 'gerente', empleoId: gerenteId };
  dueno = { ...ambitoDeCaja(salon), rol: 'dueno', empleoId: duenoId };
  sesionId = await abrirCajaReal(cajera, 5_000_000);
}, POR_COMANDOS);

function firma(monto: number | null, para: 'retiro' | 'descuento' = 'retiro', n = clave()): string {
  const carga: CargaDeAutorizacion = {
    org: salon.negocio.organizacionId,
    supervisor: gerenteId,
    rol: 'gerente',
    solicita: cajera.empleoId,
    exp: Math.floor(Date.now() / 1000) + 120,
    n,
    para,
    ...(monto === null ? {} : { monto: String(monto) }),
  };
  return firmarAutorizacion(carga, SECRETO);
}

function retirar(
  monto: number,
  autorizacion?: string,
  ambito: Ambito = cajera,
): Promise<Resultado<{ registrado: true }>> {
  return comando(registrarMovimientoCaja, {
    entrada: {
      tipo: 'retiro',
      montoCentavos: -monto,
      motivo: 'pago al proveedor de carbón',
      ...(autorizacion === undefined ? {} : { autorizacion }),
    },
    ambito,
    idempotencyKey: clave(),
  });
}

function fijar(ambito: Ambito, umbralCentavos: number | null) {
  return comando(fijarUmbralDeRetiro, {
    entrada: { umbralCentavos },
    ambito,
    idempotencyKey: clave(),
  });
}

function regla<T>(r: Resultado<T>): string | null {
  if (r.ok) return null;
  const dato = (r.error.datos as { readonly regla?: unknown } | undefined)?.regla;
  return typeof dato === 'string' ? dato : r.error.codigo;
}

describe('retiro con PIN arriba del umbral', () => {
  it(
    'sin umbral (vacío) no se pide PIN, por grande que sea el retiro',
    { timeout: POR_COMANDOS },
    async () => {
      exigirOk(await retirar(2_000_000), 'retiro sin umbral');
    },
  );

  it('la cajera no puede cambiar el umbral; el dueño sí', { timeout: POR_COMANDOS }, async () => {
    expect((await fijar(cajera, UMBRAL)).ok).toBe(false);
    expect((await fijar(gerente, UMBRAL)).ok).toBe(false);
    exigirOk(await fijar(dueno, UMBRAL), 'fijar umbral');
  });

  it(
    'hasta el umbral (inclusive) no pide PIN; arriba sin PIN se niega',
    { timeout: POR_COMANDOS },
    async () => {
      exigirOk(await retirar(UMBRAL), 'retiro igual al umbral');
      expect(regla(await retirar(UMBRAL + 1))).toBe('PUESTO_NO_OTORGABLE');
    },
  );

  it('con el PIN de otro monto se niega', { timeout: POR_COMANDOS }, async () => {
    expect(regla(await retirar(300_000, firma(150_000)))).toBe('PUESTO_NO_OTORGABLE');
  });

  it(
    'una autorización de descuento no sirve para un retiro',
    { timeout: POR_COMANDOS },
    async () => {
      expect(regla(await retirar(300_000, firma(300_000, 'descuento')))).toBe(
        'PUESTO_NO_OTORGABLE',
      );
    },
  );

  it(
    'con el PIN del monto se registra, y reusarla se niega',
    { timeout: POR_COMANDOS },
    async () => {
      const token = firma(300_000);
      exigirOk(await retirar(300_000, token), 'retiro autorizado');
      expect(regla(await retirar(300_000, token))).toBe('AUTORIZACION_USADA');
    },
  );

  it('el gerente con su sesión no necesita el PIN de otro', { timeout: POR_COMANDOS }, async () => {
    exigirOk(await retirar(400_000, undefined, gerente), 'retiro del gerente');
  });

  it('apagar el umbral (null) vuelve a no pedir PIN', { timeout: POR_COMANDOS }, async () => {
    exigirOk(await fijar(dueno, null), 'apagar');
    exigirOk(await retirar(900_000), 'retiro sin umbral otra vez');
    exigirOk(await fijar(dueno, UMBRAL), 'volver a fijar');
  });

  it(
    'el corte trae quién autorizó, y sólo de los retiros con PIN',
    { timeout: POR_COMANDOS },
    async () => {
      const hoja = exigirOk(
        await comando(hojaDelCorte, {
          entrada: { sesionCajaId: sesionId },
          ambito: dueno,
          idempotencyKey: clave(),
        }),
        'hoja del corte',
      );
      expect(hoja.retirosConPin).toHaveLength(1);
      expect(hoja.retirosConPin[0]).toMatchObject({
        autorizo: 'La Gerente',
        quien: 'La Cajera',
        montoCentavos: '-300000',
      });
    },
  );

  it(
    'la auditoría guarda el nonce gastado, no la autorización firmada',
    { timeout: POR_COMANDOS },
    async () => {
      const filas = await obtenerDb()
        .selectFrom('auditoria')
        .select('payload')
        .where('organizacion_id', '=', salon.negocio.organizacionId)
        .where('accion', '=', 'caja.movimiento')
        .execute();
      const conAval = filas.filter(
        (f) => (f.payload as Record<string, unknown>)['autorizadoPor'] !== undefined,
      );
      expect(conAval.length).toBeGreaterThan(0);
      for (const f of conAval) {
        const aut = String((f.payload as Record<string, unknown>)['autorizacion']);
        expect(aut.includes('.')).toBe(false);
      }
    },
  );
});
