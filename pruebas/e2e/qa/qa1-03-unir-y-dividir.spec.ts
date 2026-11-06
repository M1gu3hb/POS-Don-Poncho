import { expect, test } from '@playwright/test';

import {
  abrirLaMesa,
  alMapa,
  avisosDeLaMesa,
  comandar,
  mesaEnElServidor,
  mesaLimpia,
} from '../ayudantes/mesas-heredadas.ts';
import { consultarPuente, vigilarFallos } from '../ayudantes/sesion.ts';

import { anotar, escribir, leerEstado, Jornada } from './ayudantes-qa.ts';
import { comoPedido, importe, M12, M3, M4, PARTE_1, PARTE_2, unidadesDe } from './carta-qa.ts';
import {
  abrirEstaciones,
  cobrarEnCaja,
  entregarListos,
  pedirLaCuentaQa,
  sacarTodo,
} from './flujos-qa.ts';
import { separarMesas, unirMesas } from './unir-qa.ts';
import { agregarAlPortal, pedirAyuda } from './portal-qa.ts';

/**
 * QA-1 · 03 · UNIR, SEPARAR Y DIVIDIR.
 *   Mesas 3 y 4 (con gente, una ya servida y la otra con su comanda en cocina) se unen; la 4 tiene un
 *   teléfono con un pastel armado y una solicitud de ayuda, que deben pasar a la 3 (DP-D56). Se cobran
 *   juntas por TRANSFERENCIA. Mesas 5 y 11 (con gente y un pedido armado desde el teléfono de la 11) se
 *   unen y se separan: el aviso dice que el pedido del portal se quedó en la principal. Mesas 9 y 10
 *   (vacías) se unen y se separan. Mesa 12 se DIVIDE en dos cuentas: efectivo con 10 % y tarjeta con 15 %.
 */

test.describe('QA-1 · 03 · unir, separar y dividir', () => {
  test('mesas 3+4 con gente, 5+11 con portal, 9+10 vacías y la 12 dividida', async ({
    browser,
  }, info) => {
    test.setTimeout(25 * 60_000);
    const j = new Jornada(browser, info);
    const fallos: (() => void)[] = [];
    // Al cobrar mesas unidas la caja llama a liberar sin decisión y el servidor contesta 422: es la pregunta.
    let cobrandoUnidas = false;
    try {
      const tokens = leerEstado()['tokens'] as Record<string, string>;
      const [duena, caja] = [
        await j.pagina('Dueño Don Poncho', 'pc'),
        await j.pagina('Caja', 'pc'),
      ];
      const gerente = await j.pagina('Gerente', 'tableta');
      const mesero1 = await j.pagina('Mesero 1', 'tableta');
      const cocinas = await abrirEstaciones(j);
      for (const p of [duena, caja, gerente, mesero1, ...Object.values(cocinas)]) {
        fallos.push(vigilarFallos(p, { sondeando: () => cobrandoUnidas }));
      }
      await caja.goto('/caja');
      await mesero1.goto('/mesero');

      // ═══ 3 + 4 CON GENTE ═══
      let principal = '';
      await test.step('mesas 3 y 4 se abren y piden; la 4 tiene teléfono con pastel y ayuda', async () => {
        await abrirLaMesa(mesero1, duena, 3, 3);
        await comandar(mesero1, 3, comoPedido(M3));
        await alMapa(mesero1);
        expect(await sacarTodo(cocinas, M3)).toBe(2);
        await entregarListos(mesero1, 3);
        await alMapa(mesero1);
        await abrirLaMesa(mesero1, duena, 4, 2);
        await comandar(mesero1, 4, comoPedido(M4));
        await alMapa(mesero1);
        const tel4 = await j.comensal(tokens['4'] ?? '');
        fallos.push(vigilarFallos(tel4));
        await agregarAlPortal(tel4, 'pastel');
        await pedirAyuda(tel4);
        principal = (await mesaEnElServidor(duena, 3)).mesaId;
      });

      await test.step('se unen: la 4 queda en la 3 y su portal, su carrito y su ayuda la siguen', async () => {
        await unirMesas(mesero1, 3, 4);
        const cuatro = await consultarPuente<{ unida_a_mesa_id?: string | null }>(duena, 'Mesa', {
          filtro: { numero: 4 },
          limite: 1,
        });
        expect(cuatro[0]?.unida_a_mesa_id, 'La 4 no quedó unida a la 3.').toBe(principal);
        const avisos = await avisosDeLaMesa(duena, 3);
        expect(
          avisos.filter((a) => a.estado === 'pendiente'),
          'La ayuda de la 4 no pasó a la 3.',
        ).toHaveLength(1);
        const tel4 = await j.comensal(tokens['4'] ?? '');
        await expect(tel4.getByText(/\bMesa 3(?!\d)/).first()).toBeVisible();
        await expect(tel4.getByRole('button', { name: /^Pedido de la mesa \(1\)/ })).toBeVisible();
        anotar({
          aparato: 'tableta',
          quien: 'Mesero 1',
          accion:
            'Une las mesas 3 (servida) y 4 (en cocina) con un pastel armado y una ayuda en la 4',
          esperado:
            'Mesa 4 unida a la 3; la ayuda y el carrito pasan a la 3; el QR de la 4 abre «Mesa 3»',
        });
      });

      await test.step('cocina, entrega y cobro por TRANSFERENCIA de las dos juntas', async () => {
        expect(await sacarTodo(cocinas, M4)).toBe(1);
        await entregarListos(mesero1, 3);
        await pedirLaCuentaQa(mesero1, 3, null);
        const venta = importe(M3) + importe(M4);
        cobrandoUnidas = true;
        const hecho = await cobrarEnCaja(
          caja,
          /^Mesa 3 Cuenta/,
          'Mesa 3',
          { metodo: 'Transferencia' },
          'Sin propina',
        );
        cobrandoUnidas = false;
        expect(hecho).toMatchObject({ ventaCentavos: venta, propinaCentavos: 0 });
        anotar({
          aparato: 'pc',
          quien: 'Caja',
          accion: 'Cobra las mesas 3+4 unidas por transferencia, sin propina',
          esperado: `venta ${String(venta)} (8700 de la 3 + 9400 de la 4)`,
          datos: {
            tipo: 'cobro',
            mesa: 3,
            caja: 'Caja',
            venta,
            propina: 0,
            efectivo: 0,
            tarjeta: 0,
            transferencia: venta,
            cambio: 0,
          },
        });
        await expect(
          (await j.comensal(tokens['4'] ?? '')).getByRole('button', { name: /^Pedido de la mesa/ }),
          'El carrito de la mesa cobrada sobrevivió (DP-D55).',
        ).toBeHidden({ timeout: 20_000 });
      });

      // ═══ 5 + 11 CON GENTE Y PEDIDO DEL PORTAL; SE SEPARAN ═══
      await test.step('mesas 5 y 11 se unen y se separan: el pedido del portal se queda en la 5, y se dice', async () => {
        const o5 = (await abrirLaMesa(mesero1, duena, 5, 2)).ordenId;
        await alMapa(mesero1);
        await abrirLaMesa(mesero1, duena, 11, 2);
        await alMapa(mesero1);
        const tel11 = await j.comensal(tokens['11'] ?? '');
        await agregarAlPortal(tel11, 'quesadilla', 1, 'Hongos');
        await unirMesas(mesero1, 5, 11);
        const aviso = await separarMesas(mesero1, 5);
        anotar({
          aparato: 'tableta',
          quien: 'Mesero 1',
          accion: 'Une 5 y 11 (con un pedido de portal en la 11) y las separa',
          detalle: `avisos en pantalla: ${aviso}`,
          esperado: 'Aviso «El pedido del portal (1 cosa/s) se quedó en la mesa 5»',
        });
        expect(aviso, 'Separar no dijo dónde quedó el pedido del portal.').toMatch(
          /se quedó en la mesa 5/,
        );
        // La cuenta de la 11 se absorbió en la de la 5 al unirlas (separar no la devuelve, DP-D50).
        await escribir(duena, '/api/restaurante/cancelar-orden', {
          ordenId: o5,
          motivo: 'La mesa se retiró sin pedir',
        });
        anotar({
          aparato: 'pc',
          quien: 'Dueño',
          accion: 'Mesa 5: cancela la cuenta que quedó vacía tras separar (sin pedir nada)',
          esperado: 'Una cancelación antes de prepararse, de $0.00',
          datos: {
            tipo: 'cancelacion',
            mesa: 5,
            que: 'cuenta vacía tras separar',
            monto: 0,
            perdida: 0,
          },
        });
      });

      // ═══ 9 + 10 VACÍAS ═══
      await test.step('mesas 9 y 10, vacías: unir y separar', async () => {
        await unirMesas(duena, 9, 10);
        const diez = await consultarPuente<{ unida_a_mesa_id?: string | null }>(duena, 'Mesa', {
          filtro: { numero: 10 },
          limite: 1,
        });
        expect(diez[0]?.unida_a_mesa_id).toBe((await mesaEnElServidor(duena, 9)).mesaId);
        await separarMesas(duena, 9);
        const despues = await consultarPuente<{ unida_a_mesa_id?: string | null }>(duena, 'Mesa', {
          filtro: { numero: 10 },
          limite: 1,
        });
        expect(despues[0]?.unida_a_mesa_id ?? null).toBeNull();
        anotar({
          aparato: 'pc',
          quien: 'Dueño',
          accion: 'Une y separa las mesas vacías 9 y 10',
          esperado: 'Quedan sueltas, sin cuenta',
        });
      });

      // ═══ DIVIDIR LA 12 ═══
      await test.step('mesa 12: se divide en dos y se cobra efectivo con 10 % y tarjeta con 15 %', async () => {
        const { ordenId } = await abrirLaMesa(mesero1, duena, 12, 4);
        await comandar(mesero1, 12, comoPedido(M12));
        await alMapa(mesero1);
        expect(await sacarTodo(cocinas, M12)).toBe(3);
        await entregarListos(mesero1, 12);
        await pedirLaCuentaQa(mesero1, 12, null);
        // QA1-5: el cajero no llega a esta pantalla (lo manda a /caja, que no divide); la gerente sí, por URL.
        await gerente.goto(`/restaurante/cobro?cuenta=${ordenId}`);
        await gerente.getByRole('button', { name: 'Dividir cuenta', exact: true }).click();
        const dialogo = gerente.getByRole('dialog', { name: 'Dividir la cuenta' });
        const sumar = async (nombre: string, cuenta: number, veces: number) => {
          for (let i = 0; i < veces; i += 1) {
            await dialogo
              .getByRole('button', {
                name: `Añadir ${nombre} a la cuenta ${String(cuenta)}`,
                exact: true,
              })
              .click();
          }
        };
        await expect(
          dialogo.getByText(`Faltan ${String(unidadesDe(M12))} por repartir`),
        ).toBeVisible();
        const nombres = {
          guacamole: 'Guacamole',
          mole: 'Mole con pollo',
          corona: 'Corona',
          coca: 'Coca cola',
        } as const;
        for (const [i, parte] of [PARTE_1, PARTE_2].entries()) {
          for (const r of parte)
            await sumar(nombres[r.platillo as keyof typeof nombres], i + 1, r.veces);
        }
        await expect(dialogo.getByText('Todo repartido')).toBeVisible();
        const dividida = gerente.waitForResponse(
          (r) => new URL(r.url()).pathname === '/api/restaurante/dividir-cuenta',
        );
        await dialogo.getByRole('button', { name: /^Dividir en 2 cuentas/ }).click();
        expect((await dividida).status()).toBe(200);
        await gerente.goto('/caja');
        await gerente.getByRole('tab', { name: /^Pendientes/ }).click();
        await expect(gerente.getByRole('button', { name: /Código: M12-\d+-1/ })).toBeVisible();
        // QA1-6: así salen las dos partes en Pendientes (evidencia para el hallazgo).
        await gerente.screenshot({ path: 'docs/qa/evidencia/partes-de-la-cuenta-dividida.png' });
        const [v1, v2] = [importe(PARTE_1), importe(PARTE_2)];
        expect(v1 + v2).toBe(importe(M12));
        const c1 = await cobrarEnCaja(
          gerente,
          /Código: M12-\d+-1/,
          'Mesa',
          { metodo: 'Efectivo', recibidoCentavos: 30_000 },
          10,
        );
        expect(c1).toMatchObject({ ventaCentavos: v1, propinaCentavos: Math.round(v1 * 0.1) });
        const c2 = await cobrarEnCaja(
          gerente,
          /Código: M12-\d+-2/,
          'Mesa',
          { metodo: 'Tarjeta' },
          15,
        );
        expect(c2).toMatchObject({ ventaCentavos: v2, propinaCentavos: Math.round(v2 * 0.15) });
        // Una cuenta dividida queda en «limpieza» con la última parte: la mesera la deja limpia (y sin
        // eso el cierre de caja se niega: «Hay mesas pendientes»).
        await mesero1.goto('/mesero');
        expect(await mesaLimpia(mesero1, duena, 12)).toBe(true);
        for (const [parte, hecho, efectivo, tarjeta, cambio] of [
          [1, c1, v1 + c1.propinaCentavos, 0, 30_000 - v1 - c1.propinaCentavos],
          [2, c2, 0, v2 + c2.propinaCentavos, 0],
        ] as const) {
          anotar({
            aparato: 'tableta',
            quien: 'Gerente',
            accion: `Cobra la mesa 12 · cuenta ${String(parte)} de 2`,
            esperado: `venta ${String(hecho.ventaCentavos)}, propina ${String(hecho.propinaCentavos)}`,
            datos: {
              tipo: 'cobro',
              mesa: 12,
              caja: 'Gerente',
              venta: hecho.ventaCentavos,
              propina: hecho.propinaCentavos,
              efectivo,
              tarjeta,
              transferencia: 0,
              cambio,
            },
          });
        }
      });
      for (const exigir of fallos) exigir();
    } finally {
      await j.cerrar();
    }
  });
});
