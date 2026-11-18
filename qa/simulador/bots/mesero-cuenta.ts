/**
 * LO QUE EL MESERO HACE CON LA CUENTA Y CON LAS MESAS: pedir la cuenta (con su propina), quitar un
 * platillo (con el PIN de quien autoriza si la cuenta ya se pidió), cambiar de mesa, unir y
 * separar mesas, atender solicitudes del portal y «Llamar a mi mesero», y dejar limpia una mesa.
 */
import type { Locator, Page } from '@playwright/test';

import { ESPERA_MS, escapar } from './ayudas.ts';
import {
  aLaZonaDe,
  alMapa,
  botonDeMesa,
  dialogoDeMesa,
  entrarALaMesa,
  pestanasDeZona,
} from './mesero-ui.ts';
import { pinDe, type Entorno } from '../entorno.ts';

export type Propina = 'caja' | 'sin' | 10 | 15;

export interface PrecuentaLeida {
  readonly codigo: string;
  readonly totalCentavos: number | null;
  /** ¿El sistema preguntó por la propina? (Sin esquema de propina pasa directo y la decide la caja.) */
  readonly preguntoPropina: boolean;
}

const aCentavos = (texto: string): number => Math.round(Number(texto.replaceAll(',', '')) * 100);

/**
 * El botón que se busca (`Solicitar cuenta`, `Cambiar de mesa`) vive en el panel de la cuenta: a un
 * lado en la tableta y detrás de la barra «Mesa abierta … Abrir» en el teléfono. Se ESPERA a que
 * aparezca uno de los dos caminos (la cuenta tarda en hidratar: preguntar de golpe daba «no hay botón»
 * y esperar sólo la barra costaba 45 s en la tableta, donde no existe) y, si sólo salió la barra, se
 * toca para abrir el panel.
 */
export async function abrirElPanelDeLaCuenta(pagina: Page, boton: string | RegExp): Promise<void> {
  const objetivo = pagina
    .getByRole('button', typeof boton === 'string' ? { name: boton, exact: true } : { name: boton })
    .filter({ visible: true });
  const barra = pagina.getByRole('button', { name: /^Mesa abierta\b/ }).filter({ visible: true });
  await objetivo.or(barra).first().waitFor({ state: 'visible', timeout: ESPERA_MS });
  if ((await objetivo.count()) > 0) return;
  await barra.last().click({ timeout: ESPERA_MS });
  await objetivo.first().waitFor({ state: 'visible', timeout: ESPERA_MS });
}

/** Pide la cuenta con la propina que acordó la mesa y lee la pre-cuenta (código de caja y total). */
export async function pedirLaCuenta(
  pagina: Page,
  numero: number,
  propina: Propina,
): Promise<PrecuentaLeida> {
  await entrarALaMesa(pagina, numero);
  await abrirElPanelDeLaCuenta(pagina, 'Solicitar cuenta');
  await pagina
    .getByRole('button', { name: 'Solicitar cuenta', exact: true })
    .filter({ visible: true })
    .last()
    .click({ timeout: ESPERA_MS });
  const pregunta = pagina.getByRole('dialog').filter({ hasText: /propina/i });
  const precuenta = pagina.getByRole('dialog').filter({ hasText: 'PRE-CUENTA' });
  await pregunta.or(precuenta).first().waitFor({ timeout: ESPERA_MS });
  const preguntoPropina = await pregunta.first().isVisible();
  if (preguntoPropina) {
    const d = pregunta.first();
    const nombre =
      propina === 'caja'
        ? /La decide la caja|Sin propina/
        : propina === 'sin'
          ? /^Sin propina$/
          : new RegExp(`^${String(propina)}\\s?%`);
    await d.getByRole('button', { name: nombre }).first().click();
    const aplicar = d.getByRole('button', { name: 'Aplicar' });
    if (await aplicar.isVisible({ timeout: 1_500 }).catch(() => false)) await aplicar.click();
  }
  await precuenta.first().waitFor({ timeout: ESPERA_MS });
  const texto = await precuenta.first().innerText();
  const codigo = /M\d{2}-\d{4}/.exec(texto)?.[0] ?? '';
  // «SUBTOTAL $…» también contiene «TOTAL»: se pide que no haya letra antes (el guion se equivocó aquí una vez).
  const total = /(?<![A-Za-zÁ-ú])TOTAL\s*\$([\d,]+\.\d\d)/.exec(texto)?.[1];
  await precuenta.first().getByRole('button', { name: 'Cerrar' }).first().click();
  await precuenta.first().waitFor({ state: 'hidden', timeout: ESPERA_MS });
  await alMapa(pagina);
  return { codigo, totalCentavos: total === undefined ? null : aCentavos(total), preguntoPropina };
}

/**
 * Quita un platillo de la cuenta con su motivo. Si el sistema pide el PIN de un gerente (la cuenta ya
 * se pidió) y se le da la persona que autoriza, la autoriza con su PIN de prueba.
 */
export async function quitarPlatillo(
  pagina: Page,
  numero: number,
  producto: string,
  motivo: string,
  autoriza: { entorno: Entorno; persona: string } | null,
): Promise<{ autorizo: boolean }> {
  await entrarALaMesa(pagina, numero);
  const mesa = dialogoDeMesa(pagina, numero);
  await mesa.getByRole('button', { name: 'Quitar un platillo' }).click({ timeout: ESPERA_MS });
  const lista = pagina.getByRole('dialog', { name: 'Quitar un platillo' });
  await lista
    .getByRole('button', { name: new RegExp(String.raw`^Quitar (?:\d+ × )?` + escapar(producto)) })
    .first()
    .click({ timeout: ESPERA_MS });
  const anular = pagina.getByRole('dialog', {
    name: new RegExp(String.raw`^Quitar (?:\d+ × )?` + escapar(producto)),
  });
  await anular.waitFor({ timeout: ESPERA_MS });
  const radio = anular.getByRole('radio', { name: motivo });
  await ((await radio.count()) > 0 ? radio : anular.getByRole('radio')).first().click();
  const quitar = anular.getByRole('button', { name: 'Quitar de la cuenta' });
  const respuesta = (): ReturnType<Page['waitForResponse']> =>
    pagina.waitForResponse((r) => new URL(r.url()).pathname === '/api/restaurante/anular-linea', {
      timeout: ESPERA_MS,
    });
  let intento = respuesta();
  await quitar.click();
  let estado = (await intento).status();
  let autorizo = false;
  if (estado !== 200 && autoriza !== null) {
    await anular
      .getByRole('group', { name: 'Quién autoriza' })
      .getByRole('button', { name: autoriza.persona })
      .click();
    await anular
      .getByLabel('PIN de quien autoriza')
      .fill(pinDe(autoriza.entorno, autoriza.persona));
    await anular.getByRole('button', { name: 'Autorizar' }).click();
    await anular.getByText(`Autorizó ${autoriza.persona}.`).waitFor({ timeout: ESPERA_MS });
    intento = respuesta();
    await quitar.click();
    estado = (await intento).status();
    autorizo = true;
  }
  if (estado !== 200) throw new Error(`anular-linea respondió ${String(estado)}`);
  await pagina.getByText('Platillo quitado de la cuenta').first().waitFor({ timeout: ESPERA_MS });
  await anular.waitFor({ state: 'hidden', timeout: ESPERA_MS });
  return { autorizo };
}

/** Cambia la cuenta de mesa por la pantalla de la mesa («Cambiar de mesa» → la mesa destino). */
export async function cambiarDeMesa(pagina: Page, origen: number, destino: number): Promise<void> {
  await entrarALaMesa(pagina, origen);
  // DP-21 · «Cambiar de mesa» abre un panel ahí mismo (sin salir del mapa): se elige la mesa, se
  // confirma «¿Pasar la cuenta de la mesa N a la mesa M?» con «Pasar» y sale el aviso.
  // El botón sale cuando la cuenta de la mesa ya cargó y la mesa es de quien la mira: se espera, no
  // se pregunta de golpe (D1-004). Si no sale, es lo que vería el mesero: queda como incidente.
  const abrir = pagina
    .getByRole('button', { name: /^Cambiar de mesa/ })
    .filter({ visible: true })
    .first();
  try {
    await abrirElPanelDeLaCuenta(pagina, /^Cambiar de mesa/);
  } catch {
    throw new Error(`La mesa ${String(origen)} no ofrece «Cambiar de mesa» a quien la atiende.`);
  }
  await abrir.click({ timeout: ESPERA_MS });
  const panel = pagina.getByRole('dialog').filter({ hasText: 'Cambiar de mesa' }).last();
  const laMesa = panel.getByRole('button', { name: new RegExp(`^Mesa\\s*${String(destino)}\\b`) });
  // El panel enseña primero las libres de SU zona; las demás están tras «Ver mesas de otras zonas».
  const otrasZonas = panel.getByRole('button', { name: /^Ver mesas de otras zonas/ });
  await laMesa.or(otrasZonas).first().waitFor({ state: 'visible', timeout: ESPERA_MS });
  if ((await laMesa.count()) === 0) await otrasZonas.click({ timeout: ESPERA_MS });
  await laMesa.first().click({ timeout: ESPERA_MS });
  const movida = pagina.waitForResponse(
    (r) =>
      new URL(r.url()).pathname.startsWith('/api/restaurante/') && r.request().method() === 'POST',
    { timeout: ESPERA_MS },
  );
  await panel.getByRole('button', { name: 'Pasar', exact: true }).click({ timeout: ESPERA_MS });
  const respuesta = await movida;
  if (!respuesta.ok()) throw new Error(`cambiar de mesa respondió ${String(respuesta.status())}`);
}

/**
 * En el plano de «Unir mesas» las mesas tiemblan sin parar y Playwright espera a que un elemento se
 * quede quieto para tocarlo: nunca lo hace (D1-016). Como en las e2e del repo, se pide movimiento
 * reducido mientras dura (la app lo respeta: `motion-reduce:animate-none`).
 */
async function sinTemblor(pagina: Page, fn: () => Promise<void>): Promise<void> {
  await pagina.emulateMedia({ reducedMotion: 'reduce' });
  try {
    await fn();
  } finally {
    await pagina.emulateMedia({ reducedMotion: null }).catch(() => undefined);
  }
}

/** Une dos mesas desde el mapa («Unir mesas»), contestando lo que pregunta el sistema. */
export async function unirMesas(pagina: Page, principal: number, otra: number): Promise<void> {
  // Desde el mapa: con el diálogo de una mesa abierto el botón no está (D1-022).
  await alMapa(pagina);
  await sinTemblor(pagina, () => unirEnElPlano(pagina, principal, otra));
}

/** El plano de «Unir mesas» enseña UNA zona a la vez: se busca la mesa en las pestañas de zona. */
async function aLaZonaDelPlano(pagina: Page, mesa: Locator): Promise<void> {
  if ((await mesa.count()) > 0) return;
  const pestanas = pestanasDeZona(pagina);
  const cuantas = await pestanas.count();
  for (let i = 0; i < cuantas; i += 1) {
    await pestanas.nth(i).click({ timeout: ESPERA_MS });
    await pagina.waitForTimeout(300);
    if ((await mesa.count()) > 0) return;
  }
}

async function unirEnElPlano(pagina: Page, principal: number, otra: number): Promise<void> {
  await pagina.getByRole('button', { name: 'Unir mesas' }).click({ timeout: ESPERA_MS });
  const plano = pagina.getByRole('region', { name: 'Unir mesas' });
  const enElPlano = (n: number) =>
    plano.getByRole('button', { name: `Mesa ${String(n)}`, exact: true });
  await aLaZonaDelPlano(pagina, enElPlano(principal));
  await enElPlano(principal).click();
  await aLaZonaDelPlano(pagina, enElPlano(otra));
  await enElPlano(otra).click();
  await plano.getByRole('button', { name: /^Unir 2 mesas/ }).click();
  const numero = pagina.getByRole('alertdialog', { name: '¿Qué número queda?' });
  const todosModos = pagina.getByRole('alertdialog', { name: '¿Unir de todos modos?' });
  await todosModos.or(numero).first().waitFor({ timeout: ESPERA_MS });
  if (await todosModos.isVisible()) {
    await todosModos.getByRole('button', { name: 'Unir', exact: true }).click();
    await todosModos.waitFor({ state: 'hidden', timeout: ESPERA_MS });
  }
  if (await numero.isVisible().catch(() => false)) {
    await numero.getByRole('radio', { name: `Mesa ${String(principal)}` }).click();
    await numero.getByRole('button', { name: 'Unir', exact: true }).click();
    await numero.waitFor({ state: 'hidden', timeout: ESPERA_MS });
  }
  await plano.waitFor({ state: 'hidden', timeout: ESPERA_MS });
}

export async function separarMesas(pagina: Page, principal: number): Promise<void> {
  await alMapa(pagina);
  await sinTemblor(pagina, () => separarEnElPlano(pagina, principal));
}

async function separarEnElPlano(pagina: Page, principal: number): Promise<void> {
  await pagina.getByRole('button', { name: 'Unir mesas' }).click({ timeout: ESPERA_MS });
  const plano = pagina.getByRole('region', { name: 'Unir mesas' });
  const laPrincipal = plano.getByRole('button', { name: `Mesa ${String(principal)}`, exact: true });
  await aLaZonaDelPlano(pagina, laPrincipal);
  await laPrincipal.click();
  await plano.getByRole('button', { name: 'Separar mesas' }).click();
  const pregunta = pagina.getByRole('alertdialog', { name: '¿Separar las mesas?' });
  await pregunta.getByRole('button', { name: 'Separar mesas' }).click();
  await pregunta.waitFor({ state: 'hidden', timeout: ESPERA_MS });
  await plano.waitFor({ state: 'hidden', timeout: ESPERA_MS });
}

/** Las solicitudes pendientes de la pestaña «Solicitudes»: «Atender Mesa 2: Quiere ordenar». */
export async function solicitudesPendientes(
  pagina: Page,
): Promise<{ mesa: number; motivo: string }[]> {
  await pagina.getByRole('button', { name: /^Solicitudes/ }).click({ timeout: ESPERA_MS });
  await pagina.waitForTimeout(800);
  const nombres = await pagina
    .getByRole('button', { name: /^Atender Mesa \d+/ })
    .evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label') ?? b.textContent));
  return nombres.flatMap((n) => {
    const m = /^Atender Mesa (\d+):\s*(.*)$/.exec(n.trim());
    return m?.[1] === undefined ? [] : [{ mesa: Number(m[1]), motivo: m[2] ?? '' }];
  });
}

/** «Atender» una solicitud de ayuda y marcarla «Resuelto». */
export async function atenderAyuda(pagina: Page, mesa: number): Promise<void> {
  await pagina.getByRole('button', { name: /^Solicitudes/ }).click({ timeout: ESPERA_MS });
  await pagina
    .getByRole('button', { name: new RegExp(`^Atender Mesa ${String(mesa)}\\b`) })
    .first()
    .click({ timeout: ESPERA_MS });
  const resuelto = pagina.getByRole('button', { name: 'Resuelto', exact: true });
  if ((await resuelto.count()) > 0) await resuelto.first().click({ timeout: 5_000 });
  await pagina.getByRole('button', { name: 'Mesas', exact: true }).click({ timeout: ESPERA_MS });
}

/**
 * Confirma el pedido que armaron los teléfonos de la mesa: «Atender», el panel «Portal de la mesa ·
 * modo mesero», las personas y «Abrir la mesa» si hace falta, y «Confirmar y enviar a cocina».
 */
export async function confirmarPedidoDelPortal(
  pagina: Page,
  mesa: number,
  personas: number,
): Promise<void> {
  await pagina.getByRole('button', { name: /^Solicitudes/ }).click({ timeout: ESPERA_MS });
  await pagina
    .getByRole('button', { name: new RegExp(`^Atender Mesa ${String(mesa)}\\b`) })
    .first()
    .click({ timeout: ESPERA_MS });
  await pagina.getByRole('button', { name: 'Mesas', exact: true }).click({ timeout: ESPERA_MS });
  const portal = pagina.getByRole('dialog', { name: 'Portal de la mesa · modo mesero' });
  await portal.waitFor({ timeout: ESPERA_MS });
  const abrir = portal.getByRole('button', { name: 'Abrir la mesa' });
  // El carrito del portal llega después del diálogo: se espera a que diga qué toca (abrir la mesa o
  // confirmar). Antes se miraba al instante, no se veía «Abrir la mesa» y se esperaba un «Confirmar»
  // que nunca iba a salir (D1-013).
  await abrir
    .or(portal.getByRole('button', { name: 'Confirmar y enviar a cocina' }))
    .first()
    .waitFor({ timeout: ESPERA_MS });
  if (await abrir.isVisible()) {
    await portal
      .getByText('Personas', { exact: true })
      .locator('xpath=following::input[1]')
      .fill(String(personas));
    await abrir.click();
  }
  // Tras «Abrir la mesa» el panel puede seguir con su botón de confirmar o dar paso al diálogo de la mesa.
  const confirmar = portal.getByRole('button', { name: 'Confirmar y enviar a cocina' });
  const enviarMesa = dialogoDeMesa(pagina, mesa)
    .getByRole('button', { name: 'Enviar a Cocina', exact: true })
    .filter({ visible: true });
  await confirmar.or(enviarMesa).first().waitFor({ timeout: ESPERA_MS });
  await ((await confirmar.count()) > 0 ? confirmar : enviarMesa)
    .first()
    .click({ timeout: ESPERA_MS });
  await pagina
    .getByText(/enviado a cocina/)
    .first()
    .waitFor({ timeout: ESPERA_MS });
  await alMapa(pagina);
}

/** Una mesa cobrada queda en «Limpieza»: el mesero la toca y confirma «¿Marcar mesa como limpia?». */
export async function dejarLimpia(pagina: Page, numero: number): Promise<void> {
  pagina.once('dialog', (aviso) => {
    void aviso.accept();
  });
  await aLaZonaDe(pagina, numero);
  await botonDeMesa(pagina, numero).click({ timeout: ESPERA_MS });
  // Al limpiar la principal de mesas unidas la app pregunta «¿Separar mesas o dejarlas unidas?» (DP-9.6):
  // sin contestarla el diálogo tapaba el plano y todos los toques siguientes fallaban (D22-231 y otros).
  const pregunta = pagina
    .locator('[role="alertdialog"], [role="dialog"]')
    .filter({ hasText: '¿Separar mesas o dejarlas unidas?' });
  const salio = await pregunta
    .first()
    .waitFor({ state: 'visible', timeout: ESPERA_DE_LA_PREGUNTA_MS })
    .then(
      () => true,
      () => false,
    );
  if (!salio) return;
  await pregunta.first().getByRole('button', { name: 'Separar mesas', exact: true }).click();
  await pregunta.first().waitFor({ state: 'hidden', timeout: ESPERA_MS });
}

/** Cuánto se espera la pregunta de las mesas unidas tras limpiar la principal. */
const ESPERA_DE_LA_PREGUNTA_MS = 2_500;
