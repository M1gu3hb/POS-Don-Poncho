import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { configuracionDelNegocio } from './ayudantes/mesas-heredadas.ts';
import { Equipo, opcionesDelProyecto } from './ayudantes/roles.ts';
import {
  cabecerasDeEscrituraDePrueba,
  consultarPuente,
  entrar,
  exigirDemostracion,
  vigilarFallos,
} from './ayudantes/sesion.ts';

/**
 * DP-14 · ronda 2 · USUARIOS: puestos reales, editarse, PIN, desactivar y repartir mesas.
 * En teléfono (360 px), tableta y escritorio.
 *
 *   · El dueño se edita (nombre y PIN), su puesto sigue siendo «Dueño» y no se cambia; entra con el
 *     PIN nuevo.
 *   · Renombrar a la gerente la deja «Gerente»; la gerente no ve Caja ni Descuentos ni edita gente.
 *   · Desactivar pide confirmación y no queda pegado al lápiz; «Ver desactivados» y «Reactivar».
 *   · Repartir mesas entre meseros, de una vez; al desactivar a un mesero sus mesas quedan sin
 *     asignar y las ve otro mesero.
 */

const SLUG = 'prueba-restaurante';
const PUESTOS = ['Dueño', 'Administrador', 'Gerente', 'Cajero', 'Mesero', 'Cocina', 'Almacén'];

const aLaMedida = async (pagina: Page, info: TestInfo): Promise<void> => {
  if (info.project.name === 'tablet') await pagina.setViewportSize({ width: 1280, height: 800 });
  if (info.project.name === 'telefono') await pagina.setViewportSize({ width: 360, height: 740 });
};

async function resetear(pagina: Page): Promise<void> {
  const reseteo = await pagina.request.post('/api/pruebas/resetear', {
    headers: cabecerasDeEscrituraDePrueba(),
    data: { confirmacion: 'RESETEAR' },
  });
  expect(reseteo.status(), `resetear_demo: ${await reseteo.text()}`).toBe(200);
}

const fila = (pagina: Page, nombre: string) =>
  pagina.getByTestId('fila-de-usuario').filter({ hasText: nombre });

async function abrirUsuarios(pagina: Page): Promise<void> {
  await pagina.goto('/configuracion?tab=usuarios');
  await expect(pagina.getByRole('tab', { name: 'Usuarios POS' })).toBeVisible();
  await expect(fila(pagina, 'Dueña de prueba')).toBeVisible();
}

/** Teclea el NIP nuevo dos veces en el diálogo de un usuario. */
async function ponerNip(pagina: Page, nip: string, conSwitch: boolean): Promise<void> {
  const dialogo = pagina.getByRole('dialog');
  if (conSwitch) await dialogo.getByRole('switch').first().click();
  const campos = dialogo.getByPlaceholder('••••');
  await campos.nth(0).fill(nip);
  await campos.nth(1).fill(nip);
}

type Mesas = readonly { numero: number; mesero_asignado_id: string | null }[];
const mesasDelServidor = async (pagina: Page): Promise<Mesas> =>
  consultarPuente<Mesas[number]>(pagina, 'Mesa', { limite: 100 });
const asignadasA = (mesas: Mesas, numeros: number[]): (string | null)[] =>
  numeros.map((n) => mesas.find((m) => m.numero === n)?.mesero_asignado_id ?? null);

test.describe('usuarios y mesas (DP-14, ronda 2)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('el dueño se edita, cambia su nombre y su PIN, y entra con él', async ({
    browser,
  }, info) => {
    test.setTimeout(4 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    const otro = await browser.newContext(opcionesDelProyecto(info));
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await aLaMedida(duena, info);
      const sinFallos = vigilarFallos(duena);
      await resetear(duena);
      await abrirUsuarios(duena);

      await duena.getByRole('button', { name: 'Editar a Dueña de prueba' }).click();
      const dialogo = duena.getByRole('dialog');
      await expect(dialogo.getByTestId('puesto-propio')).toContainText('Dueño');
      await expect(dialogo.getByRole('combobox', { name: 'Puesto' })).toHaveCount(0);
      await dialogo.getByPlaceholder('Nombre del usuario').fill('Doña Teresa');
      await ponerNip(duena, '4321', true);
      await dialogo.getByRole('button', { name: 'Guardar' }).click();

      await expect(duena.getByText('Usuario actualizado')).toBeVisible();
      await expect(fila(duena, 'Doña Teresa')).toContainText('Dueño');
      await expect(fila(duena, 'Doña Teresa')).not.toContainText('Administrador');

      // Entra con el PIN NUEVO, como el dueño (la barra lateral de administración lo prueba).
      const pagina = await otro.newPage();
      await entrar(pagina, { slug: SLUG, nombre: 'Doña Teresa', pin: '4321' });
      await pagina.goto('/configuracion?tab=usuarios');
      await expect(fila(pagina, 'Doña Teresa')).toContainText('Dueño');
      // El reseteo repone el PIN pero no el nombre: se deja como estaba, por la misma pantalla.
      await duena.getByRole('button', { name: 'Editar a Doña Teresa' }).click();
      const vuelta = duena.getByRole('dialog');
      await vuelta.getByPlaceholder('Nombre del usuario').fill('Dueña de prueba');
      await ponerNip(duena, '1234', true);
      await vuelta.getByRole('button', { name: 'Guardar' }).click();
      await expect(fila(duena, 'Dueña de prueba')).toBeVisible();
      sinFallos();
      await resetear(duena);
    } finally {
      await otro.close();
      await equipo.cerrar();
    }
  });

  test('renombrar a la gerente la deja gerente; ella no ve Caja ni Descuentos ni edita gente', async ({
    browser,
  }, info) => {
    test.setTimeout(4 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await aLaMedida(duena, info);
      const sinFallos = vigilarFallos(duena);
      await resetear(duena);
      const gerente = await equipo.pagina(info, 'gerente');
      await aLaMedida(gerente, info);

      await abrirUsuarios(duena);
      // El dueño ve los siete puestos al dar de alta, con su nombre.
      await duena.getByRole('button', { name: 'Nuevo usuario' }).click();
      await duena.getByRole('dialog').getByRole('combobox', { name: 'Puesto' }).click();
      await expect(duena.getByRole('option')).toHaveText(PUESTOS);
      await duena.keyboard.press('Escape');
      await duena.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
      await expect(duena.getByRole('tab', { name: 'Caja', exact: true })).toBeVisible();
      await expect(duena.getByRole('tab', { name: 'Descuentos', exact: true })).toBeVisible();

      await duena.getByRole('button', { name: 'Editar a Beatriz', exact: true }).click();
      await duena.getByPlaceholder('Nombre del usuario').fill('Beatriz S. la gerente');
      await duena.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click();
      await expect(duena.getByText('Usuario actualizado')).toBeVisible();
      await expect(fila(duena, 'Beatriz S. la gerente')).toContainText('Gerente');

      // Su sesión sigue viva (no se la cerraron por cambiarle el nombre) y no ve lo del mando.
      await gerente.goto('/configuracion?tab=usuarios');
      await expect(gerente.getByRole('tab', { name: 'Usuarios POS' })).toBeVisible();
      await expect(fila(gerente, 'Beatriz S. la gerente')).toContainText('Gerente');
      await expect(gerente.getByRole('tab', { name: 'Caja', exact: true })).toHaveCount(0);
      await expect(gerente.getByRole('tab', { name: 'Descuentos', exact: true })).toHaveCount(0);
      await expect(gerente.getByRole('button', { name: 'Nuevo usuario' })).toHaveCount(0);
      await expect(gerente.getByRole('button', { name: /^Editar a / })).toHaveCount(0);
      // El reseteo no repone nombres: Beatriz vuelve a ser Beatriz por la misma pantalla.
      await duena.getByRole('button', { name: 'Editar a Beatriz S. la gerente' }).click();
      await duena.getByPlaceholder('Nombre del usuario').fill('Beatriz');
      await duena.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click();
      await expect(fila(duena, 'Beatriz')).toContainText('Gerente');
      sinFallos();
      await resetear(duena);
    } finally {
      await equipo.cerrar();
    }
  });

  test('desactivar pide confirmación, no queda pegado al lápiz, y se reactiva', async ({
    browser,
  }, info) => {
    test.setTimeout(4 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await aLaMedida(duena, info);
      const sinFallos = vigilarFallos(duena);
      await resetear(duena);
      await abrirUsuarios(duena);

      const lapiz = duena.getByRole('button', { name: 'Editar a Rosa', exact: true });
      const bote = duena.getByRole('button', { name: 'Desactivar a Rosa', exact: true });
      const [a, b] = [await lapiz.boundingBox(), await bote.boundingBox()];
      expect(a && b ? b.x - (a.x + a.width) : 0, 'El bote está pegado al lápiz.').toBeGreaterThan(
        8,
      );
      expect(b?.width ?? 0).toBeGreaterThanOrEqual(36);
      expect((b?.x ?? 0) + (b?.width ?? 0)).toBeLessThanOrEqual(
        info.project.name === 'telefono' ? 360 : 4000,
      );

      await bote.click();
      const aviso = duena.getByRole('alertdialog');
      await expect(aviso).toContainText('¿Desactivar a Rosa?');
      await aviso.getByRole('button', { name: 'Cancelar' }).click();
      await expect(fila(duena, 'Rosa')).toBeVisible();

      await bote.click();
      await duena.getByRole('alertdialog').getByRole('button', { name: 'Sí, desactivar' }).click();
      await expect(duena.getByText('Usuario desactivado')).toBeVisible();
      await expect(fila(duena, 'Rosa')).toHaveCount(0);

      await duena.getByRole('button', { name: 'Ver desactivados' }).click();
      const inactivos = duena.getByLabel('Usuarios desactivados');
      await expect(inactivos).toContainText('Rosa');
      await duena.getByRole('button', { name: 'Reactivar a Rosa' }).click();
      await expect(duena.getByText('Usuario reactivado')).toBeVisible();
      await expect(fila(duena, 'Rosa').first()).toBeVisible();
      sinFallos();
      await resetear(duena);
    } finally {
      await equipo.cerrar();
    }
  });

  test('repartir mesas de una vez; al desactivar al mesero sus mesas las ve otro', async ({
    browser,
  }, info) => {
    test.setTimeout(6 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    const otro = await browser.newContext(opcionesDelProyecto(info));
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await aLaMedida(duena, info);
      const sinFallos = vigilarFallos(duena);
      await resetear(duena);

      // La asignación de mesas encendida (Operación) y un segundo mesero, Memo, con su PIN.
      await duena.goto('/configuracion');
      await duena.getByRole('tab', { name: 'Operación' }).click();
      const asignacion = duena
        .getByText('Activar asignación de mesas a meseros')
        .locator('xpath=ancestor::div[contains(@class,"flex items-start")][1]')
        .getByRole('switch');
      if ((await asignacion.getAttribute('aria-checked')) !== 'true') await asignacion.click();
      await duena.getByRole('button', { name: 'Guardar configuración' }).first().click();
      await expect
        .poll(async () => (await configuracionDelNegocio(duena))['asignacion_mesas_activa'])
        .toBe(true);

      await abrirUsuarios(duena);
      await duena.getByRole('button', { name: 'Nuevo usuario' }).click();
      const alta = duena.getByRole('dialog');
      await alta.getByPlaceholder('Nombre del usuario').fill('Memo Mesero');
      await alta.getByRole('combobox', { name: 'Puesto' }).click();
      await duena.getByRole('option', { name: 'Mesero', exact: true }).click();
      await ponerNip(duena, '8080', false);
      await alta.getByRole('button', { name: 'Guardar' }).click();
      await expect(duena.getByText('Usuario creado')).toBeVisible();

      // Repartir: tres mesas a Lupita en un solo acto.
      await duena.goto('/configuracion?tab=mesas');
      await duena.getByRole('button', { name: 'Repartir mesas' }).click();
      const reparto = duena.getByRole('dialog');
      await reparto.getByRole('radio', { name: /Lupita/ }).click();
      for (const n of [1, 2, 3])
        await reparto.getByRole('checkbox', { name: `Mesa ${n}`, exact: true }).click();
      await reparto.getByRole('button', { name: 'Repartir', exact: true }).click();
      await expect(duena.getByText('3 mesa(s) para Lupita')).toBeVisible();
      const lupita = (
        await consultarPuente<{ id: string; nombre: string }>(duena, 'UsuarioPOS')
      ).find((u) => u.nombre.startsWith('Lupita'))?.id;
      expect(lupita, 'Lupita no está en la plantilla.').toBeTruthy();
      await expect
        .poll(async () => asignadasA(await mesasDelServidor(duena), [1, 2, 3]))
        .toEqual([lupita, lupita, lupita]);

      // Se va Lupita: sus mesas quedan sin asignar (en el servidor) y Memo las ve.
      await abrirUsuarios(duena);
      await duena.getByRole('button', { name: /^Desactivar a Lupita/ }).click();
      await duena.getByRole('alertdialog').getByRole('button', { name: 'Sí, desactivar' }).click();
      await expect(duena.getByText('Usuario desactivado')).toBeVisible();
      await expect
        .poll(async () => asignadasA(await mesasDelServidor(duena), [1, 2, 3]))
        .toEqual([null, null, null]);

      const pagina = await otro.newPage();
      await aLaMedida(pagina, info);
      await entrar(pagina, { slug: SLUG, nombre: 'Memo Mesero', pin: '8080' });
      await pagina.goto('/mesero');
      // Las tres mesas que eran de Lupita siguen en su mapa, «Sin mesero asignado». En el teléfono
      // son tarjetas («1 Libre …»); en tableta y escritorio, mosaicos con su número.
      for (const n of [1, 2, 3]) {
        await expect(
          pagina
            .getByRole('button', { name: new RegExp(`^${String(n)} Libre`) })
            .or(pagina.getByText(String(n), { exact: true }))
            .first(),
        ).toBeVisible();
      }
      await expect(pagina.getByText(/Sin mesero/).first()).toBeVisible();
      await expect(pagina.getByText('No tienes mesas asignadas')).toHaveCount(0);
      sinFallos();
      await resetear(duena);
    } finally {
      await otro.close();
      await equipo.cerrar();
    }
  });
});
