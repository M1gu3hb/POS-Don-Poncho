/**
 * LOS GESTOS QUE REPITEN TODAS LAS PANTALLAS de B: dinero como se teclea, el campo de una etiqueta,
 * elegir en un selector y esperar la respuesta de una escritura. Selectores por rol y texto.
 */
import { expect, type Locator, type Page } from '@playwright/test';

/** Pesos como se teclean en un campo (`12.50`). */
export const pesos = (centavos: number): string => (centavos / 100).toFixed(2);

/** Pesos como los pinta la app (`$1,234.50`). */
export const dinero = (centavos: number): string =>
  `$${(centavos / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** El diálogo abierto que lleva ese texto (título o contenido). */
export function dialogoCon(pagina: Page, texto: string | RegExp): Locator {
  return pagina.getByRole('dialog').filter({ hasText: texto });
}

/**
 * El bloque MÁS CHICO que contiene una etiqueta (el `div` de su campo). Las etiquetas de la app no
 * están asociadas a sus controles (`<Label>` sin `htmlFor`), así que el campo es el contenedor.
 */
export function campoDe(zona: Locator, etiqueta: string | RegExp): Locator {
  return zona
    .locator('div')
    .filter({ has: zona.page().getByText(etiqueta, { exact: typeof etiqueta === 'string' }) })
    .last();
}

/** Abre el selector del campo y elige la opción por su nombre. */
export async function elegir(
  pagina: Page,
  zona: Locator,
  etiqueta: string | RegExp,
  opcion: string | RegExp,
): Promise<void> {
  await campoDe(zona, etiqueta).getByRole('combobox').click();
  await pagina.getByRole('option', { name: opcion, exact: typeof opcion === 'string' }).click();
}

/** Espera la respuesta de un POST a `ruta` (se arma ANTES del clic que la provoca). */
export function esperarPost(pagina: Page, ruta: string | RegExp, timeout = 30_000) {
  const respuesta = pagina
    .waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        (typeof ruta === 'string'
          ? new URL(r.url()).pathname === ruta
          : ruta.test(new URL(r.url()).pathname)),
      { timeout },
    )
    // El rechazo dice QUÉ ruta se esperaba (el incidente la nombra).
    .catch((error: unknown) => {
      throw new Error(
        `No llegó la respuesta del POST a ${String(ruta)} en ${String(timeout / 1000)} s: ${String(error).split('\n')[0] ?? ''}`,
      );
    });
  // Si el clic que la provoca falla antes de que alguien la espere, su tiempo vencido no tumba el proceso:
  // quien la espera (`await`) sigue viendo el rechazo. Aquí sólo se deja constancia (no se traga).
  respuesta.catch((error: unknown) => {
    process.stderr.write(`(espera de ${String(ruta)} vencida: ${String(error).slice(0, 120)})
`);
  });
  return respuesta;
}

/** Un toque que provoca una escritura: devuelve su respuesta y exige que no sea un error del servidor. */
export async function tocarYEsperar(
  pagina: Page,
  boton: Locator,
  ruta: string | RegExp,
): Promise<{ estado: number; cuerpo: string }> {
  const respuesta = esperarPost(pagina, ruta);
  await boton.click();
  const r = await respuesta;
  const cuerpo = await r.text();
  expect(
    r.status(),
    `${String(ruta)} → ${String(r.status())}: ${cuerpo.slice(0, 300)}`,
  ).toBeLessThan(500);
  return { estado: r.status(), cuerpo };
}

/**
 * Espera a que se vea ALGUNO de los controles, despertando el modo espera si se interpone. Los
 * manejadores de Playwright sólo corren ante una ACCIÓN (clic, escribir); una espera pura no los
 * dispara, y con el reloj ×6 la capa del modo espera tapa la pantalla mientras se espera.
 */
export async function esperarAlguno(
  pagina: Page,
  controles: readonly Locator[],
  ms = 30_000,
): Promise<number> {
  const capa = pagina.getByRole('dialog', { name: /Modo espera/ });
  const limite = Date.now() + ms;
  while (Date.now() < limite) {
    for (const [i, c] of controles.entries()) if (await c.first().isVisible()) return i;
    if (await capa.isVisible()) {
      // Dos toques: el primero arranca el clip de despertar y el segundo lo salta.
      await tocarSiSigue(capa);
      await tocarSiSigue(capa);
    }
    await pagina.waitForTimeout(500);
  }
  throw new Error(
    `Ninguno de los ${String(controles.length)} controles esperados apareció en ${String(ms / 1000)} s.`,
  );
}

/** Toca el control si sigue a la vista; si se fue entre mirarlo y tocarlo lo dice en la salida de error. */
async function tocarSiSigue(control: Locator): Promise<void> {
  if (!(await control.isVisible())) return;
  try {
    await control.click({ timeout: 3_000 });
  } catch (error: unknown) {
    process.stderr.write(`(toque que no llegó: ${String(error).slice(0, 100)})
`);
  }
}

/** Espera hasta `ms` a que el control se vea; dice si apareció. Sólo mira: no actúa ni se traga errores. */
export async function apareceEn(control: Locator, ms: number): Promise<boolean> {
  const limite = Date.now() + ms;
  for (;;) {
    if (await control.first().isVisible()) return true;
    if (Date.now() >= limite) return false;
    await control.page().waitForTimeout(250);
  }
}

/** Espera a que desaparezca el diálogo (con margen: la copia a veces va lenta). */
export async function cerrado(dialogo: Locator, ms = 30_000): Promise<void> {
  await expect(dialogo).toBeHidden({ timeout: ms });
}
