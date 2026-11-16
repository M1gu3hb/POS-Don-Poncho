import { expect, type Locator, type Page } from '@playwright/test';

import {
  abrirElCobro,
  abrirLaMesa,
  alMapa,
  armarElPedido,
  botonDeLaMesa,
  CARTA,
  cerrarElTicket,
  cocinaDejaLista,
  entregar,
  importeDe,
  leerElCobro,
  mesaEnElServidor,
  mesaLimpia,
  pedirLaCuenta,
  pesos,
  yaAbierto,
  type PlatilloPedido,
} from './mesas-heredadas.ts';
import { cancelarLaCuentaDeLaMesa } from './modo-espera.ts';
import type { EnLaParada } from './recorrido-tipos.ts';
import { abrirCajaPorLaRuta, soltarLaCaja } from './sesion.ts';

/**
 * EL TRAMO DE LA SALA del recorrido compatible (DP-20): una mesa de punta a punta, de abrirla a
 * cobrarla, más el pedido para llevar. Lo que ya hacen `dividir-en-la-caja` y
 * `ticket-con-descuento` —con tres personas en tres navegadores— lo hace aquí la dueña, sola,
 * en una sola pestaña: el motor que se compara es el de la pestaña, no el de la persona.
 *
 * Deja el negocio como lo encontró: la cuenta cobrada, la mesa libre, la caja cerrada.
 */

const MESA = 4;
const PERSONAS = 2;
const FONDO_DE_LA_CAJA_CENTAVOS = 150_000;
const PEDIDO: readonly PlatilloPedido[] = [
  { nombre: CARTA.arrachera.nombre, veces: 1 },
  { nombre: CARTA.cerveza.nombre, veces: 1 },
];

/** Una cuenta que otra corrida dejó viva en la mesa se cancela: la mesa tiene que estar libre. */
export async function limpiarLaMesa(page: Page): Promise<void> {
  const mesa = await mesaEnElServidor(page, MESA);
  if (mesa.estado === 'libre' || mesa.ordenId === null) return;
  await cancelarLaCuentaDeLaMesa(page, MESA);
}

/** Cierra la caja de esta terminal, cuadrada, y cancela lo que haya quedado en la mesa. */
export async function dejarLaSalaComoEstaba(page: Page): Promise<void> {
  await limpiarLaMesa(page);
  await soltarLaCaja(page);
}

/** Abre la caja de esta terminal (por la ruta del botón) y entra a su pantalla. */
export async function entrarALaCaja(page: Page): Promise<void> {
  await abrirCajaPorLaRuta(page, FONDO_DE_LA_CAJA_CENTAVOS);
  await page.goto('/caja');
  await expect(page.getByRole('heading', { name: 'Caja', level: 1 })).toBeVisible();
  await expect(page.getByRole('tab', { name: /^Pendientes/ })).toBeVisible();
  await page.waitForLoadState('networkidle');
}

/** La mesera abre la mesa, arma el pedido y lo manda a cocina; la cocina lo ve. */
export async function tomarLaOrden(page: Page, alLlegar: EnLaParada): Promise<string> {
  await limpiarLaMesa(page);
  await page.goto('/mesero');
  await expect(
    page.getByRole('button', { name: new RegExp(`^${String(MESA)} Libre`) }),
  ).toBeVisible();
  await page.waitForLoadState('networkidle');
  await alLlegar({ nombre: 'mesero', tapar: [] });

  const { ordenId } = await abrirLaMesa(page, page, MESA, PERSONAS);
  await armarElPedido(page, MESA, PEDIDO);
  const dialogo = page.getByRole('dialog', { name: new RegExp(`^Mesa ${String(MESA)} `) });
  await expect(dialogo.getByText('NUEVO PEDIDO')).toBeVisible();
  await alLlegar({ nombre: 'mesero-orden', tapar: [] });

  const boton = await botonDeLaMesa(page, MESA, 'Enviar a Cocina');
  const enviada = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/restaurante/enviar-pedido' &&
      r.request().method() === 'POST',
  );
  await boton.click();
  const respuesta = await enviada;
  expect(respuesta.status(), 'El servidor rechazó el envío a cocina.').toBe(200);
  await expect(page.getByText('¡Pedido enviado a cocina!').first()).toBeVisible();
  await alMapa(page);

  await page.goto('/restaurante/cocina');
  await expect(page.getByRole('button', { name: /^Iniciar/ }).first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  await alLlegar({ nombre: 'cocina', tapar: [page.getByText(/^hace /)] });
  return ordenId;
}

/** La cocina deja lista la comanda, la mesera entrega y pide la cuenta sin propina. */
export async function pedirLaCuentaDeLaMesa(page: Page, ordenId: string): Promise<void> {
  await page.goto('/cocina');
  await cocinaDejaLista(page, page, ordenId, 2);
  await page.goto('/mesero');
  await expect(page.getByRole('button', { name: new RegExp(`^${String(MESA)} `) })).toBeVisible();
  await entregar(page, MESA);
  await pedirLaCuenta(page, MESA, 'Sin propina', importeDe(PEDIDO));
  await alMapa(page);
}

/** La cajera ve la cuenta, la divide (sin confirmar), la cobra en efectivo y mira el ticket. */
/**
 * «Caja abierta desde 15 nov, 18:19 · por …»: lleva la hora de apertura, que cambia de corrida a
 * corrida, y sigue a la vista detrás de los diálogos de la caja. Se tapa en todas sus paradas.
 */
const franjaDeLaCaja = (page: Page): Locator => page.getByText(/^Caja abierta desde/);

export async function cobrarLaCuenta(page: Page, alLlegar: EnLaParada): Promise<void> {
  await entrarALaCaja(page);
  const pendiente = page.getByRole('button', { name: new RegExp(`^Mesa ${String(MESA)} Cuenta`) });
  await page.getByRole('tab', { name: /^Pendientes/ }).click();
  await expect(pendiente).toBeVisible();
  await alLlegar({
    nombre: 'caja-cuenta',
    tapar: [franjaDeLaCaja(page), page.getByText(/^Código:/)],
  });

  const cobro = await abrirElCobro(page, MESA);
  await cobro.getByRole('button', { name: /^Dividir\b/ }).click();
  const division = page.getByRole('dialog', { name: 'Dividir la cuenta' });
  await yaAbierto(division);
  await expect(
    division.getByRole('button', { name: `Añadir ${CARTA.arrachera.nombre} a la cuenta 1` }),
  ).toBeVisible();
  await alLlegar({ nombre: 'caja-dividir', tapar: [franjaDeLaCaja(page)] });
  await division.getByRole('button', { name: 'Cancelar' }).click();
  await expect(division).toHaveCount(0);

  await cobro.getByRole('button', { name: 'Efectivo', exact: true }).click();
  await cobro.getByPlaceholder('0.00').fill(pesos(importeDe(PEDIDO)));
  await alLlegar({ nombre: 'caja-cobro', tapar: [franjaDeLaCaja(page)] });

  const cobrado = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/venta/cobrar');
  await cobro.getByRole('button', { name: /^Cobrar \$/ }).click();
  const resultado = await leerElCobro(await cobrado);
  expect(resultado.ok, resultado.mensaje ?? 'El cobro no se aceptó.').toBe(true);
  const ticket = page.getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' });
  await yaAbierto(ticket);
  await alLlegar({
    nombre: 'caja-ticket',
    tapar: [
      franjaDeLaCaja(page),
      ticket.getByText('Folio:').locator('..'),
      ticket.getByText('Fecha:').locator('..'),
    ],
  });
  await cerrarElTicket(page);
  // La mesa cobrada se deja limpia desde el mapa: ahí es donde se toca.
  await page.goto('/mesero');
  await expect(page.getByRole('button', { name: new RegExp(`^${String(MESA)} `) })).toBeVisible();
  await mesaLimpia(page, page, MESA);
}

/** El pedido para llevar, a media toma: el diálogo con un platillo en el pedido. */
export async function tomarUnPedidoParaLlevar(page: Page, alLlegar: EnLaParada): Promise<void> {
  await page.goto('/caja');
  await page.getByRole('button', { name: /^Para llevar/ }).click();
  const dialogo = page.getByRole('dialog', { name: 'Pedido para llevar' });
  await yaAbierto(dialogo);
  await dialogo.getByRole('button', { name: new RegExp(`^${CARTA.guacamole.nombre} \\$`) }).click();
  await expect(dialogo.getByRole('button', { name: /^Cobrar \$/ })).toBeVisible();
  await alLlegar({ nombre: 'para-llevar', tapar: [franjaDeLaCaja(page)] });
  await dialogo.getByRole('button', { name: 'Cerrar sin cobrar (el pedido se guarda)' }).click();
  await expect(dialogo).toHaveCount(0);
}
