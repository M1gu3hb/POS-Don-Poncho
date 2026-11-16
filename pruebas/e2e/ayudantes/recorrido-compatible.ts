import { expect, type Locator, type Page } from '@playwright/test';

import { AGOTADO, conPlazo } from './con-plazo.ts';
import { personaDe } from './roles.ts';
import {
  cobrarLaCuenta,
  dejarLaSalaComoEstaba,
  entrarALaCaja,
  tomarLaOrden,
  tomarUnPedidoParaLlevar,
  pedirLaCuentaDeLaMesa,
} from './recorrido-sala.ts';
import type { AlFallar, AlLlegar, EnLaParada } from './recorrido-tipos.ts';
import { entradaDe } from './sesion.ts';

export {
  PARADAS,
  type AlFallar,
  type AlLlegar,
  type Llegada,
  type Parada,
} from './recorrido-tipos.ts';

/**
 * EL RECORRIDO COMPATIBLE (DP-20): las pantallas que importan del POS, en un orden que se puede
 * repetir, para verlas en el Chromium viejo de los POS reales y en el Chrome de hoy.
 *
 * `recorrer` recibe una pestaña SIN sesión: entra con el PIN de la dueña por la interfaz, abre la
 * caja, toma y cobra una mesa, arma un pedido para llevar, mira Configuración y el laboratorio del
 * proveedor, y deja el negocio como lo encontró (la caja cerrada, la mesa libre, nada abierto).
 * En cada parada llama a `alLlegar` con la pantalla quieta.
 *
 * Lo que sobrevive a la corrida son las ventas que cobró: la segunda vuelta ve el tablero con una
 * venta más. Por eso el tablero va en `tapar` de `inicio`.
 */

const SLUG = 'prueba-restaurante';
/** Lo que se espera a una pestaña que no contesta antes de darla por congelada. */
const PACIENCIA_MS = 10_000;
const CLAVE_DEL_PROVEEDOR = process.env['MORPHIQPOS_E2E_CLAVE_PROVEEDOR'];

/** ¿Contesta la pestaña? Una congelada no contesta ni a `evaluate`. */
async function respondeEnElPlazo(page: Page): Promise<boolean> {
  return (
    (await conPlazo(
      page.evaluate(() => true),
      PACIENCIA_MS,
    )) !== AGOTADO
  );
}

/** Un tramo: si se cae y alguien escucha, queda pendiente y el recorrido sigue. */
async function tramo(
  nombre: string,
  alFallar: AlFallar | undefined,
  andar: () => Promise<void>,
): Promise<void> {
  try {
    await andar();
  } catch (error) {
    if (alFallar === undefined) throw error;
    await alFallar(nombre, error);
  }
}

/**
 * Del tablero cambia lo que depende del día y de lo que ya se vendió: la fecha, las cifras, la
 * gráfica, la guía de primeros pasos y el aviso de la caja. La segunda vuelta ve las ventas de la
 * primera.
 */
function loQueCambiaEnElTablero(page: Page): Locator[] {
  return [
    page.getByText(/^Restaurante de prueba · /),
    page.getByText(/pasos completados/),
    page.getByRole('listitem').filter({ hasText: /^\d\. / }),
    page.getByText(/^(No hay caja abierta|Caja abierta)/),
    page.getByText(/^\$[\d,]+\.\d{2}$/),
    page.getByText(/^\d+ tickets?$/),
    page.getByText(/% margen$/),
    page.getByRole('application'),
    page.getByText(/^(Sin ventas hoy|Sin cortes en este rango|Inventario en buen estado)$/),
  ];
}

/** La pantalla de acceso: el teclado a la vista, la dueña elegida, el PIN tecleado. */
async function entrarConElPin(
  page: Page,
  alLlegar: EnLaParada,
  alFallar: AlFallar | undefined,
): Promise<Page> {
  const duena = personaDe(SLUG, 'dueno');
  await page.goto(entradaDe(SLUG));
  await expect(page.getByRole('button', { name: '1', exact: true })).toBeVisible();
  const tarjeta = page.getByRole('button', { name: new RegExp(duena.nombre) });
  await expect(tarjeta).toBeVisible();
  await page.waitForLoadState('networkidle');
  await alLlegar({ nombre: 'login', tapar: [] });

  await tarjeta.click();
  await expect(page.getByText(`Iniciando como: ${duena.nombre}`)).toBeVisible();
  await alLlegar({ nombre: 'login-persona', tapar: [] });

  for (const digito of duena.pin) {
    await page.getByRole('button', { name: digito, exact: true }).click();
  }
  await page.waitForURL((url) => !url.pathname.endsWith('/login-pos'), { waitUntil: 'commit' });
  if (await respondeEnElPlazo(page)) return page;
  if (alFallar === undefined) {
    throw new Error('Tras el PIN la pestaña no respondió: el tablero no se pintó.');
  }
  // Hallazgo: se da por escrito y el recorrido sigue en una pestaña nueva, cargando el tablero de cero.
  await alFallar(
    'inicio tras el PIN: la pestaña se congeló (ni page.evaluate responde)',
    new Error(`La pestaña no respondió en ${String(PACIENCIA_MS)} ms tras teclear el PIN.`),
  );
  const nueva = await page.context().newPage();
  await nueva.goto('/');
  await conPlazo(page.close({ runBeforeUnload: false }), PACIENCIA_MS);
  return nueva;
}

/** Configuración, pestaña por pestaña, hasta el laboratorio del proveedor. */
async function recorrerConfiguracion(page: Page, alLlegar: EnLaParada): Promise<void> {
  await page.goto('/configuracion');
  await expect(page.getByRole('tab', { name: 'Este aparato' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await alLlegar({ nombre: 'configuracion', tapar: [] });

  await page.getByRole('tab', { name: 'Este aparato' }).click();
  await expect(page.getByRole('region', { name: 'Impresora de este aparato' })).toBeVisible();
  await alLlegar({ nombre: 'configuracion-impresion', tapar: [] });
}

/** Configuración → Laboratorio del proveedor → «Hardware y pruebas de impresión», con la contraseña del proveedor. */
async function recorrerElLaboratorio(page: Page, alLlegar: EnLaParada): Promise<void> {
  expect(CLAVE_DEL_PROVEEDOR, 'falta MORPHIQPOS_E2E_CLAVE_PROVEEDOR').toBeTruthy();
  await page.goto('/configuracion?seccion=laboratorio');
  await page.getByRole('button', { name: 'Hardware y pruebas de impresión' }).click();
  await page.getByLabel('Contraseña del proveedor').fill(CLAVE_DEL_PROVEEDOR ?? '');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  const sesion = page.getByRole('region', { name: 'Sesión del proveedor' });
  await expect(sesion).toBeVisible();
  // «Probar compatibilidad»: cada motor dice su nivel. Esa sección es lo único de la pantalla que
  // TIENE que ser distinto en cada motor (su versión, lo que entiende): se tapa, y el nivel viaja
  // en la nota de la parada para que la prueba lo exija.
  const motor = page.getByRole('region', { name: 'El motor de este aparato' });
  await motor.getByRole('button', { name: 'Probar compatibilidad' }).click();
  const nivel = await motor.locator('[data-nivel-del-motor]').getAttribute('data-nivel-del-motor');
  await alLlegar({ nombre: 'laboratorio', tapar: [motor], nota: nivel ?? 'sin nivel' });
  // El laboratorio no se deja abierto: la sesión del proveedor se cierra con «Salir».
  await sesion.getByRole('button', { name: 'Salir' }).click();
  await expect(sesion).toHaveCount(0);
}

export async function recorrer(
  pestana: Page,
  alLlegar: AlLlegar,
  alFallar?: AlFallar,
): Promise<void> {
  // La pestaña activa puede cambiar una vez (si la primera se congela): cada parada dice cuál.
  let page = pestana;
  const enLaParada: EnLaParada = ({ nombre, tapar, nota }) =>
    alLlegar({
      nombre,
      pagina: page,
      // Los avisos que flotan (toasts) salen y se van solos: en toda parada se tapan.
      tapar: [...tapar, page.getByRole('region', { name: /Notifications/ })],
      ...(nota === undefined ? {} : { nota }),
    });
  page = await entrarConElPin(pestana, enLaParada, alFallar);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  await enLaParada({ nombre: 'inicio', tapar: loQueCambiaEnElTablero(page) });
  try {
    await tramo('sala', alFallar, async () => {
      await entrarALaCaja(page);
      const ordenId = await tomarLaOrden(page, enLaParada);
      await pedirLaCuentaDeLaMesa(page, ordenId);
      await cobrarLaCuenta(page, enLaParada);
      await tomarUnPedidoParaLlevar(page, enLaParada);
    });
  } finally {
    await dejarLaSalaComoEstaba(page);
  }
  await tramo('configuración', alFallar, () => recorrerConfiguracion(page, enLaParada));
  await tramo('laboratorio', alFallar, () => recorrerElLaboratorio(page, enLaParada));
}
