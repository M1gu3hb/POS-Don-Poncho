import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { emular } from '../../apps/web/src/impresion/termico/emulador.ts';
import { puntosNegros } from '../../apps/web/src/impresion/termico/mapa.ts';
import { deBase64 } from '../../apps/web/src/impresion/termico/trabajo.ts';
import { instalarAppFalsa, type EstadoDeLaAppFalsa } from './ayudantes/app-falsa.ts';
import { contextoDe, personaDe } from './ayudantes/roles.ts';

/**
 * DP-20 · LA IMPRESIÓN POR LA APP, DE PUNTA A PUNTA Y SIN HARDWARE.
 *
 * La prueba pone en el navegador una app falsa (`window.MorphiqApp`, el mismo contrato) cuya
 * «impresora» guarda los bytes. Con ella el dueño recorre lo que hará Miguel en cada POS: entra al
 * laboratorio con la contraseña del proveedor, elige la impresora, mira la vista previa, imprime el
 * ticket de ejemplo —y los bytes que recibió la app, leídos por la impresora falsa, son un ticket
 * con tinta y con su corte—, guarda el perfil y ve «Impresora lista ✓» en Configuración → Impresión.
 * Sin la app, la misma pantalla dice que hay que instalarla y nada más cambia.
 *
 * La contraseña de la prueba es desechable: el servidor de la corrida recibe su hash en
 * `PROVEEDOR_CLAVE_HASH` y la prueba la lee de `MORPHIQPOS_E2E_CLAVE_PROVEEDOR`.
 */

const SLUG = 'prueba-restaurante';
const CAPTURAS = process.env['MORPHIQPOS_CAPTURAS'];
const CLAVE = process.env['MORPHIQPOS_E2E_CLAVE_PROVEEDOR'];

async function captura(page: Page, nombre: string): Promise<void> {
  if (CAPTURAS === undefined || CAPTURAS === '') return;
  mkdirSync(CAPTURAS, { recursive: true });
  await page.screenshot({ path: join(CAPTURAS, `${nombre}.png`), fullPage: true });
}

const appFalsa = (page: Page): Promise<EstadoDeLaAppFalsa> =>
  page.evaluate(() => (window as unknown as { __appFalsa: EstadoDeLaAppFalsa }).__appFalsa);

function copias(page: Page): { seccion: Locator; delTicket: Locator; guardar: Locator } {
  const seccion = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Copias de impresión' }) });
  return {
    seccion,
    delTicket: seccion.getByLabel('Copias del ticket de venta'),
    guardar: seccion.getByRole('button', { name: 'Guardar', exact: true }),
  };
}

async function fijarCopiasDelTicket(page: Page, cuantas: 1 | 2): Promise<void> {
  await page.goto('/configuracion?tab=negocio');
  const { delTicket, guardar } = copias(page);
  if ((await delTicket.inputValue()) === String(cuantas)) return;
  await delTicket.selectOption(String(cuantas));
  // Hasta que el servidor conteste: recargar con el guardado en vuelo leería el valor de antes.
  const [respuesta] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/caja/fijar-copias-de-impresion')),
    guardar.click(),
  ]);
  expect(respuesta.ok()).toBe(true);
}

test('con la app: el proveedor deja lista la impresora y el ticket de ejemplo sale como imagen', async ({
  browser,
}, info) => {
  test.setTimeout(240_000);
  expect(CLAVE, 'falta MORPHIQPOS_E2E_CLAVE_PROVEEDOR').toBeTruthy();
  const contexto = await contextoDe(browser, info, personaDe(SLUG, 'dueno'));
  await contexto.addInitScript(instalarAppFalsa);
  const page = await contexto.newPage();
  try {
    // Un aparato recién instalado: con app y sin perfil.
    await page.goto('/configuracion?tab=impresion');
    await expect(
      page.getByText('Este aparato todavía no tiene impresora configurada.'),
    ).toBeVisible();
    await captura(page, '1-impresion-sin-perfil');

    // Las copias: el dueño las cambia y quedan guardadas.
    await fijarCopiasDelTicket(page, 2);
    await page.reload();
    await expect(copias(page).delTicket).toHaveValue('2');

    // La puerta del laboratorio: una contraseña cualquiera no entra; la del proveedor sí.
    await page.getByText('Hardware y pruebas de impresión').first().click();
    await expect(page.getByText('Sólo tu proveedor MORPHIQ puede entrar aquí')).toBeVisible();
    const clave = page.getByLabel('Contraseña del proveedor');
    await clave.fill('no-es-esta');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByText('La contraseña no es correcta.')).toBeVisible();
    await expect(clave).toHaveValue('');
    await captura(page, '2-contrasena-incorrecta');

    await clave.fill(CLAVE ?? '');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('heading', { name: '1 · El aparato' })).toBeVisible();
    // Lo que la plataforma no puede se ve apagado y dice por qué.
    await expect(page.getByText('El USB directo es de Android.')).toBeVisible();

    // Elegir la impresora, mirar la vista previa (sin gastar papel) e imprimir el ejemplo.
    await page.getByRole('radio', { name: /POS-80/ }).check();
    await page.getByRole('button', { name: 'Ver la vista previa' }).click();
    await expect(
      page.getByAltText('Los puntos exactos que saldrían en el papel, en blanco y negro'),
    ).toBeVisible();
    await captura(page, '3-laboratorio-con-vista-previa');

    await page.getByRole('button', { name: 'Imprimir ticket sin logo' }).click();
    await expect.poll(async () => (await appFalsa(page)).trabajos.length).toBe(1);
    const [trabajo] = (await appFalsa(page)).trabajos;
    expect(trabajo?.documento.tipo).toBe('crudo');
    const papel = emular(deBase64(trabajo?.documento.base64 ?? ''), 576);
    expect(papel.ancho).toBe(576);
    expect(papel.alto).toBeGreaterThan(400);
    expect(puntosNegros(papel) / papel.puntos.length).toBeGreaterThan(0.02);
    expect(papel.cortes).toHaveLength(1);
    // Una prueba de impresión no abre el cajón.
    expect(papel.pulsos).toEqual([]);

    // Guardar como el perfil de este aparato: el personal ya lo ve listo.
    await page.getByLabel('Nombre del perfil').fill('Caja 1');
    await page.getByRole('button', { name: 'Guardar como perfil de este aparato' }).click();
    await page.goto('/configuracion?tab=impresion');
    await expect(page.getByText('Impresora lista ✓')).toBeVisible();
    await expect(page.getByText('Caja 1')).toBeVisible();
    await captura(page, '4-impresora-lista');

    await page.getByRole('button', { name: 'Página de prueba' }).click();
    await expect.poll(async () => (await appFalsa(page)).paginasDePrueba).toBe(1);
  } finally {
    // El negocio de prueba queda como estaba: una copia.
    await fijarCopiasDelTicket(page, 1);
    await contexto.close();
  }
});

test('sin la app: Impresión dice que hay que instalarla y no ofrece nada del aparato', async ({
  browser,
}, info) => {
  const contexto = await contextoDe(browser, info, personaDe(SLUG, 'dueno'));
  const page = await contexto.newPage();
  try {
    await page.goto('/configuracion?tab=impresion');
    await expect(
      page.getByText('Para imprimir directo y abrir el cajón, instala la app de POS Don Poncho.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Página de prueba' })).toHaveCount(0);
    await expect(page.getByText('Impresora lista ✓')).toHaveCount(0);
  } finally {
    await contexto.close();
  }
});
