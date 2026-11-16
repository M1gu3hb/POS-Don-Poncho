import type { Ambito } from '@morphiqpos/contracts';
import { repoCaja } from '@morphiqpos/data';
import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { avisoDeEfectivoNegativo } from '@morphiqpos/domain/gastos';
import { beforeAll, describe, expect, it } from 'vitest';

import { nombrarCajas } from '../caja/lugares.ts';
import { hojaDelCorte } from '../caja/corte/documento.ts';
import { cerrarCaja } from '../caja/sesion.ts';
import { comando } from '../produccion.ts';
import { abrirCajaReal, clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { ambitoDeCaja, sembrarSalon, type Salon } from '../restaurante/pruebas/salon-real.ts';
import { registrarCompra, registrarGasto } from './index.ts';
import { cajonParaPagar, pagosDeLaCaja } from './pago-de-la-caja.ts';

/**
 * DP-21 · Bloque 11 · LOS GASTOS DE LA CAJA SON LOS DE COMPRAS Y GASTOS, contra Postgres.
 *
 * Un gasto en efectivo hecho en la Caja, uno en efectivo hecho en Compras y gastos (desde un
 * aparato sin caja propia) y otro por transferencia en Compras y gastos:
 *
 *   · Compras y gastos enseña los TRES (una sola tabla, `gastos`);
 *   · el corte resta DOS (la transferencia no sacó nada del cajón) y su renglón «Compras y gastos
 *     pagados de la caja» los lista;
 *   · el efectivo esperado cuadra al centavo, y no se cuenta doble;
 *   · cada pago en efectivo dice de qué caja salió («Caja principal», el nombre del Bloque 5);
 *   · una COMPRA pagada en efectivo hace lo mismo (A11/H4).
 */

const POR_COMANDOS = 120_000;
const FONDO = 50_000;
const GASTO_DE_LA_CAJA = 12_000;
const GASTO_DE_COMPRAS_EN_EFECTIVO = 8_000;
const GASTO_POR_TRANSFERENCIA = 30_000;
const COMPRA_EN_EFECTIVO = 5_000;

let salon: Salon;
let enLaCaja: Ambito;
let sinCaja: Ambito;

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Fonda del Gasto', mesas: 2, terminales: 2 });
  const duenoId = await sembrarCompanero(salon.negocio, { nombre: 'Don Poncho', rol: 'dueno' });
  enLaCaja = { ...ambitoDeCaja(salon, 0), rol: 'dueno', empleoId: duenoId };
  sinCaja = { ...ambitoDeCaja(salon, 1), rol: 'dueno', empleoId: duenoId };
  exigirOk(
    await comando(nombrarCajas, {
      entrada: { nombres: ['Caja principal'] },
      ambito: enLaCaja,
      idempotencyKey: clave(),
    }),
    'caja.nombrar_cajas',
  );
}, POR_COMANDOS);

let sesionCajaId = '';

const pesos = (centavos: number): string => `${String(Math.trunc(centavos / 100))}.00`;

const gasto = (
  ambito: Ambito,
  categoria: string,
  descripcion: string,
  centavos: number,
  metodoPago: 'efectivo' | 'tarjeta' | 'transferencia',
) =>
  comando(registrarGasto, {
    entrada: { categoria, descripcion, monto: pesos(centavos), metodoPago },
    ambito,
    idempotencyKey: clave(),
  });

const cajon = async (ambito: Ambito) =>
  exigirOk(
    await comando(cajonParaPagar, { entrada: {}, ambito, idempotencyKey: clave() }),
    'gastos.cajon_para_pagar',
  );

const hoja = async () =>
  exigirOk(
    await comando(hojaDelCorte, {
      entrada: { sesionCajaId },
      ambito: enLaCaja,
      idempotencyKey: clave(),
    }),
    'caja.hoja_del_corte',
  );

describe('de qué caja sale el efectivo (antes de guardar)', () => {
  it('sin caja abierta lo dice: no hay de dónde sacarlo', { timeout: POR_COMANDOS }, async () => {
    const antes = await cajon(enLaCaja);
    expect(antes).toEqual({ caso: 'ninguna', caja: null });
    expect((await gasto(enLaCaja, 'otro', 'Sin caja abierta', 1_000, 'efectivo')).ok).toBe(false);
  });

  it(
    'la caja de este aparato, o, si no tiene, la otra abierta; con su nombre y su esperado',
    { timeout: POR_COMANDOS },
    async () => {
      sesionCajaId = await abrirCajaReal(enLaCaja, FONDO);
      const propia = await cajon(enLaCaja);
      expect(propia.caso).toBe('una');
      expect(propia.caja).toMatchObject({
        sesionCajaId,
        nombre: 'Caja principal',
        esDeEsteAparato: true,
        esperadoCentavos: String(FONDO),
      });
      const ajena = await cajon(sinCaja);
      expect(ajena.caja).toMatchObject({
        sesionCajaId,
        nombre: 'Caja principal',
        esDeEsteAparato: false,
      });
    },
  );
});

describe('un gasto en la Caja, uno en efectivo y otro por transferencia en Compras y gastos', () => {
  it(
    'Compras y gastos enseña 3, el corte resta 2 y el esperado cuadra al centavo',
    { timeout: POR_COMANDOS },
    async () => {
      const deLaCaja = exigirOk(
        await gasto(enLaCaja, 'servicios', 'Garrafón (Caja)', GASTO_DE_LA_CAJA, 'efectivo'),
        'gasto de la Caja',
      );
      // Una categoría que la Caja no ofrecía antes (había 5): ya es del mismo catálogo.
      const deCompras = exigirOk(
        await gasto(
          sinCaja,
          'pago_extraordinario',
          'Plomero (Compras)',
          GASTO_DE_COMPRAS_EN_EFECTIVO,
          'efectivo',
        ),
        'gasto en efectivo de Compras',
      );
      const porTransferencia = exigirOk(
        await gasto(sinCaja, 'marketing', 'Volantes', GASTO_POR_TRANSFERENCIA, 'transferencia'),
        'gasto por transferencia',
      );

      // Compras y gastos: los tres, en la misma tabla.
      const filas = await obtenerDb()
        .selectFrom('gastos')
        .select(['id', 'metodo_pago', 'sesion_caja_id'])
        .where('organizacion_id', '=', salon.negocio.organizacionId)
        .execute();
      expect(filas).toHaveLength(3);
      expect(filas.filter((f) => f.sesion_caja_id !== null)).toHaveLength(2);

      // Cada pago en efectivo dice de qué caja salió; el de transferencia no.
      const { pagos } = exigirOk(
        await comando(pagosDeLaCaja, {
          entrada: {
            gastoIds: [deLaCaja.gastoId, deCompras.gastoId, porTransferencia.gastoId],
          },
          ambito: enLaCaja,
          idempotencyKey: clave(),
        }),
        'gastos.pagos_de_la_caja',
      );
      expect(pagos.map((p) => [p.id, p.frase]).sort()).toEqual(
        [
          [deLaCaja.gastoId, 'Pagado en efectivo de Caja principal'],
          [deCompras.gastoId, 'Pagado en efectivo de Caja principal'],
        ].sort(),
      );

      // El corte resta DOS, con su renglón propio, y el esperado cuadra.
      const salidas = GASTO_DE_LA_CAJA + GASTO_DE_COMPRAS_EN_EFECTIVO;
      const esperado = FONDO - salidas;
      const corte = await hoja();
      expect(corte.movimientos.find((m) => m.tipo === 'gasto')).toMatchObject({
        montoCentavos: String(-salidas),
        cuantos: 2,
      });
      expect(corte.pagadosDeLaCaja.map((p) => [p.origen, p.descripcion, p.montoCentavos])).toEqual([
        ['gasto', 'Garrafón (Caja)', String(GASTO_DE_LA_CAJA)],
        ['gasto', 'Plomero (Compras)', String(GASTO_DE_COMPRAS_EN_EFECTIVO)],
      ]);
      expect(corte.pagadosDeLaCaja.reduce((s, p) => s + Number(p.montoCentavos), 0)).toBe(salidas);
      // No cuenta doble: los gastos del corte son los mismos dos, no los tres ni cuatro.
      expect(corte.gastos).toHaveLength(2);
      const cascada = corte.movimientos.reduce((s, m) => s + Number(m.montoCentavos), 0);
      expect(cascada).toBe(esperado);
      const arqueo = await conTransaccion((tx) =>
        repoCaja.arqueoDeSesion(tx, salon.negocio.organizacionId, sesionCajaId),
      );
      expect(Number(arqueo.efectivoEsperadoCentavos)).toBe(esperado);
      expect((await cajon(enLaCaja)).caja?.esperadoCentavos).toBe(String(esperado));
    },
  );

  it(
    'una compra pagada en efectivo sale del mismo cajón, se lista y también cuadra (A11 y H4)',
    { timeout: POR_COMANDOS },
    async () => {
      const compra = exigirOk(
        await comando(registrarCompra, {
          entrada: {
            proveedorNombre: 'Don Beto',
            metodoPago: 'efectivo',
            lineas: [
              {
                nuevo: { nombre: 'Servilletas', unidadBase: 'pieza' },
                cantidadCapturada: '100',
                unidadCapturada: 'pieza',
                equivalencia: '1',
                costoTotal: pesos(COMPRA_EN_EFECTIVO),
              },
            ],
          },
          ambito: sinCaja,
          idempotencyKey: clave(),
        }),
        'compras.registrar',
      );
      const { pagos } = exigirOk(
        await comando(pagosDeLaCaja, {
          entrada: { compraIds: [compra.compraId] },
          ambito: enLaCaja,
          idempotencyKey: clave(),
        }),
        'gastos.pagos_de_la_caja',
      );
      expect(pagos).toEqual([
        {
          tipo: 'compra',
          id: compra.compraId,
          caja: 'Caja principal',
          frase: 'Pagado en efectivo de Caja principal',
        },
      ]);
      const salidas = GASTO_DE_LA_CAJA + GASTO_DE_COMPRAS_EN_EFECTIVO + COMPRA_EN_EFECTIVO;
      const corte = await hoja();
      expect(corte.pagadosDeLaCaja.map((p) => [p.origen, p.descripcion])).toEqual([
        ['gasto', 'Garrafón (Caja)'],
        ['gasto', 'Plomero (Compras)'],
        ['compra', 'Compra a Don Beto'],
      ]);
      expect(corte.pagadosDeLaCaja.reduce((s, p) => s + Number(p.montoCentavos), 0)).toBe(salidas);
      // La compra no es un gasto operativo: no entra a la utilidad, pero sí al renglón del cajón.
      expect(corte.gastos).toHaveLength(2);
      const esperado = FONDO - salidas;
      expect(corte.movimientos.reduce((s, m) => s + Number(m.montoCentavos), 0)).toBe(esperado);
    },
  );

  it(
    'si el gasto dejaría el esperado en negativo, el aviso sale con lo que hay (aviso, no bloqueo)',
    { timeout: POR_COMANDOS },
    async () => {
      const hay = BigInt((await cajon(enLaCaja)).caja?.esperadoCentavos ?? '0');
      expect(avisoDeEfectivoNegativo(hay, 100n)).toBeNull();
      const demasiado = hay + 1_000n;
      expect(avisoDeEfectivoNegativo(hay, demasiado)).toBe(
        `La caja sólo tiene $${(Number(hay) / 100).toFixed(2)}. ¿Lo pagaste de la caja? Si no, regístralo con transferencia o tarjeta`,
      );
      // No bloquea: el servidor lo registra (puede haberlo pagado de la caja y estar en negativo).
      const pesosDeMas = `${String(Math.trunc(Number(demasiado) / 100))}.${String(Number(demasiado) % 100).padStart(2, '0')}`;
      const salida = await comando(registrarGasto, {
        entrada: {
          categoria: 'otro',
          descripcion: 'Más de lo que había',
          monto: pesosDeMas,
          metodoPago: 'efectivo',
        },
        ambito: enLaCaja,
        idempotencyKey: clave(),
      });
      expect(salida.ok).toBe(true);
    },
  );

  it(
    'el cierre usa el mismo esperado: contado menos esperado es la diferencia, al centavo',
    { timeout: POR_COMANDOS },
    async () => {
      const hay = Number((await cajon(enLaCaja)).caja?.esperadoCentavos ?? '0');
      const contado = Math.max(hay, 0);
      const cierre = exigirOk(
        await comando(cerrarCaja, {
          entrada: { efectivoContadoCentavos: contado },
          ambito: enLaCaja,
          idempotencyKey: clave(),
        }),
        'caja.cerrar',
      );
      expect(cierre.efectivoEsperadoCentavos).toBe(String(hay));
      expect(cierre.diferenciaCentavos).toBe(String(contado - hay));
    },
  );
});
