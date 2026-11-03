import { expect, type Page, type Response } from '@playwright/test';

/**
 * ENVIAR EL PEDIDO DE LA MESA desde un teléfono (DP-9.5): abre «Pedido de la mesa», toca
 * «Enviar a cocina» y, si la mesa es de dos o más —el aviso «Esperen a que todos…» está a la
 * vista—, confirma «¿Ya pidieron todos?». Devuelve la respuesta del envío.
 *
 * DP-12.2 · Con la mesa cerrada y el negocio dejando que los comensales la abran, el botón es
 * «Abrir la mesa y enviar»: abre su diálogo (para `personas`).
 *
 * DP-13.3 · Y ese diálogo ya no abre la mesa por su lado: confirma las personas y el MISMO envío
 * abre la mesa y manda el pedido, en un solo comando. Con dos o más teléfonos, antes del diálogo
 * sale «¿Ya pidieron todos?».
 */
export async function enviarElPedidoDeLaMesa(
  telefono: Page,
  token: string,
  personas = 2,
): Promise<Response> {
  await telefono.getByRole('button', { name: /^Pedido de la mesa/ }).click();
  const hoja = telefono.getByRole('dialog', { name: 'El pedido de la mesa' });
  await expect(hoja).toBeVisible();
  const respuestaDelEnvio = () =>
    telefono.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === `/api/publico/qr/${token}/carrito/enviar` &&
        r.request().method() === 'POST',
    );
  const abrir = hoja.getByRole('button', { name: 'Abrir la mesa y enviar' });
  if (await abrir.isVisible()) {
    await abrir.click();
    // La hoja de abrir la mesa es propia del portal (no `role=dialog`): se reconoce por su título.
    const titulo = telefono.getByText(/^Abrir Mesa \d+/);
    const confirmar = telefono.getByRole('alertdialog', { name: '¿Ya pidieron todos?' });
    await expect(confirmar.or(titulo)).toBeVisible();
    if (await confirmar.isVisible()) {
      await confirmar.getByRole('button', { name: 'Abrir la mesa' }).click();
    }
    await expect(titulo).toBeVisible();
    await telefono.getByRole('spinbutton').first().fill(String(personas));
    const enviado = respuestaDelEnvio();
    await telefono.getByRole('button', { name: 'Abrir mesa', exact: true }).click();
    const respuesta = await enviado;
    await expect(titulo).toBeHidden();
    return respuesta;
  }
  const hayQueConfirmar = await hoja.getByText('Esperen a que todos agreguen').isVisible();
  const enviado = respuestaDelEnvio();
  await hoja.getByRole('button', { name: 'Enviar a cocina' }).click();
  if (hayQueConfirmar) {
    const confirmar = telefono.getByRole('alertdialog', { name: '¿Ya pidieron todos?' });
    await confirmar.getByRole('button', { name: 'Enviar', exact: true }).click();
  }
  return enviado;
}
