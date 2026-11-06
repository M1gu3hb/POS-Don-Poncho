import { expect, type Locator, type Page, type Response } from '@playwright/test';

import { botonDeLaMesa, dialogoDeLaMesa, laMesa, yaAbierto } from '../ayudantes/mesas-heredadas.ts';

import { anotar, dinero, leerEstado, pesos, type Jornada } from './ayudantes-qa.ts';
import { PRECIO, type Renglon } from './carta-qa.ts';

/**
 * QA-1 · LOS GESTOS DE LA JORNADA que repiten todas las escenas: la cocina de cada estación, el
 * cobro en la caja y la hoja de la mesa. Los selectores son los de las pantallas heredadas de
 * Don Poncho (los que ya usan `dia-completo-restaurante` y `cancelacion-del-mesero`).
 */

export interface Cobrado {
  readonly ventaId: string;
  readonly folio: string;
  readonly ventaCentavos: number;
  readonly propinaCentavos: number;
  readonly cambioCentavos: number;
}

export type Pago =
  | { readonly metodo: 'Efectivo'; readonly recibidoCentavos: number }
  | { readonly metodo: 'Tarjeta' }
  | { readonly metodo: 'Transferencia' }
  | {
      readonly metodo: 'Mixto';
      /** La VENTA por método, sin la propina; cero deja el campo vacío. */
      readonly efectivoCentavos: number;
      readonly tarjetaCentavos: number;
      readonly propinaEfectivoCentavos?: number;
      readonly propinaTarjetaCentavos?: number;
    };

/** La propina que la mesa acordó, decidida en la caja: un porcentaje rápido, «Sin propina» o un monto. */
export type Propina = 5 | 10 | 15 | 20 | 'Sin propina' | { readonly montoCentavos: number } | null;

/**
 * En la caja de Don Poncho la propina se pregunta AL COBRAR («¿Desean agregar propina?», con 5, 10, 15
 * y 20 %), no cuando la mesera pide la cuenta. Si la cuenta ya trae propina no pregunta.
 */
async function decidirLaPropina(page: Page, cobro: Locator, propina: Propina): Promise<void> {
  const pregunta = page.getByText('¿Desean agregar propina?');
  await expect(pregunta.or(cobro)).toBeVisible({ timeout: 30_000 });
  if (!(await pregunta.isVisible())) return;
  expect(propina, 'La caja preguntó por la propina y el guion no dijo cuál.').not.toBeNull();
  if (propina === 'Sin propina') {
    await page.locator('button', { hasText: 'Sin propina' }).click();
  } else {
    if (typeof propina === 'number') {
      await page.getByText(`${String(propina)}%`, { exact: true }).click();
    } else if (propina !== null) {
      await page.getByPlaceholder('0.00').last().fill(pesos(propina.montoCentavos));
    }
    await page.locator('button', { hasText: 'Aplicar' }).click();
  }
  await expect(pregunta).toBeHidden();
}

/** Abre la cuenta de la mesa en «Pendientes», paga con ese método y devuelve lo que contestó el servidor. */
export async function cobrarEnCaja(
  page: Page,
  rotuloDeLaCuenta: RegExp,
  titulo: string,
  pago: Pago,
  propina: Propina = null,
): Promise<Cobrado> {
  await page.getByRole('tab', { name: /^Pendientes/ }).click();
  await page.getByRole('button', { name: rotuloDeLaCuenta }).first().click();
  const dialogo = page.getByRole('dialog').filter({ hasText: `Cobrar — ${titulo}` });
  await decidirLaPropina(page, dialogo, propina);
  await yaAbierto(dialogo);
  await dialogo.getByRole('button', { name: pago.metodo, exact: true }).click();
  if (pago.metodo === 'Efectivo') {
    await dialogo.getByPlaceholder('0.00').fill(pesos(pago.recibidoCentavos));
  }
  if (pago.metodo === 'Mixto') {
    const partes = dialogo.getByPlaceholder('0', { exact: true });
    if (pago.efectivoCentavos > 0) await partes.nth(0).fill(pesos(pago.efectivoCentavos));
    if (pago.tarjetaCentavos > 0) await partes.nth(1).fill(pesos(pago.tarjetaCentavos));
    if (pago.propinaEfectivoCentavos !== undefined) {
      await partes.nth(3).fill(pesos(pago.propinaEfectivoCentavos));
    }
    if (pago.propinaTarjetaCentavos !== undefined) {
      await partes.nth(4).fill(pesos(pago.propinaTarjetaCentavos));
    }
    await expect(dialogo.getByText(/^✓ La venta \(\$[\d,.]+\) queda cubierta\.$/)).toBeVisible();
  }
  const respuesta = page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/venta/cobrar' && r.request().method() === 'POST',
  );
  // La caja libera la mesa al cobrar; si el servidor lo rechaza se anota con su motivo (QA1-7).
  const alLiberar = (r: Response): void => {
    if (new URL(r.url()).pathname !== '/api/restaurante/liberar-mesa' || r.status() === 200) return;
    void r.text().then((texto) => {
      anotar({
        aparato: 'pc',
        quien: 'Caja',
        accion: `liberar-mesa devolvió ${String(r.status())} al cobrar ${titulo}`,
        detalle: texto.slice(0, 300),
      });
    });
  };
  page.on('response', alLiberar);
  await dialogo.getByRole('button', { name: /^Cobrar \$/ }).click();
  const cuerpo = (await (await respuesta).json()) as {
    readonly ok: boolean;
    readonly error?: { readonly mensaje?: string };
    readonly datos?: {
      readonly ordenId: string;
      readonly folio: string;
      readonly totalCentavos: string;
      readonly propinaCentavos: string;
      readonly cambioCentavos: string;
    };
  };
  expect(cuerpo.ok, `Cobro de ${titulo}: ${cuerpo.error?.mensaje ?? ''}`).toBe(true);
  const datos = cuerpo.datos;
  if (datos === undefined) throw new Error('El cobro no devolvió datos.');
  const ticket = page.getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' });
  // Si la cuenta era de mesas unidas, la caja pregunta si se separan (DP-9.6) antes del ticket.
  const separar = page.getByText('¿Separar mesas o dejarlas unidas?');
  await expect(separar.or(ticket)).toBeVisible({ timeout: 30_000 });
  if (await separar.isVisible()) {
    await page.locator('button', { hasText: 'Separar mesas' }).click();
  }
  const visible = await ticket
    .waitFor({ state: 'visible', timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  if (!visible) {
    await page.screenshot({ path: `docs/qa/evidencia/cobro-sin-ticket-${titulo}.png` });
    throw new Error(
      `El cobro de ${titulo} salió bien y no apareció «TICKET DE PAGO». En pantalla: ` +
        (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400),
    );
  }
  await yaAbierto(ticket);
  // El ticket tiene que decir lo cobrado: folio, venta y, si la hubo, propina. Lo que no diga se anota.
  const textoDelTicket = (await ticket.innerText()).replace(/\s+/g, ' ');
  const faltan = [
    datos.folio,
    dinero(Number(datos.totalCentavos)),
    ...(Number(datos.propinaCentavos) > 0 ? [dinero(Number(datos.propinaCentavos))] : []),
  ].filter((x) => !textoDelTicket.includes(x));
  if (faltan.length > 0) {
    anotar({
      aparato: 'pc',
      quien: 'Caja',
      accion: `El ticket de ${titulo} no dice lo cobrado`,
      detalle: `falta: ${faltan.join(', ')} · ticket: ${textoDelTicket.slice(0, 500)}`,
      datos: { tipo: 'ticket_dudoso' },
    });
  }
  await ticket.getByRole('button', { name: 'Cerrar' }).click();
  await expect(ticket).toBeHidden();
  page.off('response', alLiberar);
  return {
    ventaId: datos.ordenId,
    folio: datos.folio,
    ventaCentavos: Number(datos.totalCentavos),
    propinaCentavos: Number(datos.propinaCentavos),
    cambioCentavos: Number(datos.cambioCentavos),
  };
}

/**
 * La pantalla de UNA estación saca todo lo suyo: «Preparar» a cada comanda nueva y «Listo» a cada
 * una en preparación, hasta que no quede botón. Devuelve cuántas comandas pasó a «listo».
 */
export async function sacarLoDeLaEstacion(pantalla: Page): Promise<number> {
  let listas = 0;
  const preparar = pantalla.getByRole('button', { name: 'Preparar', exact: true });
  const listo = pantalla.getByRole('button', { name: 'Listo', exact: true });
  await expect(preparar.or(listo).first()).toBeVisible({ timeout: 30_000 });
  const transicion = () =>
    pantalla.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === '/api/restaurante/transicionar-pedido' &&
        r.request().method() === 'POST',
      { timeout: 15_000 },
    );
  for (let vuelta = 0; vuelta < 40; vuelta += 1) {
    const hayPreparar = (await preparar.count()) > 0;
    const hayListo = (await listo.count()) > 0;
    if (!hayPreparar && !hayListo) break;
    // El toque y su respuesta: la espera se arma ANTES del clic (si no, llega primero y se pierde).
    const respuesta = transicion();
    await (hayPreparar ? preparar : listo).first().click();
    const dicha = await respuesta;
    expect(dicha.status(), `La cocina no pudo mover la comanda: ${await dicha.text()}`).toBe(200);
    if (!hayPreparar) listas += 1;
  }
  return listas;
}

/** El número de comandas por estación que dice el encabezado «N pedido(s) activos». */
export async function pedidosActivos(pantalla: Page): Promise<number> {
  const texto = await pantalla
    .getByText(/pedido\(s\) activos/)
    .first()
    .innerText();
  return Number(/(\d+)/.exec(texto)?.[1] ?? Number.NaN);
}

/** El mesero recoge lo listo de las estaciones («Entregar listos» o «Marcar entregado»); la mesa queda «Ocupada». */
export async function entregarListos(page: Page, numero: number): Promise<void> {
  const mesa = dialogoDeLaMesa(page, numero);
  if (!(await mesa.isVisible())) await laMesa(page, numero).click();
  await yaAbierto(mesa);
  // Con varias estaciones listas el botón es «Entregar listos»; con una sola, «Marcar entregado».
  const todos = mesa.getByRole('button', { name: /^(Entregar listos|Marcar entregado)$/ });
  await expect(todos.first()).toBeVisible({ timeout: 30_000 });
  while ((await todos.count()) > 0) {
    const entregada = page.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/restaurante/entregar-pedidos' && r.ok(),
    );
    await todos.first().click();
    await entregada;
  }
  await expect(mesa.getByText('Ocupada', { exact: true })).toBeVisible({ timeout: 30_000 });
}

/**
 * El mesero pide la cuenta. Con esquema de propina la mesa responde «¿Desean agregar propina?»; sin él
 * (la copia de Don Poncho no trae esquema) pasa directo a la pre-cuenta y la propina la decide la
 * caja. Devuelve el código para caja y si preguntó por la propina.
 */
export async function pedirLaCuentaQa(
  page: Page,
  numero: number,
  propina: '10%' | '15%' | 'Sin propina' | null,
): Promise<{ readonly codigo: string; readonly preguntoPropina: boolean }> {
  await (await botonDeLaMesa(page, numero, 'Solicitar cuenta')).click();
  const pregunta = page.getByRole('dialog').filter({ hasText: '¿Desean agregar propina?' });
  const precuenta = page.getByRole('dialog').filter({ hasText: 'PRE-CUENTA' });
  await expect(pregunta.or(precuenta)).toBeVisible({ timeout: 30_000 });
  const preguntoPropina = await pregunta.isVisible();
  if (preguntoPropina && propina !== null) {
    if (propina === 'Sin propina') {
      await pregunta.getByRole('button', { name: 'Sin propina' }).click();
    } else {
      await pregunta.getByText(propina, { exact: true }).click();
      await pregunta.getByRole('button', { name: 'Aplicar' }).click();
    }
  }
  await yaAbierto(precuenta);
  const codigo = /M\d{2}-\d{4}/.exec(await precuenta.innerText())?.[0] ?? '';
  expect(codigo, 'La precuenta no trae el código para caja.').not.toBe('');
  await precuenta.getByRole('button', { name: 'Cerrar' }).click();
  await expect(precuenta).toBeHidden();
  return { codigo, preguntoPropina };
}

export async function estacionDe(
  j: Jornada,
  persona: string,
  aparato: 'pc' | 'tableta' | 'telefono',
) {
  const pantalla = await j.pagina(persona, aparato);
  await pantalla.goto('/cocina');
  await expect(pantalla.getByText(/pedido\(s\) activos/).first()).toBeVisible();
  return pantalla;
}

/** Las estaciones que le tocan a un pedido (una comanda por estación). */
export const estacionesDe = (pedido: readonly Renglon[]): readonly string[] => [
  ...new Set(pedido.map((r) => PRECIO[r.platillo].estacion)),
];

/** Cada estación del pedido saca lo suyo; devuelve cuántas comandas pasaron a «listo». */
export async function sacarTodo(
  estaciones: Readonly<Record<string, Page>>,
  pedido: readonly Renglon[],
): Promise<number> {
  let total = 0;
  for (const nombre of estacionesDe(pedido)) {
    const pantalla = estaciones[nombre];
    if (pantalla === undefined) throw new Error(`No hay pantalla de la estación ${nombre}.`);
    total += await sacarLoDeLaEstacion(pantalla);
  }
  return total;
}

/** Las cuatro pantallas de estación: Cocina (PC), Bebidas (tableta), Postres y Barbacoa (teléfonos). */
export async function abrirEstaciones(j: Jornada): Promise<Record<string, Page>> {
  const cocineros = leerEstado()['cocineros'] as Record<string, { nombre: string }>;
  return {
    Cocina: await estacionDe(j, 'Cocina', 'pc'),
    Bebidas: await estacionDe(j, 'Bebidas', 'tableta'),
    Postres: await estacionDe(j, cocineros['Postres']?.nombre ?? '', 'telefono'),
    Barbacoa: await estacionDe(j, cocineros['Barbacoa']?.nombre ?? '', 'telefono'),
  };
}
