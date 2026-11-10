import type { Ambito } from '@morphiqpos/contracts';
import { obtenerDb } from '@morphiqpos/data';
import { describe, expect, it, vi } from 'vitest';

import { firmarAutorizacion } from '../../identidad/supervisor.ts';
import { comando } from '../../produccion.ts';
import { abrirCajaReal, clave, exigirOk, sembrarCompanero } from '../../pruebas/negocio-real.ts';
import { abrirMesa } from '../../restaurante/mesas.ts';
import { armarParaLlevar } from '../../restaurante/para-llevar.ts';
import { entregarParaLlevar } from '../../restaurante/para-llevar-entregar.ts';
import { transicionarPedido } from '../../restaurante/preparacion.ts';
import { enviarPedido } from '../../restaurante/pedido.ts';
import {
  ARRACHERA_CENTAVOS,
  ambitoDeCaja,
  cobrarExacto,
  mesaDe,
  pedirLaCuenta,
  sembrarSalon,
} from '../../restaurante/pruebas/salon-real.ts';
import { fijarUmbralDeRetiro } from '../retiro-con-pin.ts';
import { cerrarCaja, registrarMovimientoCaja } from '../sesion.ts';
import { hojaDelCorte } from './documento.ts';

/**
 * DP-17 (QA de DP-16, H5) · EL CIERRE DEL DÍA DESGLOSA EL DÍA, NO SÓLO LA CAJA QUE CIERRA.
 *
 * Con dos cajas, «Ventas del día · todas las cajas» traía el total y los métodos de todas, pero
 * «Mesas y para llevar», «Opciones vendidas» y «Retiros con PIN de gerente» eran sólo de la caja
 * que cerraba el día: la dueña veía las opciones de media jornada. Ahora las ventas del día traen
 * también esos tres, de todas las cajas de la ventana; el resumen de cada caja sigue siendo suyo.
 */

const SECRETO = 'secreto_de_integracion_del_desglose_del_dia_2026';
vi.mock('@morphiqpos/contracts', async (original) => ({
  ...(await original<typeof import('@morphiqpos/contracts')>()),
  validarEntorno: () => ({ SESSION_SECRET: SECRETO }),
}));

const POR_COMANDOS = 180_000;
const QUESO = 1_500;

describe('caja.hoja_del_corte · el desglose del día', () => {
  it(
    'canal, opciones y retiros con PIN de las dos cajas en el corte que cierra el día',
    async () => {
      const salon = await sembrarSalon({ nombre: 'Fonda del desglose', mesas: 2, terminales: 2 });
      const org = salon.negocio.organizacionId;
      const [rosaId, lupeId, gerenteId, duenoId] = await Promise.all([
        sembrarCompanero(salon.negocio, { nombre: 'Rosa', rol: 'cajero' }),
        sembrarCompanero(salon.negocio, { nombre: 'Lupe', rol: 'cajero' }),
        sembrarCompanero(salon.negocio, { nombre: 'La Gerente', rol: 'gerente' }),
        sembrarCompanero(salon.negocio, { nombre: 'Don Poncho', rol: 'dueno' }),
      ]);
      const rosa: Ambito = { ...ambitoDeCaja(salon, 0), empleoId: rosaId, rol: 'cajero' };
      const lupe: Ambito = { ...ambitoDeCaja(salon, 1), empleoId: lupeId, rol: 'cajero' };
      const dueno: Ambito = { ...ambitoDeCaja(salon, 0), empleoId: duenoId, rol: 'dueno' };
      const cajaRosa = await abrirCajaReal(rosa, 5_000_000);
      const cajaLupe = await abrirCajaReal(lupe, 5_000_000);

      // «Extras · Queso +$15.00» en la arrachera.
      const db = obtenerDb();
      const grupo = await db
        .insertInto('modificadores')
        .values({ organizacion_id: org, nombre: 'Extras', tipo: 'multiple', obligatorio: false })
        .returning('id')
        .executeTakeFirstOrThrow();
      const queso = await db
        .insertInto('modificador_opciones')
        .values({
          modificador_id: grupo.id,
          nombre: 'Queso',
          orden: 0,
          delta_precio_centavos: BigInt(QUESO),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      const arrachera = salon.platillos.arrachera;
      await db
        .insertInto('producto_modificadores')
        .values({
          organizacion_id: org,
          producto_id: arrachera,
          modificador_id: grupo.id,
          orden: 0,
        })
        .execute();
      const conQueso = [{ grupoId: grupo.id, opcionIds: [queso.id] }];

      // Rosa cobra una MESA; Lupe, un PARA LLEVAR. Los dos con queso.
      const { ordenId: mesa } = exigirOk(
        await comando(abrirMesa, {
          entrada: { mesaId: mesaDe(salon, 0), personas: 2 },
          ambito: rosa,
          idempotencyKey: clave(),
        }),
        'restaurante.abrir_mesa',
      );
      exigirOk(
        await comando(enviarPedido, {
          entrada: {
            ordenId: mesa,
            lineas: [{ productoId: arrachera, cantidad: '1', opciones: conQueso }],
          },
          ambito: rosa,
          idempotencyKey: clave(),
        }),
        'restaurante.enviar_pedido',
      );
      await pedirLaCuenta(salon, mesa);
      const totalMesa = ARRACHERA_CENTAVOS + QUESO;
      exigirOk(await cobrarExacto(rosa, mesa, totalMesa), 'cobrar la mesa');
      const llevar = exigirOk(
        await comando(armarParaLlevar, {
          entrada: {
            nombrePedido: 'Lupita',
            lineas: [{ productoId: arrachera, cantidad: '1', opciones: conQueso }],
          },
          ambito: lupe,
          idempotencyKey: clave(),
        }),
        'restaurante.armar_para_llevar',
      );
      exigirOk(
        await cobrarExacto(lupe, llevar.ordenId, Number(llevar.totalCentavos)),
        'cobrar el para llevar',
      );
      // La cocina lo termina y la caja lo entrega (si no, el cierre se niega).
      const comandas = await obtenerDb()
        .selectFrom('comandas')
        .select('id')
        .where('orden_id', '=', llevar.ordenId)
        .execute();
      for (const { id } of comandas) {
        exigirOk(
          await comando(transicionarPedido, {
            entrada: { comandaId: id, estado: 'listo' },
            ambito: lupe,
            idempotencyKey: clave(),
          }),
          'restaurante.transicionar_pedido',
        );
      }
      exigirOk(
        await comando(entregarParaLlevar, {
          entrada: { ordenId: llevar.ordenId },
          ambito: lupe,
          idempotencyKey: clave(),
        }),
        'restaurante.entregar_para_llevar',
      );

      // Un retiro con PIN de la gerente en cada caja (umbral $500).
      exigirOk(
        await comando(fijarUmbralDeRetiro, {
          entrada: { umbralCentavos: 50_000 },
          ambito: dueno,
          idempotencyKey: clave(),
        }),
        'caja.fijar_umbral_de_retiro',
      );
      const retirar = async (ambito: Ambito, monto: number, motivo: string) => {
        const autorizacion = firmarAutorizacion(
          {
            org,
            supervisor: gerenteId,
            rol: 'gerente',
            solicita: ambito.empleoId,
            exp: Math.floor(Date.now() / 1000) + 120,
            n: clave(),
            para: 'retiro',
            monto: String(monto),
          },
          SECRETO,
        );
        exigirOk(
          await comando(registrarMovimientoCaja, {
            entrada: { tipo: 'retiro', montoCentavos: -monto, motivo, autorizacion },
            ambito,
            idempotencyKey: clave(),
          }),
          'caja.movimiento',
        );
      };
      await retirar(rosa, 60_000, 'carbón');
      await retirar(lupe, 65_000, 'tortillas');

      for (const ambito of [rosa, lupe]) {
        exigirOk(
          await comando(cerrarCaja, {
            entrada: { efectivoContadoCentavos: 5_000_000 },
            ambito,
            idempotencyKey: clave(),
          }),
          'caja.cerrar',
        );
      }
      const hoja = async (sesionCajaId: string) =>
        exigirOk(
          await comando(hojaDelCorte, {
            entrada: { sesionCajaId },
            ambito: dueno,
            idempotencyKey: clave(),
          }),
          'caja.hoja_del_corte',
        );

      const cierre = await hoja(cajaLupe);
      const delDia = cierre.ventasDelDia;
      expect(delDia?.canales).toEqual([
        { grupo: 'mesas', cuentas: 1, totalCentavos: String(totalMesa) },
        { grupo: 'llevar', cuentas: 1, totalCentavos: llevar.totalCentavos },
      ]);
      expect(delDia?.opciones).toEqual([
        { grupo: 'Extras', opcion: 'Queso', veces: '2', importeCentavos: String(2 * QUESO) },
      ]);
      expect(delDia?.retirosConPin.map((r) => [r.quien, r.autorizo, r.montoCentavos])).toEqual([
        ['Rosa', 'La Gerente', '-60000'],
        ['Lupe', 'La Gerente', '-65000'],
      ]);
      // Lo de la caja sigue siendo SÓLO de la caja (DP-D50).
      expect(cierre.opciones).toEqual([
        { grupo: 'Extras', opcion: 'Queso', veces: '1', importeCentavos: String(QUESO) },
      ]);
      expect(cierre.retirosConPin).toHaveLength(1);
      // El corte de la caja que no cierra el día no trae el día.
      expect((await hoja(cajaRosa)).ventasDelDia).toBeNull();
    },
    POR_COMANDOS,
  );
});
