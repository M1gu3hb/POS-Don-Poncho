/**
 * LO QUE LA DUEÑA CAMBIA A MEDIA OPERACIÓN, POR PANTALLA Y CON EL DEDO (DP-22, el día de bots): el IVA,
 * quién elige la propina, el cupo y el nombre de las cajas, el portal, una estación y una categoría
 * nuevas, a qué estación va una categoría, mover una mesa en el editor, dar de alta a un mesero,
 * desactivar a otro y repartir las mesas. Todo con los mismos selectores que el día 0 y la
 * Configuración de DP-21; cada función vuelve cuando el servidor contestó o lanza con lo que vio.
 */
import { expect, type Locator, type Page } from '@playwright/test';

import { arrastrar } from '../../../pruebas/e2e/qa-final/arnes/toque.ts';
import { dialogoCon, esperarPost } from './comun.ts';

const aConfiguracion = async (pagina: Page, url: string, seccion: string): Promise<void> => {
  await pagina.goto(`${url}/configuracion?seccion=${seccion}`, { waitUntil: 'domcontentloaded' });
};

/** La tarjeta de Configuración que lleva ese título (`<section>` con su `<h3>`). */
function tarjetaCon(pagina: Page, titulo: string | RegExp): Locator {
  return pagina
    .getByRole('heading', { name: titulo })
    .first()
    .locator('xpath=ancestor::section[1]');
}

async function guardarYEsperar(
  pagina: Page,
  boton: Locator,
  ruta: string | RegExp,
): Promise<{ estado: number; cuerpo: string }> {
  const respuesta = esperarPost(pagina, ruta);
  await boton.click();
  const r = await respuesta;
  return { estado: r.status(), cuerpo: await r.text() };
}

export interface QuienesEligenLaPropina {
  readonly comensales: boolean;
  readonly mesero: boolean;
  readonly caja: boolean;
}

/** Configuración → Ventas y cobro → «¿Quién puede elegir la propina?». */
export async function fijarQuienEligeLaPropina(
  pagina: Page,
  url: string,
  quienes: QuienesEligenLaPropina,
): Promise<void> {
  await aConfiguracion(pagina, url, 'ventas-y-cobro');
  const tarjeta = tarjetaCon(pagina, '¿Quién puede elegir la propina?');
  const casillas: readonly (readonly [RegExp, boolean])[] = [
    [/^Comensales/, quienes.comensales],
    [/^Mesero/, quienes.mesero],
    [/^Caja/, quienes.caja],
  ];
  for (const [nombre, deseada] of casillas) {
    const casilla = tarjeta.getByRole('checkbox', { name: nombre });
    await expect(casilla).toBeVisible({ timeout: 45_000 });
    if (((await casilla.getAttribute('aria-checked')) === 'true') !== deseada)
      await casilla.click();
  }
  const guardar = tarjeta.getByRole('button', { name: 'Guardar', exact: true });
  if (!(await guardar.isEnabled())) return; // ya estaba así
  const r = await guardarYEsperar(pagina, guardar, '/api/configuracion/quien-elige-la-propina');
  expect(r.estado, `quién elige la propina: ${r.cuerpo.slice(0, 200)}`).toBe(200);
}

/** Configuración → Ventas y cobro → «IVA»: devuelve la tasa que había. */
export async function fijarElIva(
  pagina: Page,
  url: string,
  tasa: 'Sin IVA' | '8 %' | '16 %',
): Promise<string> {
  await aConfiguracion(pagina, url, 'ventas-y-cobro');
  const tarjeta = tarjetaCon(pagina, /^IVA$/);
  const radios = tarjeta.getByRole('radio');
  await expect(radios.first()).toBeVisible({ timeout: 45_000 });
  let antes = '';
  for (const radio of await radios.all()) {
    if ((await radio.getAttribute('aria-checked')) === 'true')
      antes = (await radio.innerText()).trim();
  }
  await radios.filter({ hasText: new RegExp(`^${tasa}$`) }).click();
  const guardar = tarjeta.getByRole('button', { name: 'Guardar', exact: true });
  if (!(await guardar.isEnabled())) return antes;
  const r = await guardarYEsperar(pagina, guardar, '/api/configuracion/fijar-impuesto');
  expect(r.estado, `IVA: ${r.cuerpo.slice(0, 200)}`).toBe(200);
  return antes;
}

/** Configuración → Caja → «1 caja» / «2 cajas». Devuelve si el servidor lo aceptó (bajar con cajas abiertas se rechaza). */
export async function fijarElCupoDeCajas(
  pagina: Page,
  url: string,
  cajas: 1 | 2,
): Promise<{ aceptado: boolean; aviso: string }> {
  await aConfiguracion(pagina, url, 'caja');
  const boton = pagina.getByRole('button', {
    name: cajas === 1 ? '1 caja' : '2 cajas',
    exact: true,
  });
  await expect(boton).toBeVisible({ timeout: 45_000 });
  if ((await boton.getAttribute('aria-pressed')) === 'true') return { aceptado: true, aviso: '' };
  const respuesta = esperarPost(pagina, '/api/caja/fijar-cajas-simultaneas');
  await boton.click();
  const r = await respuesta;
  if (r.status() === 200) return { aceptado: true, aviso: '' };
  return { aceptado: false, aviso: (await r.text()).slice(0, 200) };
}

/** Configuración → Caja → «El nombre de cada caja» (vacío = el nombre por omisión). */
export async function nombrarLaCaja(
  pagina: Page,
  url: string,
  lugar: number,
  nombre: string,
): Promise<void> {
  await aConfiguracion(pagina, url, 'caja');
  const campo = pagina.getByLabel(`Caja ${String(lugar)}`, { exact: true });
  await expect(campo).toBeVisible({ timeout: 45_000 });
  await campo.fill(nombre);
  const guardar = pagina.getByRole('button', { name: 'Guardar nombres', exact: true });
  const r = await guardarYEsperar(pagina, guardar, '/api/caja/nombrar-cajas');
  expect(r.estado, `nombrar caja: ${r.cuerpo.slice(0, 200)}`).toBe(200);
}

/** Configuración → Portal de comensales → «Activar Portal QR». */
export async function fijarElPortal(pagina: Page, url: string, encendido: boolean): Promise<void> {
  await aConfiguracion(pagina, url, 'portal');
  const interruptor = pagina
    .getByText('Activar Portal QR', { exact: true })
    .locator('xpath=ancestor::div[.//button[@role="switch"]][1]')
    .getByRole('switch');
  await expect(interruptor).toBeVisible({ timeout: 45_000 });
  if (((await interruptor.getAttribute('aria-checked')) === 'true') !== encendido)
    await interruptor.click();
  const tarjeta = interruptor.locator(
    'xpath=ancestor::*[.//button[normalize-space()="Guardar"]][1]',
  );
  const guardar = tarjeta.getByRole('button', { name: 'Guardar', exact: true });
  if (!(await guardar.isEnabled())) return;
  const r = await guardarYEsperar(pagina, guardar, '/api/datos/escribir');
  expect(r.estado, `portal: ${r.cuerpo.slice(0, 200)}`).toBe(200);
}

/** Configuración → Operación: una estación nueva (si no existe). */
export async function crearLaEstacion(pagina: Page, url: string, nombre: string): Promise<boolean> {
  await aConfiguracion(pagina, url, 'cocina');
  await expect(pagina.getByText('Administrar estaciones')).toBeVisible({ timeout: 45_000 });
  const existentes = await pagina
    .locator(
      'xpath=//div[.//button[@title="Editar estación"] and not(.//div[.//button[@title="Editar estación"]])]',
    )
    .allInnerTexts();
  if (existentes.some((t) => (t.split('\n')[0] ?? '').trim() === nombre)) return false;
  await pagina.getByRole('button', { name: 'Nueva estación' }).click();
  const dialogo = pagina.getByRole('dialog').filter({ hasText: 'Nueva estación' });
  await dialogo.getByPlaceholder('Ej. Barra, Postres, Barbacoa').fill(nombre);
  await dialogo.getByRole('button', { name: 'Crear', exact: true }).click();
  await expect(dialogo).toBeHidden({ timeout: 30_000 });
  return true;
}

const filaDeCategoria = (pagina: Page, nombre: string): Locator =>
  pagina
    .locator(
      'xpath=//div[.//button[@title="Editar categoría"] and not(.//div[.//button[@title="Editar categoría"]])]',
    )
    .filter({ has: pagina.getByText(nombre, { exact: true }) });

/** Configuración → Productos e inventario: una categoría nueva (si no existe). */
export async function crearLaCategoria(
  pagina: Page,
  url: string,
  nombre: string,
): Promise<boolean> {
  await aConfiguracion(pagina, url, 'productos');
  await expect(pagina.getByPlaceholder('Ej. Tacos')).toBeVisible({ timeout: 45_000 });
  if ((await filaDeCategoria(pagina, nombre).count()) > 0) return false;
  await pagina.getByPlaceholder('Ej. Tacos').fill(nombre);
  await pagina.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(pagina.getByText(nombre, { exact: true }).first()).toBeVisible();
  return true;
}

/** «Editar categoría» → la estación a la que va (con cuentas abiertas: lo ya pedido no se mueve). */
export async function asignarLaCategoria(
  pagina: Page,
  url: string,
  categoria: string,
  estacion: string,
): Promise<void> {
  await aConfiguracion(pagina, url, 'productos');
  await expect(pagina.getByPlaceholder('Ej. Tacos')).toBeVisible({ timeout: 45_000 });
  const fila = filaDeCategoria(pagina, categoria).first();
  await fila.getByTitle('Editar categoría').click();
  const dialogo = pagina.getByRole('dialog').filter({ hasText: 'Editar categoría' });
  await dialogo.getByRole('combobox').click();
  // Al principio del nombre: «Cocina» se llama «Cocina (general)» y «— Sin estación (Cocina general) —» también la
  // nombra (D22-060, strict mode con el nombre suelto y ninguna coincidencia con el exacto).
  const nombre = new RegExp(`^${estacion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`);
  await pagina.getByRole('option', { name: nombre }).click();
  const r = await guardarYEsperar(
    pagina,
    dialogo.getByRole('button', { name: 'Guardar' }),
    '/api/datos/escribir',
  );
  expect(r.estado, `asignar categoría: ${r.cuerpo.slice(0, 200)}`).toBe(200);
  await expect(dialogo).toBeHidden({ timeout: 20_000 });
}

/**
 * El editor muestra UNA zona a la vez («Salón (10)», «Terraza (10)»): si la mesa no está en la zona a
 * la vista, se prueban las demás pestañas hasta que aparece (la 14 vive en la terraza).
 */
async function ponerLaZonaDeLaMesa(pagina: Page, mesa: Locator): Promise<void> {
  // Se ESPERA a que la mesa aparezca tras cada cambio de pestaña: contar de inmediato leía 0 antes de que
  // React pintara la zona y el bot se rendía (S1r del día 2215, D22-036: la 14 vive en la terraza).
  const aLaVista = (): Promise<boolean> =>
    mesa.waitFor({ state: 'visible', timeout: 2_500 }).then(
      () => true,
      () => false,
    );
  if (await aLaVista()) return;
  const zonas = pagina.getByRole('button', { name: /^\D+\(\d+\)$/ });
  const cuantas = await zonas.count();
  for (let i = 0; i < cuantas; i += 1) {
    await zonas.nth(i).click();
    if (await aLaVista()) return;
  }
}

/** Configuración → Mesas: arrastra con el dedo la mesa `numero` (el editor es un mapa). Devuelve cuánto se movió. */
export async function moverLaMesa(
  pagina: Page,
  url: string,
  numero: number,
  dx: number,
  dy: number,
): Promise<{ antes: { x: number; y: number }; despues: { x: number; y: number } }> {
  await aConfiguracion(pagina, url, 'salon');
  await expect(pagina.getByRole('button', { name: 'Nueva mesa' })).toBeVisible({ timeout: 45_000 });
  // En el mapa cada mesa es un botón cuyo nombre empieza con su número («3 Libre»).
  const mesa = pagina.getByRole('button', { name: new RegExp(`^${String(numero)}\\s`) }).first();
  await ponerLaZonaDeLaMesa(pagina, mesa);
  await mesa.scrollIntoViewIfNeeded();
  const caja = await mesa.boundingBox();
  if (caja === null) throw new Error(`La mesa ${String(numero)} no está a la vista en el editor.`);
  const antes = { x: Math.round(caja.x), y: Math.round(caja.y) };
  const centro = { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 };
  const escritura = pagina
    .waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().includes('/api/datos/escribir'),
      { timeout: 30_000 },
    )
    .catch(() => null);
  await arrastrar(pagina, centro, { x: centro.x + dx, y: centro.y + dy });
  const r = await escritura;
  if (r !== null) expect(r.status(), 'mover la mesa').toBe(200);
  const despuesCaja = await mesa.boundingBox();
  return {
    antes,
    despues: { x: Math.round(despuesCaja?.x ?? antes.x), y: Math.round(despuesCaja?.y ?? antes.y) },
  };
}

/** Configuración → Usuarios POS → «Nuevo usuario» (mesero), con el PIN de prueba que le toca. */
export async function darDeAltaAlMesero(
  pagina: Page,
  url: string,
  nombre: string,
  pin: string,
): Promise<void> {
  await aConfiguracion(pagina, url, 'personas');
  await expect(pagina.getByRole('button', { name: 'Nuevo usuario' })).toBeVisible({
    timeout: 45_000,
  });
  await pagina.getByRole('button', { name: 'Nuevo usuario' }).click();
  const dialogo = pagina.getByRole('dialog').filter({ hasText: 'Nuevo usuario POS' });
  await dialogo.getByPlaceholder('Nombre del usuario').fill(nombre);
  await dialogo.getByRole('combobox', { name: 'Puesto' }).click();
  await pagina.getByRole('option', { name: 'Mesero', exact: true }).click();
  const campos = dialogo.getByPlaceholder('••••');
  await campos.nth(0).fill(pin);
  await campos.nth(1).fill(pin);
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialogo).toBeHidden({ timeout: 30_000 });
}

/** Configuración → Usuarios POS → «Editar a …» → apagar «Activo». */
export async function desactivarAlUsuario(
  pagina: Page,
  url: string,
  nombre: string,
): Promise<void> {
  await aConfiguracion(pagina, url, 'personas');
  await pagina.getByRole('button', { name: `Editar a ${nombre}`, exact: true }).click();
  const dialogo = dialogoCon(pagina, 'Editar');
  const activo = dialogo.getByRole('switch').last();
  await expect(activo).toBeVisible({ timeout: 30_000 });
  if ((await activo.getAttribute('aria-checked')) === 'true') await activo.click();
  const r = await guardarYEsperar(
    pagina,
    dialogo.getByRole('button', { name: 'Guardar' }),
    /\/api\/(identidad|datos)\//,
  );
  expect(r.estado, `desactivar a ${nombre}: ${r.cuerpo.slice(0, 200)}`).toBe(200);
  await expect(dialogo).toBeHidden({ timeout: 30_000 });
}

/** Configuración → Mesas → «Repartir mesas»: cada mesero con sus mesas. */
export async function repartirLasMesas(
  pagina: Page,
  url: string,
  reparto: readonly { readonly mesero: string; readonly mesas: readonly number[] }[],
): Promise<void> {
  await aConfiguracion(pagina, url, 'salon');
  await expect(pagina.getByRole('button', { name: 'Nueva mesa' })).toBeVisible({ timeout: 45_000 });
  for (const { mesero, mesas } of reparto) {
    await pagina.getByRole('button', { name: 'Repartir mesas' }).click();
    const dialogo = pagina
      .getByRole('dialog')
      .filter({ hasText: 'Elige al mesero y marca las mesas' });
    await dialogo.getByRole('radio', { name: mesero }).click();
    await dialogo.getByRole('button', { name: 'Ninguna' }).click();
    for (const m of mesas)
      await dialogo.getByRole('checkbox', { name: `Mesa ${String(m)}`, exact: true }).click();
    await dialogo.getByRole('button', { name: 'Repartir', exact: true }).click();
    await expect(dialogo).toBeHidden({ timeout: 30_000 });
  }
}
