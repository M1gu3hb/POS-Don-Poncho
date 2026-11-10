import { randomUUID } from 'node:crypto';

import type { Resultado } from '@morphiqpos/contracts';
import { obtenerDb } from '@morphiqpos/data';
import { describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { cambiarMesaComando } from './cambio-de-mesa.ts';
import { abrirLasCajas, ambitoDeCaja, sembrarSalon, sentarYPedir } from './pruebas/salon-real.ts';
import { fijarZonaActiva } from './zona-activa.ts';

/**
 * DP-16 (1.5) · Los menores del salón contra Postgres real: el aviso al reactivar una zona, todas
 * sus mesas libres apagadas con ella, y «ya se movió» al cambiar de mesa.
 */

const POR_COMANDOS = 120_000;
const db = () => obtenerDb();

const regla = <T>(r: Resultado<T>): string | null => {
  if (r.ok) return null;
  const d = (r.error.datos as { readonly regla?: unknown } | undefined)?.regla;
  return typeof d === 'string' ? d : r.error.codigo;
};

describe('zonas · todas las mesas con la zona, y el aviso al reactivar', () => {
  it(
    'apaga TODAS las mesas libres de la zona y las enciende al reactivar, sin aviso',
    { timeout: POR_COMANDOS },
    async () => {
      const salon = await sembrarSalon({ nombre: 'Salón de la zona completa', mesas: 3 });
      const zona = randomUUID();
      await db()
        .insertInto('zonas')
        .values({ id: zona, organizacion_id: salon.negocio.organizacionId, nombre: 'Patio' })
        .execute();
      await db()
        .updateTable('mesas')
        .set({ zona_id: zona })
        .where('id', 'in', salon.mesas)
        .execute();
      const ambito = { ...ambitoDeCaja(salon), rol: 'dueno' as const };
      const fijar = (activa: boolean) =>
        comando(fijarZonaActiva, {
          entrada: { zonaId: zona, activa },
          ambito,
          idempotencyKey: clave(),
        });

      const apagada = exigirOk(await fijar(false), 'desactivar');
      expect(apagada.mesasAfectadas).toBe(3);
      const quedan = await db()
        .selectFrom('mesas')
        .select('activa')
        .where('zona_id', '=', zona)
        .execute();
      expect(quedan.every((m) => !m.activa)).toBe(true);

      const encendida = exigirOk(await fijar(true), 'reactivar');
      expect(encendida.mesasAfectadas).toBe(3);
      expect(encendida.aviso).toBeNull();
    },
  );

  it(
    'si no hay rastro de qué mesas volver, reactivar lo AVISA',
    { timeout: POR_COMANDOS },
    async () => {
      const salon = await sembrarSalon({ nombre: 'Salón sin rastro', mesas: 1 });
      const zona = randomUUID();
      // Una zona apagada a mano (sin pasar por el comando): no hay nada en la auditoría.
      await db()
        .insertInto('zonas')
        .values({
          id: zona,
          organizacion_id: salon.negocio.organizacionId,
          nombre: 'Terraza vieja',
          activa: false,
        })
        .execute();
      const r = exigirOk(
        await comando(fijarZonaActiva, {
          entrada: { zonaId: zona, activa: true },
          ambito: { ...ambitoDeCaja(salon), rol: 'dueno' as const },
          idempotencyKey: clave(),
        }),
        'reactivar sin rastro',
      );
      expect(r.mesasAfectadas).toBe(0);
      expect(r.aviso).toMatch(/no hay registro/);
    },
  );
});

describe('cambiar de mesa cuando otro ya la movió', () => {
  it(
    'dice «ya se movió a la mesa N», no un error genérico',
    { timeout: POR_COMANDOS },
    async () => {
      const salon = await sembrarSalon({ nombre: 'Salón de la mudanza doble', mesas: 4 });
      await abrirLasCajas(salon);
      const { mesaId: origenId, ordenId } = await sentarYPedir(salon, 0, [
        { platillo: 'arrachera', cantidad: '1' },
      ]);
      const mover = (destino: number, origen: string) =>
        comando(cambiarMesaComando, {
          entrada: {
            ordenId,
            mesaDestinoId: salon.mesas[destino] ?? '',
            mesaOrigenId: origen,
          },
          ambito: ambitoDeCaja(salon),
          idempotencyKey: clave(),
        });

      // Alguien más la pasó a la mesa 2 (índice 1).
      exigirOk(await mover(1, origenId), 'la primera mudanza');

      // La pantalla que sigue viendo la cuenta en la mesa 1 intenta pasarla a la 3.
      const tarde = await mover(2, origenId);
      expect(regla(tarde)).toBe('ORDEN_NO_EDITABLE');
      expect(tarde.ok ? '' : tarde.error.mensaje).toMatch(/ya se movió a la mesa/);
    },
  );
});
