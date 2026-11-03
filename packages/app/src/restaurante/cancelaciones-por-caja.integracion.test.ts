import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { hojaDelCorte } from '../caja/corte/documento.ts';
import { comando } from '../produccion.ts';
import { abrirCajaReal, clave, exigirOk } from '../pruebas/negocio-real.ts';
import { enviarPedido } from './pedido.ts';

import {
  anular,
  arrachera,
  cancelar,
  cerrarLaCaja,
  cobrar,
  cuenta,
  deLaCajera,
  deLaSegundaCajera,
  dejarListo,
  dejarListoUnPlatillo,
  delCorte,
  delCorteDe,
  mesero,
  sembrarElSalonQueCancela,
  sesionCajaId,
  sopa,
} from './pruebas/cancelacion-real.ts';

/**
 * DP-13.2 · EL CORTE, contra Postgres.
 *
 *   (a) La pérdida es SÓLO lo que la cocina ya había dejado listo o entregado y no se cobró: una
 *       cuenta de dos platillos con uno listo pierde uno, no la cuenta.
 *   (b) La ventana (DP-D50): el corte de cada caja trae sólo las cancelaciones de SUS cuentas
 *       —las que cobró, y las que canceló quien la abrió mientras estaba abierta—; el Cierre del
 *       día (el de la última caja abierta de la sucursal) trae todas las del día, una vez; y lo
 *       cancelado sin caja abierta cae en el Cierre del día que sigue.
 *   (c) El corte de una caja abierta dice hasta qué hora cuenta.
 *
 * Los casos van en orden y comparten las cajas: abren, cancelan, cobran y cierran como un día.
 */

beforeAll(sembrarElSalonQueCancela);

const mesasDe = (salida: Awaited<ReturnType<typeof delCorteDe>>) =>
  salida.cancelaciones.map((c) => c.mesa);

describe('(a) la pérdida vale lo que ya estaba hecho', () => {
  it('dos platillos, uno listo: la pérdida es el listo; el resto, cancelado sin costo', async () => {
    const { ordenId, lineaIds, mesa } = await cuenta(1, ['1', '1']);
    await dejarListoUnPlatillo(lineaIds[0] ?? '');
    exigirOk(await cancelar(ordenId, mesero(), 'Se fueron'), 'cancelar');
    expect(await delCorte(mesa)).toMatchObject([
      { tipo: 'orden', montoCentavos: '65800', perdidaCentavos: '32900', perdida: true },
    ]);
  });

  it('dos piezas en un envío, las dos listas: la pérdida es lo que valen las dos', async () => {
    const { ordenId, mesa } = await cuenta(2, ['2']);
    await dejarListo(ordenId);
    exigirOk(await cancelar(ordenId, mesero(), 'Se fueron'), 'cancelar');
    expect(await delCorte(mesa)).toMatchObject([
      { tipo: 'orden', montoCentavos: '65800', perdidaCentavos: '65800', perdida: true },
    ]);
  });

  it('nada listo: la pérdida es cero', async () => {
    const { ordenId, mesa } = await cuenta(3, ['1']);
    exigirOk(await cancelar(ordenId, mesero(), 'Capturé mal'), 'cancelar');
    expect(await delCorte(mesa)).toMatchObject([
      { tipo: 'orden', montoCentavos: '32900', perdidaCentavos: '0', perdida: false },
    ]);
  });

  it('un platillo listo anulado: su pérdida es lo que vale; el anulado sin hacer, cero', async () => {
    const { ordenId, lineaIds, mesa } = await cuenta(8, ['1', '1']);
    await dejarListoUnPlatillo(lineaIds[0] ?? '');
    exigirOk(await anular(ordenId, lineaIds[0] ?? '', mesero()), 'anular el listo');
    exigirOk(await anular(ordenId, lineaIds[1] ?? '', mesero()), 'anular el otro');
    // La cuenta vacía se cancela: no repite como pérdida lo que ya se anuló aparte.
    exigirOk(await cancelar(ordenId, mesero(), 'Quedó vacía'), 'cancelar la vacía');
    expect((await delCorte(mesa)).map((c) => [c.tipo, c.perdidaCentavos])).toEqual([
      ['linea', '32900'],
      ['linea', '0'],
      ['orden', '0'],
    ]);
  });
});

describe('(a) un platillo quitado ANTES de prepararse no es pérdida aunque su comanda salga después', () => {
  it('en un mismo envío: se quita uno, la cocina deja lista la comanda, y el quitado sigue sin costo', async () => {
    const { ordenId, mesa } = await cuenta(13, []);
    exigirOk(
      await comando(enviarPedido, {
        entrada: {
          ordenId,
          lineas: [
            { productoId: arrachera, cantidad: '1' },
            { productoId: sopa, cantidad: '1' },
          ],
        },
        ambito: mesero(),
        idempotencyKey: clave(),
      }),
      'restaurante.enviar_pedido',
    );
    const lineas = await obtenerDb()
      .selectFrom('orden_lineas')
      .select(['id', 'producto_nombre'])
      .where('orden_id', '=', ordenId)
      .execute();
    const laSopa = lineas.find((l) => l.producto_nombre === 'Sopa de tortilla')?.id ?? '';
    exigirOk(await anular(ordenId, laSopa, mesero()), 'quitar la sopa antes');
    await dejarListo(ordenId);
    exigirOk(await cancelar(ordenId, mesero(), 'Se fueron'), 'cancelar');
    const filas = await delCorte(mesa);
    expect(filas.map((c) => [c.tipo, c.producto, c.perdidaCentavos])).toEqual([
      ['linea', 'Sopa de tortilla', '0'],
      ['orden', null, '32900'],
    ]);
  });
});

describe('(a) la porción anulada de un platillo listo sigue siendo pérdida si después se cancela la cuenta', () => {
  it('dos piezas listas, se anula una, se cancela la cuenta: se perdieron las dos', async () => {
    const { ordenId, lineaIds, mesa } = await cuenta(14, ['2']);
    await dejarListo(ordenId);
    exigirOk(await anular(ordenId, lineaIds[0] ?? '', mesero(), '1'), 'anular una pieza');
    exigirOk(await cancelar(ordenId, mesero(), 'Se fueron'), 'cancelar');
    expect((await delCorte(mesa)).map((c) => [c.tipo, c.perdidaCentavos])).toEqual([
      ['linea', '32900'],
      ['orden', '32900'],
    ]);
  });
});

describe('(b) cada caja lo suyo; el Cierre del día, todo y una vez', () => {
  it('con dos cajas, lo cancelado por la mesera no es de ninguna; al cerrar la última, sale una vez', async () => {
    const cajaA = sesionCajaId;
    const cajaB = await abrirCajaReal(deLaSegundaCajera());

    const x = await cuenta(4, ['1']);
    exigirOk(await cancelar(x.ordenId, mesero(), 'QA: la mesera'), 'cancelar X');
    const y = await cuenta(5, ['1']);
    exigirOk(await cancelar(y.ordenId, deLaCajera(), 'QA: la cajera de la 1'), 'cancelar Y');
    const z = await cuenta(6, ['1', '1']);
    exigirOk(await anular(z.ordenId, z.lineaIds[0] ?? '', mesero()), 'anular en Z');
    await cobrar(z.ordenId, deLaSegundaCajera());

    expect(mesasDe(await delCorteDe(cajaA))).toEqual(['Mesa 5']);
    expect(mesasDe(await delCorteDe(cajaB))).toEqual(['Mesa 6']);
    expect((await delCorteDe(cajaA)).alcance).toBe('caja');

    // La 1 cierra con la 2 abierta: no cierra el día, su corte sigue siendo sólo lo suyo.
    exigirOk(await cerrarLaCaja(deLaCajera()), 'cerrar la 1');
    expect(mesasDe(await delCorteDe(cajaA))).toEqual(['Mesa 5']);

    // La 2 es la última: su cierre es el Cierre del día, con TODO lo del día una sola vez.
    exigirOk(await cerrarLaCaja(deLaSegundaCajera()), 'cerrar la 2');
    const dia = await delCorteDe(cajaB);
    expect(dia.alcance).toBe('dia');
    const mesas = mesasDe(dia);
    expect(mesas).toEqual(
      expect.arrayContaining(['Mesa 1', 'Mesa 2', 'Mesa 3', 'Mesa 4', 'Mesa 5', 'Mesa 6']),
    );
    expect(mesas.filter((m) => m === 'Mesa 4')).toHaveLength(1);
    expect(mesas.filter((m) => m === 'Mesa 5')).toHaveLength(1);
    expect(mesas.filter((m) => m === 'Mesa 6')).toHaveLength(1);
  });

  it('lo cancelado sin caja abierta cae en el siguiente Cierre del día, y el anterior no se repite', async () => {
    const w = await cuenta(7, ['1']);
    exigirOk(await cancelar(w.ordenId, mesero(), 'QA: sin caja'), 'cancelar W');

    const otraVez = await abrirCajaReal(deLaCajera());
    // Abierta, no es de esta caja: lo cancelado sin caja es del día.
    expect(mesasDe(await delCorteDe(otraVez))).toEqual([]);

    // (c) Abierta, el corte dice hasta qué hora cuenta.
    const parcial = exigirOk(
      await comando(hojaDelCorte, {
        entrada: { sesionCajaId: otraVez },
        ambito: deLaCajera(),
        idempotencyKey: clave(),
      }),
      'caja.hoja_del_corte',
    );
    expect(parcial.parcial).toBe(true);
    expect(parcial.corteHasta).toBeInstanceOf(Date);

    exigirOk(await cerrarLaCaja(deLaCajera()), 'cerrar otra vez');
    expect(mesasDe(await delCorteDe(otraVez))).toEqual(['Mesa 7']);

    const cerrada = exigirOk(
      await comando(hojaDelCorte, {
        entrada: { sesionCajaId: otraVez },
        ambito: deLaCajera(),
        idempotencyKey: clave(),
      }),
      'caja.hoja_del_corte',
    );
    expect(cerrada.parcial).toBe(false);
    expect(cerrada.corteHasta).toEqual(cerrada.sesion.cerradaEn);
  });
});
