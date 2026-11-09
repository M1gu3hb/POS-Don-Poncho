import type { Ambito } from '@morphiqpos/contracts';
import { describe, expect, it } from 'vitest';

import { comando } from '../../produccion.ts';
import { abrirCajaReal, clave, exigirOk, sembrarCompanero } from '../../pruebas/negocio-real.ts';
import {
  ARRACHERA_CENTAVOS,
  CERVEZA_CENTAVOS,
  ambitoDeCaja,
  cobrarExacto,
  pedirLaCuenta,
  sembrarSalon,
  sentarYPedir,
} from '../../restaurante/pruebas/salon-real.ts';
import { cerrarCaja } from '../sesion.ts';
import { hojaDelCorte } from './documento.ts';
import { ventasDelDiaDelCorte } from './ventas-del-dia.ts';

/**
 * DP-15 · QA de la jornada, J-H6 · EL CIERRE DEL DÍA DICE LAS VENTAS DEL DÍA.
 *
 * Con dos cajas, cada corte cuenta sus cuentas (DP-D50) y el Cierre del día es el corte de la
 * última caja. Su resumen de ventas era sólo el de esa caja: la dueña que leía el Cierre del día
 * creía que el día vendió $2,476.75 y no $4,077.15. Ahora el corte que cierra el día trae, además,
 * las ventas de todas las cajas de su ventana; el de una caja que no cierra el día, no.
 */

const POR_COMANDOS = 120_000;

describe('caja.ventas_del_dia', () => {
  it(
    'el corte que cierra el día suma las ventas de todas las cajas; el otro no',
    async () => {
      const salon = await sembrarSalon({ nombre: 'Fonda del día', mesas: 2, terminales: 2 });
      const primera = ambitoDeCaja(salon, 0);
      const cajera = await sembrarCompanero(salon.negocio, { nombre: 'Rosa', rol: 'cajero' });
      const segunda: Ambito = { ...ambitoDeCaja(salon, 1), empleoId: cajera, rol: 'cajero' };
      const cajaUno = await abrirCajaReal(primera);
      const cajaDos = await abrirCajaReal(segunda);

      const mesaUno = await sentarYPedir(salon, 0, [{ platillo: 'arrachera', cantidad: '1' }]);
      await pedirLaCuenta(salon, mesaUno.ordenId);
      exigirOk(await cobrarExacto(primera, mesaUno.ordenId, ARRACHERA_CENTAVOS), 'cobrar 1');
      const mesaDos = await sentarYPedir(salon, 1, [{ platillo: 'cerveza', cantidad: '2' }]);
      await pedirLaCuenta(salon, mesaDos.ordenId);
      exigirOk(await cobrarExacto(segunda, mesaDos.ordenId, 2 * CERVEZA_CENTAVOS), 'cobrar 2');

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

      const hoja = async (sesionCajaId: string) =>
        exigirOk(
          await comando(hojaDelCorte, {
            entrada: { sesionCajaId },
            ambito: primera,
            idempotencyKey: clave(),
          }),
          'caja.hoja_del_corte',
        );
      const total = ARRACHERA_CENTAVOS + 2 * CERVEZA_CENTAVOS;

      const delDia = (await hoja(cajaDos)).ventasDelDia;
      expect(delDia).toMatchObject({ cajas: 2, tickets: 2, totalCentavos: String(total) });
      expect(delDia?.metodos.map((m) => [m.metodo, m.ventasCentavos])).toEqual([
        ['efectivo', String(total)],
      ]);
      // El resumen de la caja sigue siendo SÓLO el de esa caja (DP-D50).
      expect((await hoja(cajaDos)).resumen.totalCentavos).toBe(String(2 * CERVEZA_CENTAVOS));
      expect((await hoja(cajaUno)).ventasDelDia).toBeNull();

      const leer = async (sesionCajaId: string) =>
        exigirOk(
          await comando(ventasDelDiaDelCorte, {
            entrada: { sesionCajaId },
            ambito: segunda,
            idempotencyKey: clave(),
          }),
          'caja.ventas_del_dia',
        );
      expect(await leer(cajaDos)).toEqual(delDia);
      expect(await leer(cajaUno)).toBeNull();
    },
    POR_COMANDOS,
  );

  it(
    'con una sola caja en el día no hay «Ventas del día»: su resumen ya es el día',
    async () => {
      const salon = await sembrarSalon({ nombre: 'Fonda de una caja', mesas: 1, terminales: 1 });
      const caja = ambitoDeCaja(salon, 0);
      const sesion = await abrirCajaReal(caja);
      const mesa = await sentarYPedir(salon, 0, [{ platillo: 'cerveza', cantidad: '1' }]);
      await pedirLaCuenta(salon, mesa.ordenId);
      exigirOk(await cobrarExacto(caja, mesa.ordenId, CERVEZA_CENTAVOS), 'cobrar');
      exigirOk(
        await comando(cerrarCaja, {
          entrada: { efectivoContadoCentavos: 50_000 },
          ambito: caja,
          idempotencyKey: clave(),
        }),
        'caja.cerrar',
      );
      const hoja = exigirOk(
        await comando(hojaDelCorte, {
          entrada: { sesionCajaId: sesion },
          ambito: caja,
          idempotencyKey: clave(),
        }),
        'caja.hoja_del_corte',
      );
      expect(hoja.alcanceDeCancelaciones).toBe('dia');
      expect(hoja.ventasDelDia).toBeNull();
      const leidas = exigirOk(
        await comando(ventasDelDiaDelCorte, {
          entrada: { sesionCajaId: sesion },
          ambito: caja,
          idempotencyKey: clave(),
        }),
        'caja.ventas_del_dia',
      );
      expect(leidas).toBeNull();
    },
    POR_COMANDOS,
  );

  it(
    'tres cajas: la segunda en cerrar, con la tercera abierta, no cierra el día y no trae el día',
    async () => {
      const salon = await sembrarSalon({ nombre: 'Fonda de tres cajas', mesas: 1, terminales: 3 });
      const cajas = [0, 1, 2].map((i) => ambitoDeCaja(salon, i));
      const sesiones: string[] = [];
      for (const caja of cajas) sesiones.push(await abrirCajaReal(caja));
      for (const caja of cajas.slice(0, 2)) {
        exigirOk(
          await comando(cerrarCaja, {
            entrada: { efectivoContadoCentavos: 50_000 },
            ambito: caja,
            idempotencyKey: clave(),
          }),
          'caja.cerrar',
        );
      }
      const segunda = sesiones[1] ?? '';
      const hoja = exigirOk(
        await comando(hojaDelCorte, {
          entrada: { sesionCajaId: segunda },
          ambito: cajas[0] ?? ambitoDeCaja(salon, 0),
          idempotencyKey: clave(),
        }),
        'caja.hoja_del_corte',
      );
      expect(hoja.alcanceDeCancelaciones).toBe('caja');
      expect(hoja.ventasDelDia).toBeNull();
    },
    POR_COMANDOS,
  );
});
