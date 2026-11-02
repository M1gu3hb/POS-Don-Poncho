import type { Ambito } from '@morphiqpos/contracts';
import { obtenerDb } from '@morphiqpos/data';

import { cancelacionesRegistradasComando } from '../caja/corte/lectura-de-cancelaciones.ts';
import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { enviarPedido } from './pedido.ts';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  anular,
  arrachera,
  cancelar,
  comandasDe,
  como,
  cuenta,
  deLaCajera,
  dejarListo,
  dejarListoUnPlatillo,
  delCorte,
  mesero,
  negocio,
  sembrarElSalonQueCancela,
  sopa,
} from './pruebas/cancelacion-real.ts';

/**
 * DP-12.4 · EL CORTE DICE QUIÉN CANCELÓ Y QUÉ FUE PÉRDIDA, contra Postgres.
 *
 * Cada cancelación queda con QUIÉN canceló (no quien atendía), cuándo, el motivo y el importe;
 * lo que ya estaba listo o entregado es pérdida, y lo que no, no; el mismo dato lo lee
 * Registros (que lee lo que deja «el corte»: van en el mismo archivo).
 */

beforeAll(sembrarElSalonQueCancela);

describe('el corte: quién canceló, y qué fue pérdida', () => {
  it('cancelada ANTES de prepararse: queda registrada, con quién, motivo e importe, y no es pérdida', async () => {
    const { ordenId, mesa } = await cuenta(5, ['2']);
    exigirOk(await cancelar(ordenId, mesero(), 'Capturé la mesa equivocada'), 'cancelar');
    const [fila, ...otras] = await delCorte(mesa);
    expect(otras).toEqual([]);
    expect(fila).toMatchObject({
      tipo: 'orden',
      usuario: 'Rosa',
      motivo: 'Capturé la mesa equivocada',
      montoCentavos: '65800',
      perdida: false,
    });
    expect(fila?.hora).toBeInstanceOf(Date);
  });

  it('cancelada con la comida LISTA: es pérdida, con quién, cuándo, por qué y cuánto', async () => {
    const { ordenId, mesa } = await cuenta(6, ['1']);
    await dejarListo(ordenId);
    exigirOk(await cancelar(ordenId, mesero(), 'El cliente se fue'), 'cancelar');
    expect(await delCorte(mesa)).toMatchObject([
      {
        tipo: 'orden',
        usuario: 'Rosa',
        motivo: 'El cliente se fue',
        montoCentavos: '32900',
        perdida: true,
      },
    ]);
  });

  it('cancelada ya ENTREGADA: también es pérdida', async () => {
    const { ordenId, mesa } = await cuenta(7, ['1']);
    await dejarListo(ordenId, true);
    exigirOk(await cancelar(ordenId, mesero(), 'Se fueron sin pagar'), 'cancelar');
    expect(await delCorte(mesa)).toMatchObject([{ tipo: 'orden', perdida: true }]);
  });

  it('el que canceló es quien cancela, no quien atendía: la cajera cancela la cuenta de la mesera', async () => {
    const { ordenId, mesa } = await cuenta(8, ['1']);
    exigirOk(await cancelar(ordenId, deLaCajera(), 'Orden duplicada'), 'cancelar');
    const [fila] = await delCorte(mesa);
    expect(fila?.usuario).toBe('Beatriz');
  });

  it('un platillo anulado: antes de «listo» no es pérdida; el que ya salió, sí', async () => {
    const { ordenId, lineaIds, mesa } = await cuenta(9, ['1', '1']);
    // Sólo el primer platillo sale de cocina.
    await dejarListoUnPlatillo(lineaIds[0] ?? '');
    exigirOk(await anular(ordenId, lineaIds[0] ?? '', mesero()), 'anular el que salió');
    exigirOk(await anular(ordenId, lineaIds[1] ?? '', mesero()), 'anular el que no');
    const filas = await delCorte(mesa);
    expect(filas.map((f) => [f.tipo, f.producto, f.usuario, f.motivo, f.perdida])).toEqual([
      ['linea', 'Arrachera al carbón', 'Rosa', 'Error del mesero al tomar la orden', true],
      ['linea', 'Arrachera al carbón', 'Rosa', 'Error del mesero al tomar la orden', false],
    ]);
  });

  it('quien anula el platillo es quien lo anula: la cajera quita uno de la cuenta de la mesera', async () => {
    const { ordenId, lineaIds, mesa } = await cuenta(11, ['1', '1']);
    exigirOk(await anular(ordenId, lineaIds[0] ?? '', deLaCajera()), 'anular como cajera');
    const [fila] = await delCorte(mesa);
    expect(fila).toMatchObject({ tipo: 'linea', usuario: 'Beatriz' });
  });

  it('un platillo ya listo que se anula y luego se cancela la cuenta SIGUE siendo pérdida (la línea se pisa a «cancelado», la cocina no)', async () => {
    const { ordenId, lineaIds, mesa } = await cuenta(12, ['1', '1']);
    await dejarListoUnPlatillo(lineaIds[0] ?? '');
    exigirOk(await anular(ordenId, lineaIds[0] ?? '', mesero()), 'anular el que salió');
    exigirOk(await cancelar(ordenId, mesero(), 'Ya no quisieron nada'), 'cancelar');
    const filas = await delCorte(mesa);
    // El platillo que salió es una pérdida UNA vez: la cuenta, que sólo tenía el otro sin hacer,
    // no la repite.
    expect(filas.map((f) => [f.tipo, f.perdida])).toEqual([
      ['linea', true],
      ['orden', false],
    ]);
  });

  it('con UN envío ya listo y otro pendiente, cancelar la cuenta es pérdida', async () => {
    const { ordenId, lineaIds, mesa } = await cuenta(13, ['1', '1']);
    await dejarListoUnPlatillo(lineaIds[0] ?? '');
    exigirOk(await cancelar(ordenId, mesero(), 'Se fueron'), 'cancelar');
    expect(await delCorte(mesa)).toMatchObject([{ tipo: 'orden', perdida: true }]);
  });

  it('con UN platillo listo y OTRO sin hacer en la MISMA comanda (la comanda no está lista), cancelar la cuenta es pérdida', async () => {
    const { ordenId, mesa } = await cuenta(14, []);
    // Un solo envío con dos platillos: una comanda con dos items.
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
    expect(await comandasDe(ordenId)).toHaveLength(1);
    await dejarListoUnPlatillo(
      lineas.find((l) => l.producto_nombre === 'Arrachera al carbón')?.id ?? '',
    );
    const comanda = await obtenerDb()
      .selectFrom('comandas')
      .select(['estado', 'lista_en'])
      .where('orden_id', '=', ordenId)
      .executeTakeFirstOrThrow();
    // El supuesto de esta prueba: la comanda como tal NO está lista, sólo uno de sus platillos.
    expect(['listo', 'entregado']).not.toContain(comanda.estado);
    expect(comanda.lista_en).toBeNull();
    exigirOk(await cancelar(ordenId, mesero(), 'Se fueron'), 'cancelar');
    expect(await delCorte(mesa)).toMatchObject([{ tipo: 'orden', perdida: true }]);
  });

  it('anular UNA de dos piezas ya listas también es pérdida', async () => {
    const { ordenId, lineaIds, mesa } = await cuenta(10, ['2']);
    await dejarListo(ordenId);
    exigirOk(await anular(ordenId, lineaIds[0] ?? '', mesero(), '1'), 'anular una pieza');
    expect(await delCorte(mesa)).toMatchObject([
      { tipo: 'linea', montoCentavos: '32900', perdida: true },
    ]);
  });
});

describe('Registros: las mismas cancelaciones, sin sesión de caja', () => {
  const registradas = (ambito: Ambito) =>
    comando(cancelacionesRegistradasComando, {
      entrada: { dias: 30 },
      ambito,
      idempotencyKey: clave(),
    });

  it('la gerente las lee, lo más reciente primero, con quién, motivo, importe y pérdida', async () => {
    const salida = exigirOk(await registradas(como(negocio.empleoId, 'gerente')), 'registradas');
    const horas = salida.cancelaciones.map((c) => c.hora?.getTime() ?? 0);
    expect(horas).toEqual([...horas].sort((a, b) => b - a));
    const perdida = salida.cancelaciones.find((c) => c.mesa === 'Mesa 6');
    expect(perdida).toMatchObject({
      tipo: 'orden',
      usuario: 'Rosa',
      motivo: 'El cliente se fue',
      perdida: true,
    });
    expect(salida.cancelaciones.find((c) => c.mesa === 'Mesa 5')?.perdida).toBe(false);
  });

  it('el mesero cancela pero no lee el registro: SIN_PERMISO', async () => {
    const r = await registradas(mesero());
    expect(r.ok ? null : r.error.codigo).toBe('SIN_PERMISO');
  });
});
