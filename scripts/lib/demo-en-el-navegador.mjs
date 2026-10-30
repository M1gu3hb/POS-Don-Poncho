/**
 * LA DEMO LOCAL EN EL NAVEGADOR: entrar con el PIN de demo y dejar una mesa ocupada. Lo comparten
 * `medir-fluidez.mjs` (DP-11.0) y `capturar-pilotos.mjs` (DP-11.4), que corren contra la demo de
 * `scripts/demo-local.mjs` con sus PIN de DEMO (`demo.json`), nunca los de producción.
 */

/** La entrada de cada persona de la demo, con su PIN del `demo.json`. */
export function crearEntrada(urlBase, pinesPorNombre) {
  return async function entrar(page, nombre) {
    // Con una sesión abierta, la pantalla de acceso salta al inicio del rol: se sale antes.
    await page.context().clearCookies();
    await page.goto(`${urlBase}/n/don-poncho/login-pos`);
    await page
      .getByRole('button')
      .filter({ has: page.getByText(nombre, { exact: true }) })
      .click();
    for (const digito of pinesPorNombre[nombre]) {
      await page.getByRole('button', { name: digito, exact: true }).click();
    }
    await page.waitForURL((url) => !url.pathname.endsWith('/login-pos'));
  };
}

export const laMesa = (page, n) =>
  page
    .locator('span.font-heading')
    .filter({ hasText: new RegExp(`^${String(n)}$`) })
    .first();

export const dialogoDeLaMesa = (page, n) =>
  page.getByRole('dialog', { name: new RegExp(`^Mesa ${String(n)} `) });

/** La mesa 1 ocupada con tres platillos en cocina, si aún no lo está. */
export async function prepararLaMesa(page, urlBase) {
  await page.goto(`${urlBase}/mesero`);
  await laMesa(page, 1).waitFor();
  await laMesa(page, 1).click();
  const apertura = page.getByRole('dialog', { name: 'Abrir mesa 1' });
  const yaOcupada = dialogoDeLaMesa(page, 1);
  await apertura.or(yaOcupada).first().waitFor();
  if (!(await apertura.isVisible())) {
    await page.keyboard.press('Escape');
    return 'la mesa 1 ya estaba ocupada';
  }
  await apertura.getByRole('spinbutton').first().fill('4');
  await apertura.getByRole('button', { name: 'Abrir mesa' }).click();
  await yaOcupada.waitFor();
  const teselas = yaOcupada.getByRole('button', { name: / \$\d/ });
  for (let i = 0; i < 3; i += 1) await teselas.nth(i).click();
  const enviar = yaOcupada.getByRole('button', { name: 'Enviar a Cocina', exact: true });
  await enviar.click();
  await page.getByText('¡Pedido enviado a cocina!').first().waitFor({ timeout: 30_000 });
  await page.keyboard.press('Escape');
  return 'mesa 1 abierta con 3 platillos en cocina';
}
