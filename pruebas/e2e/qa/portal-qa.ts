import { expect, type Page } from '@playwright/test';

import { configuracionDelNegocio } from '../ayudantes/mesas-heredadas.ts';

import { PRECIO, type Platillo } from './carta-qa.ts';

/**
 * QA-1 · EL PORTAL DEL COMENSAL en la copia de Don Poncho: el menú es una lista con «Agregar <platillo>»
 * (aria-label), una hoja con la cantidad, las notas y, si el platillo lo pide, su opción obligatoria.
 */

/** El comensal agrega un platillo (una vez por unidad) desde su teléfono. */
export async function agregarAlPortal(
  telefono: Page,
  platillo: Platillo,
  veces = 1,
  opcion?: string,
): Promise<void> {
  const { nombre } = PRECIO[platillo];
  for (let i = 0; i < veces; i += 1) {
    await telefono.getByRole('button', { name: `Agregar ${nombre}`, exact: true }).click();
    if (opcion !== undefined) await telefono.getByText(opcion, { exact: true }).click();
    await telefono.getByRole('button', { name: /^Agregar\s*·/ }).click();
    await expect(
      telefono.getByText(`${nombre} agregado al pedido de la mesa`).first(),
    ).toBeVisible();
  }
}

/** «Escanear QR» del mesero, sin cámara: se elige la mesa de la lista. */
export async function escanearConLista(mesero: Page, mesa: number): Promise<void> {
  await mesero.getByRole('button', { name: 'Escanear QR' }).click();
  const deLaLista = mesero.getByRole('button', { name: `Mesa ${String(mesa)}`, exact: true });
  const elegir = mesero.getByRole('button', { name: 'Elegir la mesa' });
  await expect(deLaLista.or(elegir)).toBeVisible();
  if (await elegir.isVisible()) await elegir.click();
  await deLaLista.click();
}

/** Portal QR → Configuración: quién manda a cocina y si los comensales abren su mesa. */
export async function quienEnviaDesdeElPortal(
  duena: Page,
  envian: 'mesero' | 'comensales',
  abrenMesa: boolean,
): Promise<void> {
  await duena.goto('/portal-qr');
  await duena.getByRole('tab', { name: 'Configuración' }).click();
  const fila = (rotulo: string) =>
    duena
      .getByText(rotulo, { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"justify-between")][1]');
  await fila('Quién manda a cocina').getByRole('combobox').click();
  await duena
    .getByRole('option', {
      name: envian === 'mesero' ? 'Sólo el mesero confirma y envía' : 'También los comensales',
    })
    .click();
  if (envian === 'comensales') {
    const abren = fila('Los comensales pueden abrir su mesa').getByRole('switch');
    if ((await abren.getAttribute('aria-checked')) !== String(abrenMesa)) await abren.click();
  }
  await duena.getByRole('button', { name: 'Guardar configuración' }).click();
  await expect
    .poll(
      async () => {
        const c = await configuracionDelNegocio(duena);
        // «Abren mesa» sólo cuenta si envían los comensales: con el mesero el valor guardado no importa.
        return [
          c['portal_qr_envia_a_cocina'],
          envian === 'comensales' ? c['portal_qr_comensales_abren_mesa'] === true : abrenMesa,
        ];
      },
      { message: 'El portal no quedó guardado como se pidió.' },
    )
    .toEqual([envian, abrenMesa]);
}

/** El comensal pide ayuda desde «Atención». */
export async function pedirAyuda(telefono: Page): Promise<void> {
  await telefono.getByRole('button', { name: 'Atención' }).click();
  await telefono.getByRole('button', { name: 'Necesito ayuda' }).click();
  await expect(telefono.getByText('Solicitud enviada')).toBeVisible();
}
