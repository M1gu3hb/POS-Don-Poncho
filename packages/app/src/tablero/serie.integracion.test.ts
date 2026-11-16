import type { Ambito } from '@morphiqpos/contracts';
import { obtenerDb } from '@morphiqpos/data';
import { planDelPeriodo, sumarDias } from '@morphiqpos/domain/tablero';
import { sql } from 'kysely';
import { beforeAll, describe, expect, it } from 'vitest';

import { hojaDelCorte } from '../caja/corte/documento.ts';
import { registrarGasto } from '../compras/index.ts';
import { comando } from '../produccion.ts';
import { clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import {
  abrirLasCajas,
  ambitoDeCaja,
  ARRACHERA_CENTAVOS,
  cobrarExacto,
  sembrarSalon,
  sentarYPedir,
  type Salon,
} from '../restaurante/pruebas/salon-real.ts';
import { serieDelTableroComando } from './serie.ts';

/**
 * DP-21 · Bloque 13 · «¿CÓMO VA TU SEMANA?» DESDE EL SERVIDOR, contra Postgres.
 *
 * Tres cuentas cobradas (dos hoy, una a las 23:59 de AYER en la zona del negocio) y un gasto:
 *   · la semana trae siete cubetas, con los días sin venta en cero;
 *   · lo de hoy en el tablero es lo mismo, al centavo, que lo que dice el corte de la caja;
 *   · la cuenta de las 23:59 de ayer cae en AYER (el día del negocio), no en hoy;
 *   · cada día se compara con el mismo día de la semana pasada; el año, por mes;
 *   · sólo dueño, administrador y gerente.
 */

const POR_COMANDOS = 120_000;

let salon: Salon;
let dueno: Ambito;
let cajero: Ambito;
let sesionCajaId = '';
let hoy = '';
let ayer = '';

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Fonda del Tablero', mesas: 4, terminales: 1 });
  const duenoId = await sembrarCompanero(salon.negocio, { nombre: 'Don Poncho', rol: 'dueno' });
  const cajeroId = await sembrarCompanero(salon.negocio, { nombre: 'La Cajera', rol: 'cajero' });
  dueno = { ...ambitoDeCaja(salon), rol: 'dueno', empleoId: duenoId };
  cajero = { ...ambitoDeCaja(salon), rol: 'cajero', empleoId: cajeroId };
  [sesionCajaId = ''] = await abrirLasCajas(salon);
}, POR_COMANDOS);

const serie = async (periodo: 'hoy' | 'semana' | 'mes' | 'anio', ambito: Ambito = dueno) =>
  exigirOk(
    await comando(serieDelTableroComando, {
      entrada: { periodo },
      ambito,
      idempotencyKey: clave(),
    }),
    'tablero.serie',
  );

async function cobrarUna(mesa: number): Promise<string> {
  const { ordenId } = await sentarYPedir(salon, mesa, [{ platillo: 'arrachera', cantidad: '1' }]);
  exigirOk(await cobrarExacto(ambitoDeCaja(salon), ordenId, ARRACHERA_CENTAVOS), 'cobrar');
  return ordenId;
}

describe('tablero.serie', () => {
  it(
    'una semana con dos cuentas de hoy: siete cubetas, ceros donde no se vendió, y igual que el corte',
    { timeout: POR_COMANDOS },
    async () => {
      await cobrarUna(0);
      await cobrarUna(1);
      exigirOk(
        await comando(registrarGasto, {
          entrada: {
            categoria: 'servicios',
            descripcion: 'Garrafón',
            monto: '120.00',
            metodoPago: 'tarjeta',
          },
          ambito: dueno,
          idempotencyKey: clave(),
        }),
        'gasto',
      );

      const s = await serie('semana');
      hoy = s.hoy;
      ayer = sumarDias(hoy, -1);
      expect(s.agrupar).toBe('dia');
      expect(s.filas).toHaveLength(7);
      const deHoy = s.filas.find((f) => f.clave === hoy);
      expect(deHoy).toMatchObject({
        ventasCentavos: String(ARRACHERA_CENTAVOS * 2),
        cuentas: 2,
        ticketPromedioCentavos: String(ARRACHERA_CENTAVOS),
        gastosCentavos: '12000',
      });
      // Los demás días de la semana: en cero, no omitidos.
      for (const f of s.filas.filter((x) => x.clave !== hoy)) {
        expect(f.cuentas, f.clave).toBe(0);
        expect(f.ventasCentavos, f.clave).toBe('0');
      }

      // Lo mismo que dice el corte de la caja: al centavo.
      const corte = exigirOk(
        await comando(hojaDelCorte, {
          entrada: { sesionCajaId },
          ambito: dueno,
          idempotencyKey: clave(),
        }),
        'caja.hoja_del_corte',
      );
      expect(deHoy?.ventasCentavos).toBe(corte.resumen.totalCentavos);
      expect(s.totales.ventasCentavos).toBe(corte.resumen.totalCentavos);
      expect(s.totales.gastosCentavos).toBe('12000');
    },
  );

  it(
    'la cuenta de las 23:59 de ayer cae en AYER (el día del negocio) y no en hoy',
    { timeout: POR_COMANDOS },
    async () => {
      const ordenId = await cobrarUna(2);
      // Se cobró «ahora»: se mueve a las 23:59 de ayer, hora del negocio.
      await sql`
        update ordenes o
           set created_at = ((${ayer}::date + time '22:00') at time zone og.zona_horaria),
               cerrada_en = ((${ayer}::date + time '23:59') at time zone og.zona_horaria)
          from organizaciones og
         where og.id = o.organizacion_id and o.id = ${ordenId}
      `.execute(obtenerDb());

      const s = await serie('semana');
      const plan = planDelPeriodo('semana', hoy);
      const enLaSemana = plan.cubetas.some((c) => c.clave === ayer);
      if (enLaSemana) {
        expect(s.filas.find((f) => f.clave === ayer)).toMatchObject({
          cuentas: 1,
          ventasCentavos: String(ARRACHERA_CENTAVOS),
        });
      } else {
        // Hoy es lunes: ayer (domingo) es la semana pasada, la referencia del domingo de hoy.
        const dom = s.filas.find(
          (f) =>
            f.referencia !== null &&
            plan.cubetas.find((c) => c.clave === f.clave)?.claveReferencia === ayer,
        );
        expect(dom?.referencia).toMatchObject({ cuentas: 1 });
      }
      // Hoy sigue con sus dos cuentas.
      expect(s.filas.find((f) => f.clave === hoy)).toMatchObject({ cuentas: 2 });
    },
  );

  it(
    'hoy por hora y el año por mes: las mismas cuentas, sin referencia en el año',
    { timeout: POR_COMANDOS },
    async () => {
      const porHora = await serie('hoy');
      expect(porHora.filas).toHaveLength(24);
      expect(porHora.filas.reduce((n, f) => n + f.cuentas, 0)).toBe(2);
      expect(porHora.filas.every((f) => f.gastosCentavos === null)).toBe(true);
      expect(porHora.totales.gastosCentavos).toBe('12000');

      const anio = await serie('anio');
      expect(anio.filas).toHaveLength(12);
      expect(anio.filas.every((f) => f.referencia === null)).toBe(true);
      // Las tres cuentas están en el año (la de ayer también, salvo el 1 de enero).
      expect(anio.totales.cuentas).toBeGreaterThanOrEqual(2);
    },
  );

  it(
    'cada día se compara con el mismo día de la semana pasada',
    { timeout: POR_COMANDOS },
    async () => {
      const semanaPasada = sumarDias(hoy, -7);
      await sql`
      update ordenes o
         set created_at = ((${semanaPasada}::date + time '12:00') at time zone og.zona_horaria),
               cerrada_en = ((${semanaPasada}::date + time '13:00') at time zone og.zona_horaria)
        from organizaciones og
       where og.id = o.organizacion_id
         and o.id = (select id from ordenes where organizacion_id = ${salon.negocio.organizacionId}
                      order by created_at desc limit 1)
    `.execute(obtenerDb());
      const s = await serie('semana');
      const deHoy = s.filas.find((f) => f.clave === hoy);
      expect(deHoy?.referencia).toMatchObject({
        cuentas: 1,
        ventasCentavos: String(ARRACHERA_CENTAVOS),
      });
      // Se movió una de las dos cuentas de hoy a la semana pasada: hoy queda con una, igual que
      // aquel día, y la diferencia es cero; en la cubeta de aquel día, ya no hay nada que comparar.
      expect(deHoy).toMatchObject({ cuentas: 1, ventasCentavos: String(ARRACHERA_CENTAVOS) });
      expect(deHoy?.diferenciaCentavos).toBe('0');
    },
  );

  it('una cuenta abierta (sin cobrar) no es una venta', { timeout: POR_COMANDOS }, async () => {
    const antes = await serie('anio');
    await sentarYPedir(salon, 3, [{ platillo: 'arrachera', cantidad: '1' }]);
    const despues = await serie('anio');
    expect(despues.totales.cuentas).toBe(antes.totales.cuentas);
    expect(despues.totales.ventasCentavos).toBe(antes.totales.ventasCentavos);
  });

  it('sólo dueño, administrador y gerente', { timeout: POR_COMANDOS }, async () => {
    const salida = await comando(serieDelTableroComando, {
      entrada: { periodo: 'semana' },
      ambito: cajero,
      idempotencyKey: clave(),
    });
    expect(salida.ok).toBe(false);
  });
});
