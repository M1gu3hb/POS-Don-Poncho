import { expect, type Locator, type Page, test, type TestInfo } from '@playwright/test';

import {
  categoriaA,
  crearEstacion,
  laEstacion,
  platilloDe,
  type Estacion,
} from './ayudantes/estaciones.ts';
import { botonDeLaMesa, dialogoDeLaMesa, laMesa, yaAbierto } from './ayudantes/mesas-heredadas.ts';
import { escribir } from './ayudantes/modo-espera.ts';
import { Equipo } from './ayudantes/roles.ts';
import {
  abrirCajaPorLaRuta,
  cabecerasDeEscrituraDePrueba,
  consultarPuente,
  exigirDemostracion,
  vigilarFallos,
} from './ayudantes/sesion.ts';

/**
 * DP-25 · PARTE 2 · PEDIR LA CUENTA CON PLATILLOS PENDIENTES, CON EL DEDO.
 *
 * Una mesa con un platillo de la Parrilla sin preparar y una bebida de la Barra lista pero sin
 * entregar. Pedir la cuenta avisa en grande —«Estos platillos no se han preparado:» y «Estos están
 * listos pero no se han entregado:», por estación—; «Regresar» no cambia nada y «Pedir la cuenta
 * de todos modos» la pide. Se comprueba en el SERVIDOR, en la tableta y el teléfono, y desde las
 * dos pantallas que la piden: la mesa del administrador y la tableta del mesero.
 */

const SLUG = 'prueba-restaurante';
const BLANCO_DEL_DEDO = 44;
const N = String(100 + Math.floor(Math.random() * 900));
const PARRILLA = `Parrilla ${N}`;
const MESA_DEL_ADMINISTRADOR = 3;
const MESA_DEL_MESERO = 4;

interface PlatilloLeido {
  readonly id?: string;
  readonly producto_nombre?: string | null;
}
interface ComandaLeida {
  readonly items?: readonly PlatilloLeido[];
}

interface Mesa {
  readonly mesaId: string;
  readonly ordenId: string;
  readonly fuerte: string;
  readonly bebida: string;
}

async function tocar(objetivo: Locator, info: TestInfo): Promise<void> {
  await (info.project.use.hasTouch === true ? objetivo.tap() : objetivo.click());
}

async function exigirBlancoDelDedo(objetivo: Locator, info: TestInfo): Promise<void> {
  if (info.project.use.hasTouch !== true) return;
  const caja = await objetivo.boundingBox();
  expect(caja, 'El botón no se pinta.').not.toBeNull();
  expect(caja?.height ?? 0, 'El blanco mide menos de 44 px de alto.').toBeGreaterThanOrEqual(
    BLANCO_DEL_DEDO,
  );
}

async function estadoDeLaCuenta(lector: Page, ordenId: string): Promise<string> {
  const [venta] = await consultarPuente<{ estado?: string }>(lector, 'Venta', {
    filtro: { id: ordenId },
    limite: 1,
  });
  return venta?.estado ?? '';
}

/** Dos estaciones, una mesa abierta con un platillo de cada una, y la bebida lista sin entregar. */
async function prepararLaMesa(
  duena: Page,
  numero: number,
  parrilla: Estacion,
  barra: Estacion,
): Promise<Mesa> {
  await categoriaA(duena, 'Platos fuertes', parrilla);
  await categoriaA(duena, 'Bebidas', barra);
  const fuerte = await platilloDe(duena, 'Platos fuertes');
  const bebida = await platilloDe(duena, 'Bebidas');
  const [mesa] = await consultarPuente<{ id: string }>(duena, 'Mesa', {
    filtro: { numero },
    limite: 1,
  });
  const abierta = await escribir(duena, '/api/restaurante/abrir-mesa', {
    mesaId: mesa?.id,
    personas: 2,
  });
  const ordenId = String(abierta.datos?.['ordenId']);
  await escribir(duena, '/api/restaurante/enviar-pedido', {
    ordenId,
    lineas: [
      { productoId: fuerte.id, cantidad: '1' },
      { productoId: bebida.id, cantidad: '1' },
    ],
  });
  const comandas = await consultarPuente<ComandaLeida>(duena, 'PedidoPreparacion', {
    filtro: { venta_id: ordenId },
    limite: 20,
  });
  const idDeLaBebida = comandas
    .flatMap((c) => c.items ?? [])
    .find((i) => i.producto_nombre === bebida.nombre)?.id;
  expect(idDeLaBebida, 'La bebida no llegó a cocina.').toBeDefined();
  await escribir(duena, '/api/restaurante/mover-platillos', {
    platilloIds: [idDeLaBebida],
    desde: 'nuevo',
    estado: 'en_preparacion',
  });
  await escribir(duena, '/api/restaurante/mover-platillos', {
    platilloIds: [idDeLaBebida],
    desde: 'en_preparacion',
    estado: 'listo',
  });
  return { mesaId: mesa?.id ?? '', ordenId, fuerte: fuerte.nombre, bebida: bebida.nombre };
}

/** El aviso, con las dos listas por estación y sus dos botones al alcance del dedo. */
async function leerElAviso(pagina: Page, mesa: Mesa, info: TestInfo): Promise<Locator> {
  const aviso = pagina.getByRole('dialog', { name: 'A esta mesa todavía le faltan platillos' });
  await yaAbierto(aviso);
  await expect(aviso).toContainText('Estos platillos no se han preparado:');
  await expect(aviso).toContainText('Estos están listos pero no se han entregado:');
  await expect(aviso).toContainText(PARRILLA);
  await expect(aviso).toContainText(mesa.fuerte);
  await expect(aviso).toContainText('Barra');
  await expect(aviso).toContainText(mesa.bebida);
  await exigirBlancoDelDedo(aviso.getByRole('button', { name: 'Regresar' }), info);
  await exigirBlancoDelDedo(
    aviso.getByRole('button', { name: 'Pedir la cuenta de todos modos' }),
    info,
  );
  return aviso;
}

test.describe('pedir la cuenta con platillos pendientes (DP-25 · P2)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('el administrador y la tableta del mesero ven el aviso; «Regresar» no cambia nada y «de todos modos» la pide', async ({
    browser,
  }, info) => {
    test.setTimeout(8 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      const sinFallos = vigilarFallos(duena);
      const reseteo = await duena.request.post('/api/pruebas/resetear', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { confirmacion: 'RESETEAR' },
      });
      expect(reseteo.status(), `resetear: ${await reseteo.text()}`).toBe(200);
      await escribir(duena, '/api/datos/escribir', {
        entidad: 'ConfiguracionNegocio',
        operacion: 'update',
        datos: { estaciones_preparacion_activas: true },
      });
      await abrirCajaPorLaRuta(duena, 100_000);
      await duena.goto('/configuracion?seccion=cocina');
      await crearEstacion(duena, PARRILLA);
      const parrilla = await laEstacion(duena, PARRILLA);
      const barra = await laEstacion(duena, 'Barra');
      const deAdmin = await prepararLaMesa(duena, MESA_DEL_ADMINISTRADOR, parrilla, barra);
      const deMesero = await prepararLaMesa(duena, MESA_DEL_MESERO, parrilla, barra);

      await test.step('el administrador, desde la mesa activa', async () => {
        await duena.goto(`/restaurante/mesa-activa?mesa=${encodeURIComponent(deAdmin.mesaId)}`);
        const pedir = duena.getByRole('button', { name: /^Pedir la cuenta/ });
        await expect(pedir).toBeVisible();
        await exigirBlancoDelDedo(pedir, info);
        await tocar(pedir, info);
        await tocar(duena.getByRole('button', { name: /Sin propina/ }), info);

        const aviso = await leerElAviso(duena, deAdmin, info);
        await tocar(aviso.getByRole('button', { name: 'Regresar' }), info);
        await expect(aviso).toBeHidden();
        expect(
          await estadoDeLaCuenta(duena, deAdmin.ordenId),
          '«Regresar» cambió la cuenta.',
        ).not.toBe('cuenta_solicitada');

        await tocar(pedir, info);
        await tocar(duena.getByRole('button', { name: /Sin propina/ }), info);
        const otraVez = await leerElAviso(duena, deAdmin, info);
        await tocar(otraVez.getByRole('button', { name: 'Pedir la cuenta de todos modos' }), info);
        await expect(duena).toHaveURL(/\/restaurante\/precuenta/);
        expect(await estadoDeLaCuenta(duena, deAdmin.ordenId)).toBe('cuenta_solicitada');
      });

      await test.step('la tableta del mesero, desde el diálogo de la mesa', async () => {
        const mesera = await equipo.pagina(info, 'mesero');
        await mesera.goto('/mesero');
        await expect(laMesa(mesera, MESA_DEL_MESERO)).toBeVisible({ timeout: 30_000 });
        await tocar(laMesa(mesera, MESA_DEL_MESERO), info);
        await yaAbierto(dialogoDeLaMesa(mesera, MESA_DEL_MESERO));
        const solicitar = await botonDeLaMesa(mesera, MESA_DEL_MESERO, 'Solicitar cuenta');
        await tocar(solicitar, info);
        const pregunta = mesera.getByRole('dialog').filter({ hasText: '¿Desean agregar propina?' });
        const avisoDeLaCuenta = mesera.getByRole('dialog', {
          name: 'A esta mesa todavía le faltan platillos',
        });
        await expect(pregunta.or(avisoDeLaCuenta)).toBeVisible({ timeout: 30_000 });
        if (await pregunta.isVisible()) {
          await tocar(pregunta.getByRole('button', { name: 'Sin propina' }), info);
        }

        const aviso = await leerElAviso(mesera, deMesero, info);
        await tocar(aviso.getByRole('button', { name: 'Regresar' }), info);
        await expect(aviso).toBeHidden();
        expect(
          await estadoDeLaCuenta(duena, deMesero.ordenId),
          '«Regresar» cambió la cuenta.',
        ).not.toBe('cuenta_solicitada');

        await tocar(await botonDeLaMesa(mesera, MESA_DEL_MESERO, 'Solicitar cuenta'), info);
        if (await pregunta.isVisible()) {
          await tocar(pregunta.getByRole('button', { name: 'Sin propina' }), info);
        }
        const otraVez = await leerElAviso(mesera, deMesero, info);
        await tocar(otraVez.getByRole('button', { name: 'Pedir la cuenta de todos modos' }), info);
        await expect(
          mesera.getByRole('dialog').filter({ hasText: 'Pre-cuenta lista' }),
        ).toBeVisible({ timeout: 30_000 });
        expect(await estadoDeLaCuenta(duena, deMesero.ordenId)).toBe('cuenta_solicitada');
      });

      sinFallos();
    } finally {
      await equipo.cerrar();
    }
  });
});
