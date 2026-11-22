import { sesionDeLaCaja } from '../ayudantes/conciliacion.ts';
import {
  CARTA,
  abrirLaCaja,
  cerrarElTicket,
  cuentaEnElServidor,
  leerElCobro,
  mesaEnElServidor,
  pesos,
  yaAbierto,
} from '../ayudantes/mesas-heredadas.ts';
import { Equipo } from '../ayudantes/roles.ts';
import {
  cabecerasDeEscrituraDePrueba,
  consultarPuente,
  exigirDemostracion,
} from '../ayudantes/sesion.ts';

import { navegadorDe, prepararContexto } from './arnes/ligero.ts';
import { expect, exigirServidor, test } from './arnes/prueba.ts';
import { toque } from './arnes/toque.ts';
import { vigilarPagina } from './arnes/vigilancia.ts';

import type { Page } from '@playwright/test';

/**
 * H5 · A9 · COBRAR UNA PARTE DE UNA CUENTA DIVIDIDA CON LA PROPINA POR DECIDIR, EN LA TABLETA.
 *
 * La semana simulada (DP-18) encontró que, al abrir la parte de una cuenta dividida cuya propina la
 * decide la caja, el diálogo de cobro y el de «propina» se abrían A LA VEZ: Radix esconde uno al
 * lector de pantalla y, en la tableta, «Cobrar» dejaba de responder; el día 4 quedaron 7 cuentas
 * divididas a medias. El arreglo (Caja.jsx: el cobro se abre con `!showPropinaCaja`) los pone UNO
 * TRAS OTRO: primero la propina, y al elegirla, el cobro.
 *
 * La evidencia es el mutante: deshacer `&& !showPropinaCaja` hace caer la primera aserción (dos
 * diálogos abiertos a la vez). Corre sólo en la tableta vertical (`tableta-800x1280`), con dedo.
 */

const SLUG = 'prueba-restaurante';
const MESA = 4;
const PERFIL_DE_LA_PRUEBA = 'tableta-800x1280';

interface Datos<T> {
  readonly ok?: boolean;
  readonly datos?: T;
}

/** Un comando como lo llama la pantalla (por su ruta), con la sesión de esa página. */
async function mandar<T>(page: Page, ruta: string, cuerpo: unknown): Promise<T> {
  const respuesta = await page.request.post(ruta, {
    headers: cabecerasDeEscrituraDePrueba(),
    data: cuerpo,
  });
  const texto = await respuesta.text();
  expect(respuesta.status(), `${ruta} → ${texto.slice(0, 300)}`).toBe(200);
  const salida = JSON.parse(texto) as Datos<T>;
  expect(salida.ok, `${ruta} → ${texto.slice(0, 300)}`).toBe(true);
  return salida.datos as T;
}

test.describe('A9 · una parte cobrada con la propina por decidir (tableta)', () => {
  test.use({ actionTimeout: 120_000, navigationTimeout: 240_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('la propina y el cobro se abren uno tras otro, «Cobrar» responde y la cuenta no queda a medias', async ({
    browser,
    aparato,
  }, info) => {
    test.skip(aparato.id !== PERFIL_DE_LA_PRUEBA, `A9 se mide en ${PERFIL_DE_LA_PRUEBA}.`);
    test.setTimeout(8 * 60_000);
    const equipo = new Equipo(navegadorDe(browser, aparato), SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await prepararContexto(duena.context(), aparato);
      const resetear = await duena.request.post('/api/pruebas/resetear', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { confirmacion: 'RESETEAR' },
      });
      expect(resetear.status(), await resetear.text()).toBe(200);

      const rosa = await equipo.pagina(info, 'cajero');
      await prepararContexto(rosa.context(), aparato);
      vigilarPagina(rosa);
      await rosa.goto('/caja', { waitUntil: 'domcontentloaded' });
      if ((await sesionDeLaCaja(rosa)) === null) await abrirLaCaja(rosa, 150_000);

      // ── La cuenta, hasta «cuenta solicitada» con la propina por decidir en caja ─────────────
      const { mesaId } = await mesaEnElServidor(duena, MESA);
      const abierta = await mandar<{ ordenId: string }>(duena, '/api/restaurante/abrir-mesa', {
        mesaId,
        personas: 2,
      });
      const ordenId = abierta.ordenId;
      const carta = await consultarPuente<{ id?: string; nombre?: string }>(
        duena,
        'ProductoTerminado',
        { filtro: { activo: true }, limite: 200 },
      );
      const productoId = (nombre: string): string => {
        const id = carta.find((p) => p.nombre === nombre)?.id;
        expect(id, `La carta de la demo no trae «${nombre}».`).toBeTruthy();
        return id ?? '';
      };
      await mandar(duena, '/api/restaurante/enviar-pedido', {
        ordenId,
        lineas: [
          { productoId: productoId(CARTA.arrachera.nombre), cantidad: '1' },
          { productoId: productoId(CARTA.cerveza.nombre), cantidad: '1' },
        ],
      });
      await mandar(duena, '/api/restaurante/solicitar-cuenta', {
        ordenId,
        aunConPendientes: true,
        propinaTipo: 'decidir_en_caja',
      });
      const lineas = await consultarPuente<{ id?: string; producto_nombre?: string }>(
        duena,
        'DetalleVenta',
        { filtro: { venta_id: ordenId }, limite: 20 },
      );
      const lineaId = (nombre: string): string => {
        const id = lineas.find((l) => l.producto_nombre === nombre)?.id;
        expect(id, `La cuenta no trae la línea de «${nombre}».`).toBeTruthy();
        return id ?? '';
      };
      const division = await mandar<{
        hijas: readonly { ordenId: string; etiqueta: string; totalCentavos: string }[];
      }>(duena, '/api/restaurante/dividir-cuenta', {
        ordenId,
        particiones: [
          { tomas: [{ lineaId: lineaId(CARTA.arrachera.nombre), cantidad: 1 }] },
          { tomas: [{ lineaId: lineaId(CARTA.cerveza.nombre), cantidad: 1 }] },
        ],
      });
      expect(division.hijas).toHaveLength(2);

      // ── La cajera cobra cada parte, con el dedo ───────────────────────────────────────────
      await rosa.reload({ waitUntil: 'domcontentloaded' });
      await toque(rosa, rosa.getByRole('tab', { name: /^Pendientes/ }));
      const abiertos = rosa.locator('[role="dialog"][data-state="open"]');

      for (const [indice, hija] of division.hijas.entries()) {
        const parte = indice + 1;
        await test.step(`la parte ${String(parte)}: propina primero, cobro después`, async () => {
          await toque(
            rosa,
            rosa
              .getByRole('button', {
                name: new RegExp(`^Mesa ${String(MESA)} · cuenta ${String(parte)} de 2 `),
              })
              .first(),
          );

          // A9 · UN solo diálogo abierto: el de la propina. Con el arreglo deshecho son dos.
          await expect(
            abiertos,
            'El cobro y la propina están abiertos a la vez (A9): uno queda escondido al dedo y al lector.',
          ).toHaveCount(1);
          const propina = rosa.getByRole('dialog').filter({ hasText: 'Sin propina' });
          await yaAbierto(propina);
          await toque(rosa, propina.getByRole('button', { name: 'Sin propina' }));

          // Elegida la propina, el cobro de ESA parte ya está disponible y UNO solo está abierto.
          const cobro = rosa.getByRole('dialog').filter({ hasText: 'Cobrar —' });
          await yaAbierto(cobro);
          await expect(abiertos).toHaveCount(1);
          const importe = Number(hija.totalCentavos);
          await cobro.getByPlaceholder('0.00').fill(pesos(importe));

          // «Cobrar» responde al toque en la tableta: sale la petición y el servidor contesta 200.
          const [respuesta] = await Promise.all([
            rosa.waitForResponse(
              (r) =>
                new URL(r.url()).pathname === '/api/venta/cobrar' &&
                r.request().method() === 'POST',
            ),
            toque(rosa, cobro.getByRole('button', { name: /^Cobrar \$/ })),
          ]);
          const salida = await leerElCobro(respuesta);
          expect(salida.estado, salida.mensaje ?? '').toBe(200);
          expect(salida.ok, salida.mensaje ?? '').toBe(true);
          await cerrarElTicket(rosa);
        });
      }

      // ── Nada a medias ─────────────────────────────────────────────────────────────────────
      for (const hija of division.hijas) {
        expect((await cuentaEnElServidor(duena, hija.ordenId)).estado, hija.etiqueta).toBe(
          'pagada',
        );
      }
      // Con la última parte cobrada la mesa ya no espera cuenta.
      await expect
        .poll(async () => (await mesaEnElServidor(duena, MESA)).estado)
        .not.toBe('cuenta_solicitada');
    } finally {
      await equipo.cerrar();
    }
  });
});
