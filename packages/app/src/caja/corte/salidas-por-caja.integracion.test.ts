import type { Ambito } from '@morphiqpos/contracts';
import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { describe, expect, it } from 'vitest';

import { comando } from '../../produccion.ts';
import { abrirCajaReal, clave, exigirOk, sembrarCompanero } from '../../pruebas/negocio-real.ts';
import { cancelarOrden } from '../../restaurante/cancelacion.ts';
import { transicionarPedido } from '../../restaurante/preparacion.ts';
import {
  ambitoDeCaja,
  lineasDe,
  sembrarSalon,
  sentarYPedir,
} from '../../restaurante/pruebas/salon-real.ts';
import { cerrarCaja } from '../sesion.ts';
import { alcanceDelCorte, salidasSinVenta } from './consultas.ts';

/**
 * QA2-004 (DP-13.5) · LAS SALIDAS SIN VENTA, COMO LAS CANCELACIONES (DP-D50): cada caja las suyas
 * y el Cierre del día todas, una vez.
 *
 * La merma y el consumo de la casa se leían por la ventana de tiempo de CADA caja y de toda la
 * organización: con dos cajas abiertas las dos hojas traían la MISMA merma, y el Cierre del día
 * (la ventana de la última caja) no veía lo que pasó antes de que ella abriera. Ahora el corte de
 * una caja trae lo que sacó quien la abrió mientras estaba abierta, y el Cierre del día todo lo de
 * la sucursal desde el Cierre anterior.
 */

async function salidasDe(organizacionId: string, sesionId: string) {
  return conTransaccion(async (tx) => {
    const alcance = await alcanceDelCorte(tx, organizacionId, sesionId, new Date());
    if (alcance === null) throw new Error('sin alcance');
    return salidasSinVenta(tx, organizacionId, alcance);
  });
}

describe('la merma «Por cancelación» en el corte de dos cajas', () => {
  it('es de la caja de quien canceló, no de la otra; y el Cierre del día la trae una vez', async () => {
    const salon = await sembrarSalon({ nombre: 'Fonda de dos cajas', mesas: 3, terminales: 2 });
    const primera = ambitoDeCaja(salon, 0);
    const otraCajera = await sembrarCompanero(salon.negocio, { nombre: 'Carmen', rol: 'cajero' });
    const segunda: Ambito = { ...ambitoDeCaja(salon, 1), empleoId: otraCajera, rol: 'cajero' };
    const cajaUno = await abrirCajaReal(primera);
    const cajaDos = await abrirCajaReal(segunda);

    // La cajera de la caja 1 cancela una arrachera que la cocina ya dejó lista.
    const { ordenId } = await sentarYPedir(salon, 0, [{ platillo: 'arrachera', cantidad: '1' }]);
    const linea = (await lineasDe(ordenId)).get('Arrachera al carbón')?.[0] ?? '';
    const item = await obtenerDb()
      .selectFrom('comanda_items')
      .select(['id', 'comanda_id'])
      .where('orden_linea_id', '=', linea)
      .executeTakeFirstOrThrow();
    exigirOk(
      await comando(transicionarPedido, {
        entrada: { comandaId: item.comanda_id, comandaItemId: item.id, estado: 'listo' },
        ambito: primera,
        idempotencyKey: clave(),
      }),
      'restaurante.transicionar_pedido',
    );
    exigirOk(
      await comando(cancelarOrden, {
        entrada: { ordenId, motivo: 'Se fueron sin pagar' },
        ambito: primera,
        idempotencyKey: clave(),
      }),
      'restaurante.cancelar_orden',
    );

    expect((await salidasDe(salon.negocio.organizacionId, cajaUno)).length).toBeGreaterThan(0);
    expect(await salidasDe(salon.negocio.organizacionId, cajaDos)).toEqual([]);

    // La 1 cierra con la 2 abierta; la 2 es la última: su corte es el Cierre del día.
    for (const ambito of [primera, segunda]) {
      exigirOk(
        await comando(cerrarCaja, {
          entrada: { efectivoContadoCentavos: 50_000 },
          ambito,
          idempotencyKey: clave(),
        }),
        'caja.cerrar',
      );
    }
    const delDia = await salidasDe(salon.negocio.organizacionId, cajaDos);
    const deUno = await salidasDe(salon.negocio.organizacionId, cajaUno);
    expect(delDia.map((s) => [s.nombre, s.cantidad])).toEqual(
      deUno.map((s) => [s.nombre, s.cantidad]),
    );
  });
});
