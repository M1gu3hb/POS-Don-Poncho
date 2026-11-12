/**
 * LA CAJA POR PANTALLA (`/caja`): abrir, traer la de otro aparato, abrir una cuenta pendiente,
 * decidir la propina, aplicar un descuento con el PIN de quien autoriza y cobrar con todos los
 * métodos. Lo que sale de aquí es lo que el servidor contestó al cobrar (nunca lo que el bot cree).
 */
import {
  expect,
  type BrowserContext,
  type Locator,
  type Page,
  type Response,
} from '@playwright/test';

import { apareceEn, cerrado, dialogoCon, pesos, tocarYEsperar } from './comun.ts';

export type EstadoDeLaCaja = 'abierta' | 'cerrada' | 'en-otro-aparato';

export type Pago =
  | { readonly metodo: 'Efectivo'; readonly recibidoCentavos: number }
  | { readonly metodo: 'Tarjeta' }
  | { readonly metodo: 'Transferencia' }
  | {
      readonly metodo: 'Mixto';
      readonly efectivoCentavos: number;
      readonly tarjetaCentavos: number;
      readonly transferenciaCentavos: number;
    };

export type Propina = 5 | 10 | 15 | 20 | 'Sin propina';

export interface Descuento {
  readonly tipo: 'porcentaje' | 'pesos';
  readonly valor: number;
  readonly motivo: string;
  readonly autoriza: { readonly nombre: string; readonly pin: string };
}

export interface Cobrado {
  readonly folio: string;
  readonly totalCentavos: number;
  readonly propinaCentavos: number;
  readonly cambioCentavos: number;
}

export async function irACaja(pagina: Page, appUrl: string): Promise<void> {
  await pagina.goto(`${appUrl}/caja`, { waitUntil: 'domcontentloaded' });
  await expect(pagina.getByRole('tab', { name: /^Pendientes/ })).toBeVisible({ timeout: 45_000 });
}

export async function estadoDeLaCaja(pagina: Page): Promise<EstadoDeLaCaja> {
  const abierta = pagina.getByText(/^Caja abierta desde/);
  // Sin caja propia, la pantalla (DP-18) enseña las abiertas en otros aparatos en esta sección.
  const enOtros = pagina.getByRole('region', { name: 'Cajas abiertas en otros aparatos' });
  const cerrada = pagina.getByText('Caja cerrada', { exact: true });
  await expect(abierta.or(enOtros).or(cerrada).first()).toBeVisible({ timeout: 45_000 });
  // «Caja cerrada» se pinta antes de que llegue el estado: se espera un poco a que aparezca el verdadero.
  await apareceEn(abierta.or(enOtros), 8_000);
  if (await abierta.first().isVisible()) return 'abierta';
  return (await enOtros.isVisible()) ? 'en-otro-aparato' : 'cerrada';
}

export async function abrirCaja(pagina: Page, fondoCentavos: number, notas = ''): Promise<void> {
  await pagina
    .getByRole('button', { name: /^Abrir (otra )?caja/ })
    .first()
    .click();
  const dialogo = dialogoCon(pagina, 'Efectivo inicial contado');
  await dialogo.getByPlaceholder('0.00').fill(pesos(fondoCentavos));
  if (notas !== '') await dialogo.getByPlaceholder(/^Ej: Faltan/).fill(notas);
  const r = await tocarYEsperar(
    pagina,
    dialogo.getByRole('button', { name: 'Abrir caja', exact: true }),
    '/api/caja/abrir',
  );
  expect(r.estado, `abrir caja: ${r.cuerpo.slice(0, 200)}`).toBe(200);
  await cerrado(dialogo);
  await expect(pagina.getByText(/^Caja abierta desde/).first()).toBeVisible();
}

/**
 * «Trasladar aquí» → «Sí, trasladarla» (el traslado de caja a media jornada): la caja de otro aparato
 * pasa a éste. Con varias cajas abiertas en otros aparatos se traslada LA DE `abiertaPor` (quien la
 * abrió, como la lista la dice: «abierta por Caja 2 desde las 08:03»), no la primera.
 */
export async function traerLaCaja(pagina: Page, abiertaPor?: string): Promise<void> {
  const seccion = pagina.getByRole('region', { name: 'Cajas abiertas en otros aparatos' });
  const cajas = seccion.getByRole('listitem');
  // Sin nombre (la caja heredada del día 0, de quien sea) se traslada la primera.
  const suya =
    abiertaPor === undefined
      ? cajas.first()
      : cajas.filter({ hasText: `abierta por ${abiertaPor} desde` });
  await suya.getByRole('button', { name: 'Trasladar aquí' }).click();
  const r = await tocarYEsperar(
    pagina,
    suya.getByRole('button', { name: 'Sí, trasladarla' }),
    '/api/caja/traer',
  );
  expect(r.estado, `trasladar la caja: ${r.cuerpo.slice(0, 200)}`).toBe(200);
  await expect(pagina.getByText(/^Caja abierta desde/).first()).toBeVisible({ timeout: 30_000 });
}

/** Cuánto dice la pantalla que hay que cobrar (centavos), leído del «TOTAL A COBRAR». */
export async function totalEnPantalla(dialogo: Locator): Promise<number> {
  const bloque = dialogo.getByText('TOTAL A COBRAR').locator('xpath=..');
  const texto = (await bloque.innerText()).replace(/\s+/g, ' ');
  const m = /\$\s?([\d,]+\.\d{2})/.exec(texto);
  if (m?.[1] === undefined)
    throw new Error(`No pude leer el total a cobrar: «${texto.slice(0, 120)}»`);
  return Math.round(Number(m[1].replaceAll(',', '')) * 100);
}

/**
 * La propina que se pregunta al abrir la cuenta (si el negocio la pregunta). Los botones se buscan
 * INCLUSO fuera del árbol de accesibilidad: al abrir una PARTE de una cuenta dividida, el cobro y la
 * pregunta de la propina se abren a la vez y la app marca a los dos `aria-hidden` (ninguno es
 * alcanzable por rol, ni para un lector de pantalla). Si pasa, `alOcultarse` lo dice.
 */
export async function decidirLaPropina(
  pagina: Page,
  cobro: Locator,
  propina: Propina,
  alOcultarse?: () => void,
): Promise<void> {
  const pregunta = pagina.getByText('¿Desean agregar propina?');
  await expect(pregunta.or(cobro).first()).toBeVisible({ timeout: 30_000 });
  if (!(await pregunta.isVisible())) return;
  const sinPropina = pagina.getByRole('button', { name: 'Sin propina', includeHidden: true });
  const aplicar = pagina.getByRole('button', { name: 'Aplicar', exact: true, includeHidden: true });
  if (
    alOcultarse !== undefined &&
    (await pagina.getByRole('button', { name: 'Sin propina' }).count()) === 0
  )
    alOcultarse();
  if (propina === 'Sin propina') {
    await sinPropina.click();
  } else {
    await pagina.getByText(`${String(propina)}%`, { exact: true }).click();
    await aplicar.click();
  }
  await expect(pregunta).toBeHidden();
}

/** Abre una cuenta de «Pendientes» (por el nombre del botón) y deja el diálogo de cobro listo. */
export async function abrirLaCuenta(
  pagina: Page,
  rotulo: RegExp,
  titulo: string,
  propina: Propina,
  /** Si el diálogo no se titula «Cobrar — <titulo>» (las partes de una cuenta dividida), cómo se reconoce. */
  tituloDelDialogo?: string | RegExp,
  alOcultarse?: () => void,
): Promise<Locator> {
  await pagina.getByRole('tab', { name: /^Pendientes/ }).click();
  await pagina.getByRole('button', { name: rotulo }).first().click();
  const dialogo = dialogoCon(pagina, tituloDelDialogo ?? `Cobrar — ${titulo}`);
  await decidirLaPropina(pagina, dialogo, propina, alOcultarse);
  await expect(dialogo).toBeVisible();
  return dialogo;
}

/** «Descuento» dentro del cobro: PIN de quien autoriza, cuánto y por qué. */
export async function aplicarDescuento(pagina: Page, cobro: Locator, d: Descuento): Promise<void> {
  await cobro.getByRole('button', { name: 'Descuento', exact: true }).click();
  const dialogo = pagina.getByRole('dialog', { name: 'Descuento' });
  await expect(dialogo).toBeVisible();
  await dialogo
    .getByRole('button', { name: d.tipo === 'porcentaje' ? 'En porcentaje' : 'En pesos' })
    .click();
  await dialogo
    .getByLabel(d.tipo === 'porcentaje' ? 'Porcentaje' : 'Cuánto se descuenta')
    .fill(String(d.valor));
  await dialogo.getByLabel('Por qué').fill(d.motivo);
  await dialogo
    .getByRole('group', { name: 'Quién autoriza' })
    .getByRole('button', { name: d.autoriza.nombre })
    .click();
  await dialogo.getByLabel('PIN de quien autoriza').fill(d.autoriza.pin);
  await dialogo.getByRole('button', { name: 'Autorizar' }).click();
  await expect(dialogo.getByText(`Autorizó ${d.autoriza.nombre}.`)).toBeVisible();
  const r = await tocarYEsperar(
    pagina,
    dialogo.getByRole('button', { name: 'Aplicar el descuento' }),
    '/api/restaurante/descontar-cuenta',
  );
  expect(r.estado, `descuento: ${r.cuerpo.slice(0, 200)}`).toBe(200);
  await cerrado(dialogo);
}

/**
 * Intenta un descuento SIN PIN: llena lo que la cajera puede (cuánto y por qué) y comprueba que la
 * pantalla no la deja aplicarlo (todo descuento lo autoriza un gerente, administrador o dueño con
 * su PIN, aunque sea de $1). Cierra el diálogo sin aplicar. Devuelve si «Aplicar el descuento»
 * quedó apagado: si no lo está, quien llama lo toca y mira qué contesta el servidor.
 */
export async function intentarDescuentoSinPin(
  pagina: Page,
  cobro: Locator,
  d: Omit<Descuento, 'autoriza'>,
): Promise<{ aplicarApagado: boolean; dialogo: Locator }> {
  await cobro.getByRole('button', { name: 'Descuento', exact: true }).click();
  const dialogo = pagina.getByRole('dialog', { name: 'Descuento' });
  await expect(dialogo).toBeVisible();
  await dialogo
    .getByRole('button', { name: d.tipo === 'porcentaje' ? 'En porcentaje' : 'En pesos' })
    .click();
  await dialogo
    .getByLabel(d.tipo === 'porcentaje' ? 'Porcentaje' : 'Cuánto se descuenta')
    .fill(String(d.valor));
  await dialogo.getByLabel('Por qué').fill(d.motivo);
  await expect(dialogo.getByRole('group', { name: 'Quién autoriza' })).toBeVisible();
  const aplicar = dialogo.getByRole('button', { name: 'Aplicar el descuento' });
  return { aplicarApagado: await aplicar.isDisabled(), dialogo };
}

/** Cierra el diálogo del descuento sin aplicar nada. */
export async function soltarElDescuento(pagina: Page, dialogo: Locator): Promise<void> {
  await pagina.keyboard.press('Escape');
  await cerrado(dialogo);
}

async function elegirElPago(cobro: Locator, pago: Pago): Promise<void> {
  await cobro.getByRole('button', { name: pago.metodo, exact: true }).click();
  if (pago.metodo === 'Efectivo')
    await cobro.getByPlaceholder('0.00').fill(pesos(pago.recibidoCentavos));
  if (pago.metodo === 'Mixto') {
    const partes = cobro.getByPlaceholder('0', { exact: true });
    if (pago.efectivoCentavos > 0) await partes.nth(0).fill(pesos(pago.efectivoCentavos));
    if (pago.tarjetaCentavos > 0) await partes.nth(1).fill(pesos(pago.tarjetaCentavos));
    if (pago.transferenciaCentavos > 0) await partes.nth(2).fill(pesos(pago.transferenciaCentavos));
    await expect(cobro.getByText(/queda cubierta\.$/)).toBeVisible();
  }
}

interface RespuestaDeCobro {
  readonly ok: boolean;
  readonly error?: { readonly mensaje?: string };
  readonly datos?: {
    readonly folio: string;
    readonly totalCentavos: string;
    readonly propinaCentavos: string;
    readonly cambioCentavos: string;
  };
}

/** Paga con el método elegido, toca «Cobrar $…», cierra el ticket y devuelve lo que contestó el servidor. */
export async function cobrar(
  pagina: Page,
  cobro: Locator,
  pago: Pago,
  variacion: VariacionDelCobro = {},
): Promise<Cobrado> {
  await elegirElPago(cobro, pago);
  const respuestas: Response[] = [];
  const alResponder = (r: Response): void => {
    if (new URL(r.url()).pathname === '/api/venta/cobrar' && r.request().method() === 'POST')
      respuestas.push(r);
  };
  pagina.on('response', alResponder);
  const boton = cobro.getByRole('button', { name: /^Cobrar \$/ });
  if (variacion.sinRed !== undefined) {
    await variacion.sinRed.contexto.setOffline(true);
    await boton.click();
    await variacion.sinRed.esperar();
    await variacion.sinRed.contexto.setOffline(false);
    await expect(boton).toBeVisible();
    await boton.click();
  } else if (variacion.doble === true) {
    await boton.dblclick();
  } else {
    await boton.click();
  }
  const ticket = pagina.getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' });
  const separar = pagina.getByText('¿Separar mesas o dejarlas unidas?');
  await expect(separar.or(ticket).first()).toBeVisible({ timeout: 45_000 });
  pagina.off('response', alResponder);
  const aceptados = await Promise.all(
    respuestas.map(async (r) => (await r.json()) as RespuestaDeCobro),
  );
  const buenos = aceptados.filter((a) => a.ok && a.datos !== undefined);
  const primero = buenos[0]?.datos;
  if (primero === undefined)
    throw new Error(`Cobro rechazado: ${aceptados[0]?.error?.mensaje ?? 'sin respuesta'}`);
  if (buenos.length > 1)
    throw new Error(
      `COBRO DOBLE: el servidor aceptó ${String(buenos.length)} cobros de la misma cuenta (${buenos.map((b) => b.datos?.folio).join(', ')})`,
    );
  if (await separar.isVisible())
    await pagina.getByRole('button', { name: 'Separar mesas' }).click();
  await expect(ticket).toBeVisible({ timeout: 30_000 });
  await ticket.getByRole('button', { name: 'Cerrar' }).click();
  await expect(ticket).toBeHidden();
  return {
    folio: primero.folio,
    totalCentavos: Number(primero.totalCentavos),
    propinaCentavos: Number(primero.propinaCentavos),
    cambioCentavos: Number(primero.cambioCentavos),
  };
}

/** Lo que se le hace al cobro para el caos controlado. */
export interface VariacionDelCobro {
  /** Doble toque en «Cobrar $…»: tiene que entrar UN solo cobro. */
  readonly doble?: boolean;
  /** Sin red al tocar «Cobrar $…»: se espera, vuelve la red y se vuelve a tocar. */
  readonly sinRed?: { readonly contexto: BrowserContext; readonly esperar: () => Promise<void> };
}
