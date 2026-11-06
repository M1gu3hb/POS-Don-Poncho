import { expect, test, type Page } from '@playwright/test';

import {
  comandasDeLaCuenta,
  mesaEnElServidor,
  unidadesEsperadas,
  unidadesPorPlatillo,
} from '../ayudantes/mesas-heredadas.ts';
import { enviarElPedidoDeLaMesa } from '../ayudantes/pedido-de-la-mesa.ts';
import { vigilarFallos } from '../ayudantes/sesion.ts';

import { anotar, leerEstado, Jornada, loQueDijo, ultimoSonido } from './ayudantes-qa.ts';
import { comoPedido, importe, type Renglon } from './carta-qa.ts';
import {
  abrirEstaciones,
  cobrarEnCaja,
  entregarListos,
  pedirLaCuentaQa,
  sacarTodo,
} from './flujos-qa.ts';
import { agregarAlPortal, escanearConLista, quienEnviaDesdeElPortal } from './portal-qa.ts';

/**
 * QA-1 · 02 · EL PORTAL DEL COMENSAL, con teléfonos de verdad (un contexto de navegador por teléfono):
 *   Mesa 2 · «Sólo el mesero envía»: tres teléfonos arman el pedido, uno llama al mesero; Mesero 1
 *   (tableta) lo ve en «Solicitudes» con su voz, escanea (lista, sin cámara), abre la mesa, quita
 *   una línea y lo manda a SU nombre. Cobro en efectivo con cambio y propina de 5 % (Caja).
 *   Mesa 8 · «También los comensales» con apertura de mesa: cuatro teléfonos, uno envía con «¿Ya
 *   pidieron todos?», y la cuenta se cobra MIXTA con propina de 15 % (la gerente, tableta).
 */

const MESA_2 = {
  tel1: [
    { platillo: 'tlacoyo', veces: 2 },
    { platillo: 'quesadilla', veces: 1 },
  ],
  tel2: [
    { platillo: 'corona', veces: 2 },
    { platillo: 'coca', veces: 1 },
  ],
  tel3: [
    { platillo: 'guacamole', veces: 1 },
    { platillo: 'flan', veces: 1 },
  ],
} as const satisfies Record<string, readonly Renglon[]>;
/** Lo que queda cuando el mesero quita el flan. */
const MESA_2_FINAL: readonly Renglon[] = [...MESA_2.tel1, ...MESA_2.tel2, MESA_2.tel3[0]];

const MESA_8: readonly (readonly Renglon[])[] = [
  [{ platillo: 'mole', veces: 1 }],
  [{ platillo: 'victoria', veces: 2 }],
  [{ platillo: 'consome', veces: 2 }],
  [{ platillo: 'pastel', veces: 1 }],
];

async function agregarLote(telefono: Page, lote: readonly Renglon[]): Promise<void> {
  for (const r of lote) {
    await agregarAlPortal(
      telefono,
      r.platillo,
      r.veces,
      r.platillo === 'quesadilla' ? 'Pollo' : undefined,
    );
  }
}

test.describe('QA-1 · 02 · el portal del comensal', () => {
  test('mesa 2: sólo el mesero envía · mesa 8: también los comensales', async ({
    browser,
  }, info) => {
    test.setTimeout(20 * 60_000);
    const j = new Jornada(browser, info);
    const fallos: (() => void)[] = [];
    // Los rechazos de negocio que la pantalla ESPERA (p. ej. un envío del comensal que no le toca).
    const sondeando = false;
    try {
      const tokens = leerEstado()['tokens'] as Record<string, string>;
      const duena = await j.pagina('Dueño Don Poncho', 'pc');
      const [caja, gerente] = [await j.pagina('Caja', 'pc'), await j.pagina('Gerente', 'tableta')];
      const mesero1 = await j.pagina('Mesero 1', 'tableta');
      const mesero2 = await j.pagina('Mesero 2', 'telefono');
      const cocinas = await abrirEstaciones(j);
      for (const p of [duena, caja, gerente, mesero1, mesero2, ...Object.values(cocinas)]) {
        fallos.push(vigilarFallos(p, { sondeando: () => sondeando }));
      }
      await caja.goto('/caja');
      await gerente.goto('/caja');
      await mesero1.goto('/mesero');
      await mesero2.goto('/mesero');

      // ═══ MESA 2 · SÓLO EL MESERO ENVÍA ═══
      await quienEnviaDesdeElPortal(duena, 'mesero', false);
      const telefonos: Page[] = [];
      // La voz de las solicitudes suena SÓLO en la vista «Solicitudes» y para lo que llega con ella abierta
      // (DP-9.3): el mesero la abre ANTES de que los teléfonos llamen.
      await mesero1.getByRole('button', { name: /^Solicitudes/ }).click();
      await expect(mesero1.getByRole('button', { name: /^Solicitudes/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await test.step('mesa 2: tres teléfonos arman el pedido y llaman al mesero', async () => {
        for (const lote of [MESA_2.tel1, MESA_2.tel2, MESA_2.tel3]) {
          const tel = await j.comensal(tokens['2'] ?? '');
          fallos.push(vigilarFallos(tel));
          await agregarLote(tel, lote);
          telefonos.push(tel);
        }
        expect((await mesaEnElServidor(duena, 2)).ordenId, 'La mesa se abrió sola.').toBeNull();
        const uno = telefonos[0];
        if (uno === undefined) throw new Error('No hay teléfonos de comensal.');
        await uno.getByRole('button', { name: /^Pedido de la mesa/ }).click();
        const hoja = uno.getByRole('dialog', { name: 'El pedido de la mesa' });
        await hoja.getByRole('button', { name: 'Llamar a mi mesero para confirmar' }).click();
        await expect(
          uno
            .getByText('Tu pedido está guardado. Tu mesero lo confirma y lo manda a cocina.')
            .first(),
        ).toBeVisible();
        anotar({
          aparato: 'telefono',
          quien: 'Comensales (3 teléfonos)',
          accion: 'Mesa 2: arman el pedido y llaman al mesero',
          esperado: 'Aviso «Pedido listo para confirmar» al mesero; la mesa sigue cerrada',
        });
      });

      await test.step('Mesero 1 lo ve en «Solicitudes», con voz y sonido', async () => {
        const fila = mesero1.getByRole('listitem', { name: /^Mesa 2:/ });
        await expect(fila).toBeVisible({ timeout: 30_000 });
        await expect(fila).toContainText(/Pedido listo para confirmar/);
        await expect
          .poll(async () => (await loQueDijo(mesero1)).join(' | '), {
            message: 'La vista «Solicitudes» no dijo nada de la mesa 2.',
          })
          .toMatch(/Mesa 2/);
        anotar({
          aparato: 'tableta',
          quien: 'Mesero 1',
          accion: 'Ve la solicitud de la mesa 2',
          detalle: `voz: ${(await loQueDijo(mesero1)).join(' | ')}; sonido: ${String(await ultimoSonido(mesero1))}`,
          esperado: 'Aviso con voz «Mesa 2 …» y un sonido de aviso',
        });
        await mesero1.getByRole('button', { name: /^Mesas/ }).click();
      });

      let orden2 = '';
      await test.step('Mesero 1 escanea, abre la mesa, quita el flan y envía a su nombre', async () => {
        await escanearConLista(mesero1, 2);
        const portal = mesero1.getByRole('dialog', { name: 'Portal de la mesa · modo mesero' });
        await expect(portal.getByText('Teléfono 3')).toBeVisible();
        await portal.getByRole('button', { name: 'Abrir la mesa' }).click();
        await expect
          .poll(async () => (await mesaEnElServidor(duena, 2)).ordenId, { timeout: 30_000 })
          .not.toBeNull();
        orden2 = (await mesaEnElServidor(duena, 2)).ordenId ?? '';
        await portal.getByRole('button', { name: `Quitar Flan napolitano` }).click();
        await portal.getByRole('button', { name: 'Confirmar y enviar a cocina' }).click();
        await expect(mesero1.getByText('Pedido de la mesa 2 enviado a cocina.')).toBeVisible();
        for (const tel of telefonos) {
          await expect(tel.getByText(/Pedido enviado: la cocina ya lo tiene/)).toBeVisible();
        }
        const comandas = await comandasDeLaCuenta(duena, orden2);
        expect(unidadesPorPlatillo(comandas)).toEqual(unidadesEsperadas(comoPedido(MESA_2_FINAL)));
      });

      await test.step('cocinas, entrega, cuenta y cobro en efectivo con 5 % (Caja)', async () => {
        const nombres = [...MESA_2_FINAL];
        expect(await sacarTodo(cocinas, nombres)).toBe(2);
        await entregarListos(mesero1, 2);
        await pedirLaCuentaQa(mesero1, 2, null);
        const venta = importe(MESA_2_FINAL);
        const propina = Math.round(venta * 0.05);
        const hecho = await cobrarEnCaja(
          caja,
          /^Mesa 2 Cuenta/,
          'Mesa 2',
          { metodo: 'Efectivo', recibidoCentavos: 27_000 },
          5,
        );
        expect(hecho).toMatchObject({
          ventaCentavos: venta,
          propinaCentavos: propina,
          cambioCentavos: 27_000 - venta - propina,
        });
        anotar({
          aparato: 'pc',
          quien: 'Caja',
          accion: 'Cobra la mesa 2 (portal, sólo mesero envía) en efectivo con 5 %',
          esperado: `venta ${String(venta)}, propina ${String(propina)}, cambio ${String(27_000 - venta - propina)}`,
          datos: {
            tipo: 'cobro',
            mesa: 2,
            caja: 'Caja',
            venta,
            propina,
            efectivo: venta + propina,
            tarjeta: 0,
            transferencia: 0,
            cambio: 27_000 - venta - propina,
          },
        });
      });

      // ═══ MESA 8 · TAMBIÉN LOS COMENSALES, ABREN SU MESA ═══
      await quienEnviaDesdeElPortal(duena, 'comensales', true);
      const cuatro: Page[] = [];
      await test.step('mesa 8: cuatro teléfonos arman; uno envía con «¿Ya pidieron todos?»', async () => {
        for (const lote of MESA_8) {
          const tel = await j.comensal(tokens['8'] ?? '');
          fallos.push(vigilarFallos(tel, { sondeando: () => sondeando }));
          await agregarLote(tel, lote);
          cuatro.push(tel);
        }
        const [primero] = cuatro;
        expect(primero, 'Faltan teléfonos.').toBeDefined();
        const respuesta = await enviarElPedidoDeLaMesa(primero!, tokens['8'] ?? '', 4);
        expect(respuesta.status()).toBe(200);
        const { ordenId } = await mesaEnElServidor(duena, 8);
        expect(ordenId, 'La mesa 8 no quedó abierta por el comensal.').not.toBeNull();
        const comandas = await comandasDeLaCuenta(duena, ordenId ?? '');
        expect(comandas).toHaveLength(4);
        anotar({
          aparato: 'telefono',
          quien: 'Comensales (4 teléfonos)',
          accion: 'Mesa 8: abren la mesa y envían a cocina desde el portal (4 personas)',
          esperado: '4 comandas, una por estación; mesa abierta para 4',
        });
      });

      await test.step('cocinas, entrega y cobro MIXTO con 15 % (la gerente)', async () => {
        const todo = MESA_8.flat();
        expect(await sacarTodo(cocinas, todo)).toBe(4);
        // El teléfono de Mesero 2 lleva rato abierto: se recarga su lista de mesas antes de recoger.
        await mesero2.goto('/mesero');
        await entregarListos(mesero2, 8);
        await pedirLaCuentaQa(mesero2, 8, null);
        const venta = importe(todo);
        const propina = Math.round(venta * 0.15);
        const hecho = await cobrarEnCaja(
          gerente,
          /^Mesa 8 Cuenta/,
          'Mesa 8',
          {
            metodo: 'Mixto',
            efectivoCentavos: 10_000,
            tarjetaCentavos: venta - 10_000,
            propinaTarjetaCentavos: propina,
          },
          15,
        );
        expect(hecho).toMatchObject({ ventaCentavos: venta, propinaCentavos: propina });
        anotar({
          aparato: 'tableta',
          quien: 'Gerente',
          accion:
            'Cobra la mesa 8 (portal, comensales envían) mixto: 100 efectivo + resto tarjeta; propina 15 % en tarjeta',
          esperado: `venta ${String(venta)}, propina ${String(propina)}`,
          datos: {
            tipo: 'cobro',
            mesa: 8,
            caja: 'Gerente',
            venta,
            propina,
            efectivo: 10_000,
            tarjeta: venta - 10_000 + propina,
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
