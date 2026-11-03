import { obtenerDb } from '@morphiqpos/data';
import { describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import {
  PRECIO_ARRACHERA,
  abrirLasCajas,
  ambitoDeCaja,
  cobrar,
  sembrarSalon,
  sentarYPedir,
} from '../restaurante/pruebas/salon-real.ts';
import { propinasPendientes } from './consultas.ts';

/**
 * QA2-010 (DP-13.5) · LA PROPINA DE UNA VENTA DEVUELTA SIGUE PENDIENTE DE ENTREGARSE.
 *
 * Devolver un platillo no devuelve la propina (no es venta): el efectivo sigue en el cajón y sigue
 * siendo del mesero. Pero `propinas.pendientes` sólo miraba las ventas `pagada`: en cuanto la
 * venta quedaba `parcialmente_reembolsada` (o `reembolsada`), su propina desaparecía del panel y
 * nadie la liquidaba, aunque los cortes sí la contaban.
 */

describe('la propina de una venta con devolución', () => {
  it.each(['parcialmente_reembolsada', 'reembolsada'] as const)(
    'una venta %s sigue con su propina pendiente',
    async (estado) => {
      const salon = await sembrarSalon({ nombre: `Fonda ${estado}`, mesas: 2, terminales: 1 });
      await abrirLasCajas(salon);
      const { ordenId } = await sentarYPedir(salon, 0, [{ platillo: 'arrachera', cantidad: '1' }]);
      const total = Number(PRECIO_ARRACHERA);
      exigirOk(
        await cobrar(ambitoDeCaja(salon), ordenId, total, [
          { metodo: 'efectivo', montoCentavos: total, propinaCentavos: 1_220 },
        ]),
        'venta.cobrar',
      );
      // Lo que deja la devolución en la cuenta (`venta/devolucion-de-venta.ts`).
      await obtenerDb().updateTable('ordenes').set({ estado }).where('id', '=', ordenId).execute();

      const hoy = new Date();
      const pendientes = exigirOk(
        await comando(propinasPendientes, {
          entrada: {
            desde: new Date(hoy.getTime() - 86_400_000).toISOString(),
            hasta: new Date(hoy.getTime() + 86_400_000).toISOString(),
            limite: 50,
          },
          ambito: ambitoDeCaja(salon),
          idempotencyKey: clave(),
        }),
        'propinas.pendientes',
      );
      expect(pendientes.totalCentavos).toBe('1220');
    },
  );
});
