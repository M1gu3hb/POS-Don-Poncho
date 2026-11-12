/**
 * EL PORTAL DEL COMENSAL (teléfono, sin sesión): escanear el QR de la mesa, agregar platillos al
 * pedido compartido, llamar al mesero para confirmar, pedir ayuda y pedir la cuenta con propina.
 */
import type { Page } from '@playwright/test';

import { ESPERA_MS, escapar, kilosDichos } from './ayudas.ts';
import { esPorPeso, type LineaPlaneada } from '../pedido.ts';

/** Abre `/qr/<token>` (lo que hace el teléfono al escanear) y espera a que el menú esté en pantalla. */
export async function abrirElQr(pagina: Page, appUrl: string, token: string): Promise<void> {
  await pagina.goto(`${appUrl}/qr/${token}`, { waitUntil: 'domcontentloaded', timeout: ESPERA_MS });
  await pagina.getByRole('button', { name: /^Atención$/ }).waitFor({ timeout: ESPERA_MS });
}

/** Agrega un platillo al pedido de la mesa (con sus opciones, su nota, sus piezas o sus kilos). */
export async function agregarAlPortal(pagina: Page, linea: LineaPlaneada): Promise<void> {
  const nombre = linea.producto.nombre;
  await pagina
    .getByRole('button', { name: new RegExp(`^${escapar(nombre)}, \\$.*Ver y agregar`) })
    .first()
    .click({ timeout: ESPERA_MS });
  const dialogo = pagina.getByRole('dialog').last();
  await dialogo.waitFor({ timeout: ESPERA_MS });
  if (esPorPeso(linea.producto)) {
    const atajo = dialogo.getByRole('button', { name: kilosDichos(linea.cantidad), exact: true });
    if (linea.producto.presentaciones.includes(linea.cantidad) && (await atajo.count()) > 0)
      await atajo.click();
    else await dialogo.getByRole('spinbutton').first().fill(String(linea.cantidad));
  } else {
    for (const o of linea.opciones)
      await dialogo
        .getByRole('button', { name: nombreDeOpcion(o.opcion) })
        .first()
        .click();
    for (let i = 1; i < linea.cantidad; i += 1)
      await dialogo.getByRole('button', { name: 'Uno más' }).click();
  }
  if (linea.nota !== '') await dialogo.getByRole('textbox').first().fill(linea.nota);
  await dialogo.getByRole('button', { name: /^Agregar/ }).click();
  await pagina
    .getByText(`${nombre} agregado al pedido de la mesa`)
    .first()
    .waitFor({ timeout: ESPERA_MS });
}

/** «Pedido de la mesa» → «Llamar a mi mesero para confirmar». Devuelve lo que contestó el servidor. */
export async function llamarParaConfirmar(pagina: Page): Promise<number> {
  await pagina.getByRole('button', { name: /^Pedido de la mesa/ }).click({ timeout: ESPERA_MS });
  const llamada = pagina.waitForResponse(
    (r) =>
      /\/api\/publico\/qr\/[^/]+\/carrito\/llamar$/.test(new URL(r.url()).pathname) &&
      r.request().method() === 'POST',
    { timeout: ESPERA_MS },
  );
  await pagina
    .getByRole('button', { name: 'Llamar a mi mesero para confirmar' })
    .click({ timeout: ESPERA_MS });
  const estado = (await llamada).status();
  await cerrarLoAbierto(pagina);
  return estado;
}

/** Cierra la hoja o el panel que haya abierto (botón «Cerrar» o Escape). */
export async function cerrarLoAbierto(pagina: Page): Promise<void> {
  const cerrar = pagina
    .getByRole('button', { name: 'Cerrar', exact: true })
    .filter({ visible: true });
  if ((await cerrar.count()) > 0)
    await cerrar
      .last()
      .click({ timeout: 5_000 })
      .catch(() => undefined);
  else await pagina.keyboard.press('Escape');
  await pagina.waitForTimeout(300);
}

/** «Atención» → «Necesito ayuda» (llama al mesero a la mesa). Devuelve 200 si el portal dijo «Solicitud enviada». */
export async function pedirAyuda(pagina: Page): Promise<number> {
  await pagina.getByRole('button', { name: 'Atención', exact: true }).click({ timeout: ESPERA_MS });
  await pagina.getByRole('button', { name: 'Necesito ayuda' }).click({ timeout: ESPERA_MS });
  await pagina.getByText('Solicitud enviada').first().waitFor({ timeout: ESPERA_MS });
  await cerrarLoAbierto(pagina);
  return 200;
}

/**
 * «Atención» → «Pedir cuenta» (abre «Pedir cuenta — Mesa N»), con la propina que acuerde el grupo si
 * el portal la pregunta, y espera «¡Cuenta solicitada!». Devuelve el porcentaje elegido (0 si no hubo).
 */
export async function pedirCuentaPorElPortal(
  pagina: Page,
  porcentaje: number,
): Promise<{ estado: number; porcentaje: number }> {
  await pagina.getByRole('button', { name: 'Atención', exact: true }).click({ timeout: ESPERA_MS });
  await pagina.getByRole('button', { name: 'Pedir cuenta' }).click({ timeout: ESPERA_MS });
  const listo = pagina.getByText('¡Cuenta solicitada!');
  let elegido = 0;
  const propina = pagina
    .getByRole('button', {
      name: porcentaje === 0 ? /^Sin propina$/ : new RegExp(`^${String(porcentaje)}\\s?%`),
    })
    .first();
  if (
    !(await listo.isVisible()) &&
    (await propina.isVisible({ timeout: 2_500 }).catch(() => false))
  ) {
    await propina.click();
    elegido = porcentaje;
    const aplicar = pagina
      .getByRole('button', { name: /^(Aplicar|Confirmar|Pedir cuenta)$/ })
      .last();
    if (await aplicar.isVisible({ timeout: 1_000 }).catch(() => false)) await aplicar.click();
  }
  await listo.first().waitFor({ timeout: ESPERA_MS });
  await cerrarLoAbierto(pagina);
  return { estado: 200, porcentaje: elegido };
}

/**
 * El botón de una opción se llama como la opción y, si cuesta, también lleva su precio («Tarro
 * helado +$15.00»): se busca por el nombre al principio, no exacto.
 */
function nombreDeOpcion(opcion: string): RegExp {
  const escapada = opcion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escapada}(\\s|$)`);
}
