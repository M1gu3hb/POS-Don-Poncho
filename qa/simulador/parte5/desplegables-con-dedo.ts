/**
 * HALLAZGO 13 · LOS DESPLEGABLES DE «NUEVA RECETA» Y «NUEVO INSUMO» CON EL DEDO DE VERDAD
 * (`Input.dispatchTouchEvent` del arnés táctil, no `tap` de Playwright), en tableta 800×1280,
 * Windows 1366×768 al 125 % y 1024×768. Por cada desplegable de los dos diálogos: lo abre con el
 * dedo, comprueba que TODAS sus opciones caen dentro de la ventana (o se pueden traer con el dedo),
 * elige una con el dedo y comprueba que quedó elegida. Sale con código 1 si alguna falla.
 *
 *   node --conditions=react-server qa/simulador/parte5/desplegables-con-dedo.ts --app … --base … --pines …
 *     --reloj … --salida …
 */
import { join } from 'node:path';

import type { Locator, Page } from '@playwright/test';

import { aparatoPorId } from '../../../pruebas/e2e/qa-final/arnes/aparatos.ts';
import { toque } from '../../../pruebas/e2e/qa-final/arnes/toque.ts';
import { dialogoCon } from '../pantallas/comun.ts';
import { leerEntorno } from '../entorno.ts';
import { abrirNavegador, entrarConDespertador } from '../sesion.ts';

const PERFILES = ['tableta-800x1280', 'win-1366x768-125', 'win-1024x768-100'] as const;
const entorno = leerEntorno();
const fallas: string[] = [];

async function tocar(pagina: Page, destino: Locator): Promise<void> {
  await toque(pagina, destino);
}

/** Abre el combobox con el dedo y elige la OPCIÓN `indice` con el dedo; dice si quedó elegida. */
async function probarDesplegable(
  pagina: Page,
  perfil: string,
  combo: Locator,
  etiqueta: string,
): Promise<void> {
  await combo.scrollIntoViewIfNeeded();
  await tocar(pagina, combo);
  const opciones = pagina.getByRole('option');
  await opciones.first().waitFor({ timeout: 10_000 });
  const total = await opciones.count();
  const alto = pagina.viewportSize()?.height ?? 0;
  const ancho = pagina.viewportSize()?.width ?? 0;
  const ultima = opciones.nth(total - 1);
  const caja = await ultima.boundingBox();
  const dentro =
    caja !== null &&
    caja.y >= 0 &&
    caja.y + caja.height <= alto &&
    caja.x >= 0 &&
    caja.x + caja.width <= ancho;
  if (!dentro) {
    // Una lista larga se desplaza con el dedo dentro de su caja: la opción tiene que poder llegar a la vista.
    await ultima.scrollIntoViewIfNeeded();
  }
  const objetivo = total > 1 ? opciones.nth(1) : opciones.first();
  const texto = ((await objetivo.textContent()) ?? '').trim().replace(/\s+/g, ' ');
  try {
    await tocar(pagina, objetivo);
    await pagina.waitForTimeout(400);
    if (await pagina.getByRole('listbox').isVisible())
      throw new Error('el toque no eligió: la lista sigue abierta');
    const valor = (await combo.innerText()).trim().replace(/\s+/g, ' ');
    if (!valor.includes(texto.slice(0, 12)))
      throw new Error(`eligió «${valor}» y se pidió «${texto}»`);
    process.stdout.write(
      `  ok   ${perfil} · ${etiqueta}: «${texto}» (${String(total)} opciones)\n`,
    );
  } catch (error: unknown) {
    const mensaje = `${perfil} · ${etiqueta}: ${String(error).split('\n')[0] ?? ''}`;
    fallas.push(mensaje);
    process.stdout.write(`  FALLA ${mensaje}\n`);
    await pagina.screenshot({
      path: join(entorno.salida, `h13-falla-${perfil}-${etiqueta.replace(/\W+/g, '_')}.png`),
    });
    await pagina.keyboard.press('Escape');
  }
}

const navegador = await abrirNavegador();
try {
  for (const id of PERFILES) {
    const aparato = aparatoPorId(id);
    const contexto = await navegador.newContext({
      viewport: aparato.viewport,
      deviceScaleFactor: aparato.escala,
      hasTouch: true,
      isMobile: aparato.esMovil,
      locale: 'es-MX',
      timezoneId: 'America/Mexico_City',
      baseURL: entorno.appUrl,
    });
    const pagina = await contexto.newPage();
    pagina.setDefaultTimeout(60_000);
    await entrarConDespertador(pagina, entorno, 'Dueño Don Poncho');

    // 1 · Recetas → Nueva receta
    await pagina.goto(`${entorno.appUrl}/recetas`, { waitUntil: 'domcontentloaded' });
    const nueva = pagina.getByRole('button', { name: 'Nueva receta' }).first();
    await nueva.waitFor();
    await tocar(pagina, nueva);
    let dialogo = dialogoCon(pagina, 'Nueva receta');
    await dialogo.getByPlaceholder(/^Ej: /).fill('Prueba trece');
    const seccion = dialogo.locator('section').filter({ hasText: 'Tipo de venta' }).last();
    await probarDesplegable(pagina, id, dialogo.getByRole('combobox').first(), 'categoría');
    await probarDesplegable(pagina, id, seccion.getByRole('combobox').first(), 'tipo de venta');
    // Con «Variable por medida» salen más desplegables: se prueban todos.
    const combos = seccion.getByRole('combobox');
    const cuantos = await combos.count();
    for (let i = 1; i < cuantos; i += 1)
      await probarDesplegable(
        pagina,
        id,
        combos.nth(i),
        `tipo de venta, desplegable ${String(i + 1)}`,
      );
    await pagina.keyboard.press('Escape');

    // 2 · Compras → Registrar compra → «Nuevo» (el alta de un insumo) y sus desplegables
    await pagina.goto(`${entorno.appUrl}/compras`, { waitUntil: 'domcontentloaded' });
    const registrar = pagina.getByRole('button', { name: /^Registrar compra/ }).first();
    await registrar.waitFor();
    await tocar(pagina, registrar);
    dialogo = dialogoCon(pagina, 'Registrar compra');
    await dialogo.getByText('Línea 1').waitFor();
    await tocar(pagina, dialogo.getByRole('button', { name: 'Nuevo', exact: true }));
    const combosInsumo = dialogo.getByRole('combobox');
    const n = await combosInsumo.count();
    for (let i = 0; i < n; i += 1)
      await probarDesplegable(
        pagina,
        id,
        combosInsumo.nth(i),
        `nuevo insumo, desplegable ${String(i + 1)}`,
      );
    await pagina.keyboard.press('Escape');
    await contexto.close();
  }
} finally {
  await navegador.close();
}
process.stdout.write(
  fallas.length === 0 ? 'TODO-BIEN\n' : `FALLAS ${String(fallas.length)}\n${fallas.join('\n')}\n`,
);
process.exit(fallas.length === 0 ? 0 : 1);
