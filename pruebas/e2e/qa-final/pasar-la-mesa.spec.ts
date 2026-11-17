import { join } from 'node:path';

import { laMesa, mesaEnElServidor, yaAbierto } from '../ayudantes/mesas-heredadas.ts';
import { Equipo, contextoDe } from '../ayudantes/roles.ts';
import {
  cabecerasDeEscrituraDePrueba,
  consultarPuente,
  exigirDemostracion,
} from '../ayudantes/sesion.ts';

import { navegadorDe, prepararContexto } from './arnes/ligero.ts';
import { expect, exigirServidor, test } from './arnes/prueba.ts';
import { toque } from './arnes/toque.ts';
import { vigilarPagina } from './arnes/vigilancia.ts';

import type { BrowserContext, Page } from '@playwright/test';

/**
 * «PASAR LA MESA A OTRO MESERO» EN EL NAVEGADOR (DP-D156), con la asignación de mesas activa.
 *
 * La dueña abre la mesa de Lupita en «Mesa activa», toca «Pasar la mesa a otro mesero», ve a los
 * meseros ACTIVOS (sin Lupita, que ya la tiene, ni la caja ni la cocina), elige a Mario y confirma.
 * Con la asignación de mesas activa el plano de cada mesero se filtra por la asignación: la mesa
 * tiene que aparecer en el plano de Mario y desaparecer del de Lupita. Y Lupita, que es mesera, no
 * ve el botón (relevar es de quien manda el turno).
 *
 * El mesero «Mario» es un empleado de prueba que la spec da de alta en la base desechable (con un
 * PIN de prueba inventado aquí, que sólo existe en esa base). Corre en cualquier aparato del arnés.
 */

const SLUG = 'prueba-restaurante';
const MESA = 5;
const MESERO_NUEVO = 'Mario';
const PIN_DE_PRUEBA_DE_MARIO = '5871';
const TITULO = 'Pasar la mesa a otro mesero';

interface Datos<T> {
  readonly ok?: boolean;
  readonly datos?: T;
}

async function mandar<T>(page: Page, ruta: string, cuerpo: unknown): Promise<T> {
  const respuesta = await page.request.post(ruta, {
    headers: cabecerasDeEscrituraDePrueba(),
    data: cuerpo,
  });
  const texto = await respuesta.text();
  expect(respuesta.status(), `${ruta} → ${texto.slice(0, 300)}`).toBe(200);
  return (JSON.parse(texto) as Datos<T>).datos as T;
}

test.describe('pasar la mesa a otro mesero', () => {
  test.use({ actionTimeout: 60_000, navigationTimeout: 120_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('la mesa pasa del plano de Lupita al de Mario, y sólo lo ve quien manda', async ({
    browser,
    aparato,
  }, info) => {
    test.setTimeout(10 * 60_000);
    const navegador = navegadorDe(browser, aparato);
    const equipo = new Equipo(navegador, SLUG);
    const abiertosDeMario: BrowserContext[] = [];
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await prepararContexto(duena.context(), aparato);
      const reseteo = await duena.request.post('/api/pruebas/resetear', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { confirmacion: 'RESETEAR' },
      });
      expect(reseteo.status(), await reseteo.text()).toBe(200);

      // ── Preparación: Mario existe y está activo, la asignación de mesas está encendida ────────
      const plantilla = () =>
        consultarPuente<{ id?: string; nombre?: string; rol?: string; activo?: boolean }>(
          duena,
          'UsuarioPOS',
          { filtro: { activo: true }, limite: 200 },
        );
      if (!(await plantilla()).some((u) => u.nombre === MESERO_NUEVO)) {
        await mandar(duena, '/api/identidad/empleados', {
          nombre: MESERO_NUEVO,
          puesto: 'mesero',
          pin: PIN_DE_PRUEBA_DE_MARIO,
        });
      }
      const personal = await plantilla();
      const idDe = (nombre: string): string => {
        const id = personal.find((u) => u.nombre === nombre)?.id;
        expect(id, `La demo no trae a «${nombre}».`).toBeTruthy();
        return id ?? '';
      };
      const lupita = idDe('Lupita');
      idDe(MESERO_NUEVO);
      await mandar(duena, '/api/datos/escribir', {
        entidad: 'ConfiguracionNegocio',
        operacion: 'update',
        datos: { asignacion_mesas_activa: true },
      });

      // ── Lupita abre la mesa 5 y pide algo; la mesa es SUYA (asignada y atendida) ─────────────
      const paginaDeLupita = await equipo.pagina(info, 'mesero');
      await prepararContexto(paginaDeLupita.context(), aparato);
      vigilarPagina(paginaDeLupita);
      const { mesaId } = await mesaEnElServidor(duena, MESA);
      await mandar(duena, '/api/datos/escribir', {
        entidad: 'Mesa',
        operacion: 'update',
        id: mesaId,
        datos: { mesero_asignado_id: lupita },
      });
      const abierta = await mandar<{ ordenId: string }>(
        paginaDeLupita,
        '/api/restaurante/abrir-mesa',
        { mesaId, personas: 2 },
      );
      const carta = await consultarPuente<{ id?: string; nombre?: string }>(
        duena,
        'ProductoTerminado',
        { filtro: { activo: true }, limite: 200 },
      );
      const cerveza = carta.find((p) => p.nombre === 'Cerveza clara 355 ml')?.id;
      expect(cerveza, 'La carta de la demo no trae la cerveza.').toBeTruthy();
      await mandar(paginaDeLupita, '/api/restaurante/enviar-pedido', {
        ordenId: abierta.ordenId,
        lineas: [{ productoId: cerveza, cantidad: '1' }],
      });
      await expect
        .poll(async () => (await mesaEnElServidor(duena, MESA)).mesero ?? '')
        .toMatch(/Lupita/);

      // Lupita ve su mesa en su plano; Mario, no.
      const paginaDeMario = await test.step('Mario entra a su plano', async () => {
        const contextoDeMario = await contextoDe(
          navegador,
          info,
          { slug: SLUG, nombre: MESERO_NUEVO, pin: PIN_DE_PRUEBA_DE_MARIO, rol: 'mesero' },
          join('pruebas', 'e2e', '.sesiones', `${SLUG}-mesero-mario-spec-pasar.json`),
        );
        abiertosDeMario.push(contextoDeMario);
        await prepararContexto(contextoDeMario, aparato);
        const pagina = contextoDeMario.pages()[0] ?? (await contextoDeMario.newPage());
        vigilarPagina(pagina);
        return pagina;
      });
      await paginaDeLupita.goto('/mesero', { waitUntil: 'domcontentloaded' });
      await paginaDeMario.goto('/mesero', { waitUntil: 'domcontentloaded' });
      await expect(laMesa(paginaDeLupita, MESA)).toBeVisible();
      await expect(
        laMesa(paginaDeMario, MESA),
        'Con la asignación activa, Mario no debería ver la mesa de Lupita.',
      ).toHaveCount(0);

      // ── Lupita, que es mesera, no ve el botón de pasar la mesa ────────────────────────────
      const rutaDeLaMesa = `/restaurante/mesa-activa?mesa=${mesaId}`;
      await paginaDeLupita.goto(rutaDeLaMesa, { waitUntil: 'domcontentloaded' });
      await expect(paginaDeLupita.getByRole('button', { name: /^Pedir la cuenta/ })).toBeVisible();
      await expect(
        paginaDeLupita.getByRole('button', { name: new RegExp(TITULO, 'i') }),
        'La mesera no debe poder pasar la mesa: relevar es de quien manda el turno.',
      ).toHaveCount(0);

      // ── La dueña la pasa, con el dedo ────────────────────────────────────────────────────
      await duena.goto(rutaDeLaMesa, { waitUntil: 'domcontentloaded' });
      await toque(duena, duena.getByRole('button', { name: new RegExp(TITULO, 'i') }));
      const dialogo = duena.getByRole('dialog', { name: new RegExp(TITULO, 'i') });
      await yaAbierto(dialogo);
      // Los meseros ACTIVOS, sin quien ya la tiene y sin la caja, la cocina o el almacén.
      await expect(dialogo.getByRole('button', { name: MESERO_NUEVO, exact: true })).toBeVisible();
      for (const fuera of ['Lupita', 'Rosa', 'Toño', 'Nacho', 'Beatriz']) {
        await expect(
          dialogo.getByRole('button', { name: new RegExp(`^${fuera}`) }),
          `«${fuera}» no debería ofrecerse para recibir la mesa.`,
        ).toHaveCount(0);
      }
      await toque(duena, dialogo.getByRole('button', { name: MESERO_NUEVO, exact: true }));
      await expect(dialogo.getByText(`¿Pasar la mesa ${String(MESA)} de Lupita`)).toBeVisible();
      const [respuesta] = await Promise.all([
        duena.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === '/api/restaurante/relevar' &&
            r.request().method() === 'POST',
        ),
        toque(duena, dialogo.getByRole('button', { name: /^Pasar la mesa$/ })),
      ]);
      expect(respuesta.status(), await respuesta.text()).toBe(200);
      await expect(
        duena.getByText(`La mesa ${String(MESA)} quedó con ${MESERO_NUEVO}`),
      ).toBeVisible();
      await duena.screenshot({
        path: join('qa', 'qa-final', 'capturas', 'pasar-la-mesa', aparato.id, 'mesa-pasada.png'),
      });

      // ── El servidor y los dos planos ─────────────────────────────────────────────────────
      await expect
        .poll(async () => (await mesaEnElServidor(duena, MESA)).mesero ?? '')
        .toMatch(/Mario/);
      await paginaDeLupita.goto('/mesero', { waitUntil: 'domcontentloaded' });
      await paginaDeMario.goto('/mesero', { waitUntil: 'domcontentloaded' });
      await expect(
        laMesa(paginaDeMario, MESA),
        'La mesa pasada no apareció en el plano de Mario.',
      ).toBeVisible();
      await expect(
        laMesa(paginaDeLupita, MESA),
        'La mesa pasada sigue en el plano de Lupita.',
      ).toHaveCount(0);
      await paginaDeMario.screenshot({
        path: join('qa', 'qa-final', 'capturas', 'pasar-la-mesa', aparato.id, 'plano-de-mario.png'),
      });
    } finally {
      for (const c of abiertosDeMario) await c.close();
      await equipo.cerrar();
    }
  });
});
