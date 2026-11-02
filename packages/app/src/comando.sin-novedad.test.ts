import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { crearComando, definirComando } from './comando.ts';
import { SinNovedad } from './fallos.ts';
import { ambitoDeCajero, crearFabrica, type TxFalsa } from './pruebas/dobles.ts';

/**
 * DP-12.6 · «NO LE TOCABA»: un comando que decide, dentro de su transacción, que no hay nada que
 * hacer (la limpieza de solicitudes ya corrió hace menos de una hora).
 *
 * Todo comando que escribe deja su rastro de auditoría y su clave de idempotencia; un «no hice
 * nada» que los dejara llenaría la auditoría de líneas vacías (una por visita a Mesas). Lanzar
 * `SinNovedad` revierte TODO —clave incluida— y el cliente recibe un éxito con lo que el comando
 * dijo.
 */

const CLAVE = 'clave-de-idempotencia-0001';

const BASE = {
  nombre: 'restaurante.limpiar_solicitudes',
  entidad: 'solicitud_qr',
  escribe: true,
  roles: ['cajero'],
  paquetes: ['tienda'],
  entrada: z.object({}),
} as const;

describe('comando() · sin novedad', () => {
  it('contesta éxito con lo que el comando dijo, y no deja NADA confirmado', async () => {
    const fabrica = crearFabrica('tienda');
    const definicion = definirComando({
      ...BASE,
      async ejecutar() {
        throw new SinNovedad({ borradas: 0, omitida: true });
      },
    });

    const salida = await crearComando<TxFalsa>(fabrica)(definicion, {
      entrada: {},
      ambito: ambitoDeCajero(),
      idempotencyKey: CLAVE,
    });

    expect(salida.ok).toBe(true);
    if (!salida.ok) return;
    expect(salida.datos).toEqual({ borradas: 0, omitida: true });
    expect(salida.reintento).toBe(false);
    // Ni la auditoría ni la clave de idempotencia: la transacción entera se revirtió.
    expect(fabrica.base.confirmadas).toHaveLength(0);
    expect(fabrica.auditoriaConfirmada()).toHaveLength(0);
    expect(fabrica.base.transacciones.every((t) => !t.confirmada)).toBe(true);
  });

  it('CONTRASTE: el mismo comando, cuando sí le toca, audita y confirma', async () => {
    const fabrica = crearFabrica('tienda');
    const definicion = definirComando({
      ...BASE,
      async ejecutar(ctx) {
        ctx.auditar({ entidadId: null, payload: { borradas: 3 } });
        return { borradas: 3 };
      },
    });

    const salida = await crearComando<TxFalsa>(fabrica)(definicion, {
      entrada: {},
      ambito: ambitoDeCajero(),
      idempotencyKey: CLAVE,
    });

    expect(salida.ok).toBe(true);
    expect(fabrica.auditoriaConfirmada()).toHaveLength(1);
    expect(fabrica.base.transacciones.filter((t) => t.confirmada)).toHaveLength(1);
  });

  it('un cajero sin permiso sigue siendo rechazado ANTES de que el comando decida nada', async () => {
    const fabrica = crearFabrica('tienda');
    let corrio = false;
    const definicion = definirComando({
      ...BASE,
      roles: ['dueno'],
      async ejecutar() {
        corrio = true;
        throw new SinNovedad({ omitida: true });
      },
    });

    const salida = await crearComando<TxFalsa>(fabrica)(definicion, {
      entrada: {},
      ambito: ambitoDeCajero(),
      idempotencyKey: CLAVE,
    });

    expect(corrio).toBe(false);
    expect(salida.ok).toBe(false);
    if (salida.ok) return;
    expect(salida.error.codigo).toBe('SIN_PERMISO');
  });

  it('un error cualquiera NO se confunde con «sin novedad»', async () => {
    const fabrica = crearFabrica('tienda');
    const definicion = definirComando({
      ...BASE,
      async ejecutar() {
        throw new Error('se cayó');
      },
    });

    const salida = await crearComando<TxFalsa>(fabrica)(definicion, {
      entrada: {},
      ambito: ambitoDeCajero(),
      idempotencyKey: CLAVE,
    });

    expect(salida.ok).toBe(false);
  });
});
