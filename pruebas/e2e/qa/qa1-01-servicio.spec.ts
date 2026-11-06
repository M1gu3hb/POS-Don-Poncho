import { expect, test, type Page } from '@playwright/test';

import {
  abrirLaCaja,
  abrirLaMesa,
  comandar,
  alMapa,
  mesaEnElServidor,
  comandasDeLaCuenta,
} from '../ayudantes/mesas-heredadas.ts';
import { vigilarFallos } from '../ayudantes/sesion.ts';

import {
  anotar,
  esperadoDelCajon,
  guardarEstado,
  Jornada,
  sesionDeLaCaja,
} from './ayudantes-qa.ts';
import { comoPedido, diezPorCiento, importe, type Renglon } from './carta-qa.ts';
import {
  abrirEstaciones,
  cobrarEnCaja,
  entregarListos,
  pedirLaCuentaQa,
  sacarTodo,
} from './flujos-qa.ts';

/**
 * QA-1 · 01 · LA APERTURA Y LAS PRIMERAS MESAS, con todos los aparatos a la vez:
 *   Caja (PC) y la gerente (tableta) abren su caja; cuatro pantallas de estación (Cocina en la PC,
 *   Bebidas en la tableta, Postres y Barbacoa en teléfonos); Mesero 1 (tableta) y Mesero 2 (teléfono).
 *   Mesa 1: pedido de las cuatro estaciones, servido y cobrado en EFECTIVO con cambio (Caja).
 *   Mesa 7 (desde el teléfono de Mesero 2): cobrada con TARJETA y propina del 15 % (la gerente).
 */

const FONDO_CAJA = 150_000;
const FONDO_GERENTE = 80_000;

const MESA_1: readonly Renglon[] = [
  { platillo: 'quesadilla', veces: 2 },
  { platillo: 'guacamole', veces: 1 },
  { platillo: 'mole', veces: 1 },
  { platillo: 'corona', veces: 2 },
  { platillo: 'coca', veces: 1 },
  { platillo: 'pastel', veces: 1 },
];
const MESA_7: readonly Renglon[] = [
  { platillo: 'tlacoyo', veces: 2 },
  { platillo: 'consome', veces: 1 },
  { platillo: 'victoria', veces: 3 },
  { platillo: 'flan', veces: 1 },
];

test.describe('QA-1 · 01 · apertura y primeras mesas', () => {
  test('cajas, estaciones, mesa 1 en efectivo y mesa 7 con tarjeta', async ({ browser }, info) => {
    test.setTimeout(15 * 60_000);
    const j = new Jornada(browser, info);
    const fallos: (() => void)[] = [];
    try {
      const duena = await j.pagina('Dueño Don Poncho', 'pc');
      const [caja, gerente] = [await j.pagina('Caja', 'pc'), await j.pagina('Gerente', 'tableta')];
      const [mesero1, mesero2] = [
        await j.pagina('Mesero 1', 'tableta'),
        await j.pagina('Mesero 2', 'telefono'),
      ];
      for (const p of [duena, caja, gerente, mesero1, mesero2]) fallos.push(vigilarFallos(p));

      await test.step('las dos cajas abren con su fondo', async () => {
        for (const [pagina, fondo, quien, aparato] of [
          [caja, FONDO_CAJA, 'Caja', 'pc'],
          [gerente, FONDO_GERENTE, 'Gerente', 'tableta'],
        ] as const) {
          await pagina.goto('/caja');
          if ((await sesionDeLaCaja(pagina)) === null) await abrirLaCaja(pagina, fondo);
          const sesion = await sesionDeLaCaja(pagina);
          expect(sesion, `La caja de ${quien} no quedó abierta.`).not.toBeNull();
          guardarEstado({ [`caja${quien}`]: sesion, [`fondo${quien}`]: fondo });
          anotar({
            aparato,
            quien,
            accion: `Abre caja con fondo ${String(fondo / 100)} pesos`,
            esperado: `Caja abierta; efectivo esperado en cajón = ${String(fondo / 100)}`,
            datos: { fondoCentavos: fondo },
          });
          expect(await esperadoDelCajon(pagina)).toBe(fondo);
        }
      });

      const cocinas = await abrirEstaciones(j);
      for (const p of Object.values(cocinas)) fallos.push(vigilarFallos(p));
      await mesero1.goto('/mesero');
      await mesero2.goto('/mesero');

      await test.step('mesa 1 (Mesero 1, tableta): cuatro estaciones, efectivo con cambio', async () => {
        const total = importe(MESA_1);
        const propina = diezPorCiento(total);
        const { ordenId } = await abrirLaMesa(mesero1, duena, 1, 4);
        await comandar(mesero1, 1, comoPedido(MESA_1));
        await expect
          .poll(async () => (await comandasDeLaCuenta(duena, ordenId)).length, {
            message: 'La mesa 1 debía partirse en una comanda por estación (4).',
          })
          .toBe(4);
        await alMapa(mesero1);
        expect(await sacarTodo(cocinas, MESA_1)).toBe(4);
        await entregarListos(mesero1, 1);
        await pedirLaCuentaQa(mesero1, 1, '10%');
        await alMapa(mesero1);
        const hecho = await cobrarEnCaja(
          caja,
          /^Mesa 1 Cuenta/,
          'Mesa 1',
          { metodo: 'Efectivo', recibidoCentavos: 50_000 },
          10,
        );
        expect(hecho).toMatchObject({
          ventaCentavos: total,
          propinaCentavos: propina,
          cambioCentavos: 50_000 - total - propina,
        });
        anotar({
          aparato: 'pc',
          quien: 'Caja',
          accion: 'Cobra la mesa 1 en efectivo ($500 recibidos)',
          detalle: 'Mesero 1: 2 quesadillas, guacamole, mole, 2 Corona, Coca, pastel; propina 10 %',
          esperado: `venta ${String(total)}, propina ${String(propina)}, cambio ${String(50_000 - total - propina)} centavos`,
          datos: {
            tipo: 'cobro',
            mesa: 1,
            caja: 'Caja',
            venta: total,
            propina,
            efectivo: total + propina,
            tarjeta: 0,
            transferencia: 0,
            cambio: 50_000 - total - propina,
          },
        });
        await exigirMesaRecogida(duena, 1);
      });

      await test.step('mesa 7 (Mesero 2, teléfono): tarjeta con propina del 15 %', async () => {
        const total = importe(MESA_7);
        const propina = Math.round(total * 0.15);
        const { ordenId } = await abrirLaMesa(mesero2, duena, 7, 2);
        await comandar(mesero2, 7, comoPedido(MESA_7));
        await expect.poll(async () => (await comandasDeLaCuenta(duena, ordenId)).length).toBe(3);
        await alMapa(mesero2);
        expect(await sacarTodo(cocinas, MESA_7)).toBe(3);
        await entregarListos(mesero2, 7);
        await pedirLaCuentaQa(mesero2, 7, '15%');
        await alMapa(mesero2);
        const hecho = await cobrarEnCaja(
          gerente,
          /^Mesa 7 Cuenta/,
          'Mesa 7',
          { metodo: 'Tarjeta' },
          15,
        );
        expect(hecho).toMatchObject({ ventaCentavos: total, propinaCentavos: propina });
        anotar({
          aparato: 'tableta',
          quien: 'Gerente',
          accion: 'Cobra la mesa 7 con tarjeta',
          detalle: 'Mesero 2: 2 tlacoyos, consomé, 3 Victoria, flan; propina 15 %',
          esperado: `venta ${String(total)}, propina ${String(propina)} (tarjeta)`,
          datos: {
            tipo: 'cobro',
            mesa: 7,
            caja: 'Gerente',
            venta: total,
            propina,
            efectivo: 0,
            tarjeta: total + propina,
            transferencia: 0,
            cambio: 0,
          },
        });
      });
      for (const exigir of fallos) exigir();
    } finally {
      await j.cerrar();
    }
  });
});

/** La mesa quedó libre y sin cuenta viva en el servidor. */
async function exigirMesaRecogida(duena: Page, numero: number): Promise<void> {
  await expect
    .poll(async () => (await mesaEnElServidor(duena, numero)).estado, {
      message: `La mesa ${String(numero)} cobrada no pasó a limpieza ni a libre.`,
    })
    .toMatch(/limpieza|libre/);
}
