/**
 * LAS PANTALLAS DEL MESERO (teléfono): el mapa de sus mesas, abrir una, pedir platillo por platillo
 * (por pieza, con opciones y por peso), mandar a cocina y entregar lo listo. Selectores por ROL y
 * TEXTO accesible, como las pruebas e2e del repo.
 */
import type { Locator, Page } from '@playwright/test';

import { ESPERA_MS, escapar, kilosDichos } from './ayudas.ts';
import { esPorPeso, type LineaPlaneada } from '../pedido.ts';

const ESTADOS =
  'Libre|Esperando orden|Pedido enviado|En preparación|Esperando entrega|Ocupada|Cuenta solicitada|Limpieza';

export interface MesaEnPantalla {
  readonly numero: number;
  readonly estado: string;
}

/**
 * «12 Esperando entrega» con lo que haya antes, mientras no sea otro dígito: en el mapa el texto
 * incluye los emojis de la mesa («🎉12 …» con celebración) y el número ya no va al principio
 * (D1-038 y D1-042: el Mesero 4 no podía entrar a su mesa 12). Una mesa unida lleva entre el
 * número y el estado su leyenda («7 Mesa 7 · Unida con 8 Ocupada»): sin admitirla, la 7 no se
 * encontraba y el «8» de la leyenda pasaba por otra mesa (quinta corrida del día 1: el Mesero 2
 * no pudo entrar a la 7 en siete horas y la mesa no se cobró).
 */
const LEYENDA_DE_UNION = '(?:Mesa \\d+ · Unida con [\\d ,y]+?\\s*)?';
const numeroYEstado = (numero: string): RegExp =>
  new RegExp(`(?<!\\d)${numero}\\s*${LEYENDA_DE_UNION}(${ESTADOS})`);

const CUALQUIER_MESA = numeroYEstado('\\d+');

/**
 * Las mesas que dicen `nombre`. En la lista del teléfono son botones; en el mapa de tableta y
 * escritorio son `div` sin rol ni foco (hallazgo A15 del día 1: el Mesero 4, en tableta, no vio una
 * sola mesa en todo el día). Ahí se toca el círculo por su texto, el más chico que lo dice.
 */
function mesasQueDicen(pagina: Page, nombre: RegExp): Locator {
  const enLista = pagina.getByRole('button', { name: nombre });
  const enMapa = pagina
    .locator('div')
    .filter({ hasText: nombre })
    .filter({ hasNot: pagina.locator('div').filter({ hasText: CUALQUIER_MESA }) });
  return enLista.or(enMapa);
}

/** La mesa como círculo del mapa (escritorio y tableta) o botón de la lista (teléfono). */
export function botonDeMesa(pagina: Page, numero: number): Locator {
  return mesasQueDicen(pagina, numeroYEstado(String(numero))).first();
}

/** El diálogo de la mesa abierta: su nombre es el encabezado, «Mesa 1 Esperando orden 3». */
export function dialogoDeMesa(pagina: Page, numero: number): Locator {
  return pagina.getByRole('dialog', { name: new RegExp(`^Mesa ${String(numero)} `) });
}

/**
 * Las pestañas de zona («Salón (2)», «Terraza (1)»). Salen cuando las mesas del mesero están en más
 * de una zona, y la pantalla muestra una zona a la vez. El Mesero 3 tiene la 9 y la 10 en el Salón y
 * la 11 en la Terraza: sin cambiar de pestaña, la 9 y la 10 se quedaron todo el día 1 sin mesero
 * (sus grupos del portal nunca se confirmaron y las mesas no volvieron a usarse).
 */
function pestanasDeZona(pagina: Page): Locator {
  return pagina
    .getByRole('button', { name: /^(?!Solicitudes)[^\d$]+ \(\d+\)$/ })
    .filter({ visible: true });
}

/** Deja a la vista la zona donde está la mesa (si no lo está ya). */
export async function aLaZonaDe(pagina: Page, numero: number): Promise<void> {
  if ((await botonDeMesa(pagina, numero).count()) > 0) return;
  const pestanas = pestanasDeZona(pagina);
  const cuantas = await pestanas.count();
  for (let i = 0; i < cuantas; i += 1) {
    await pestanas.nth(i).click({ timeout: ESPERA_MS });
    await pagina.waitForTimeout(300);
    if ((await botonDeMesa(pagina, numero).count()) > 0) return;
  }
}

/** Las mesas que ve el mesero en su pantalla (en todas sus zonas), con el estado que dice cada una. */
export async function mesasEnPantalla(pagina: Page): Promise<MesaEnPantalla[]> {
  const lectura = numeroYEstado('(\\d+)');
  const vistas = new Map<number, MesaEnPantalla>();
  const leer = async (): Promise<void> => {
    for (const t of await mesasQueDicen(pagina, CUALQUIER_MESA).allTextContents()) {
      const m = lectura.exec(t.replace(/\s+/g, ' '));
      const numero = Number(m?.[1]);
      const estado = m?.[2];
      if (Number.isInteger(numero) && estado !== undefined && !vistas.has(numero))
        vistas.set(numero, { numero, estado });
    }
  };
  await leer();
  const pestanas = pestanasDeZona(pagina);
  const cuantas = await pestanas.count();
  for (let i = 0; cuantas > 1 && i < cuantas; i += 1) {
    await pestanas.nth(i).click({ timeout: ESPERA_MS });
    await pagina.waitForTimeout(300);
    await leer();
  }
  return [...vistas.values()];
}

/** Cierra el diálogo que esté abierto (Escape) y espera a que no quede ninguno. */
export async function alMapa(pagina: Page): Promise<void> {
  for (let i = 0; i < 3 && (await pagina.getByRole('dialog').count()) > 0; i += 1) {
    await pagina.keyboard.press('Escape');
    await pagina.waitForTimeout(400);
  }
}

/** Abre una mesa libre: personas, celebración y alergias, como lo diría el mesero al sentar al grupo. */
export async function abrirMesa(
  pagina: Page,
  numero: number,
  personas: number,
  opciones: { celebracion: boolean; alergia: string },
): Promise<void> {
  await aLaZonaDe(pagina, numero);
  await botonDeMesa(pagina, numero).click({ timeout: ESPERA_MS });
  const apertura = pagina.getByRole('dialog', { name: `Abrir mesa ${String(numero)}` });
  await apertura.waitFor({ timeout: ESPERA_MS });
  await apertura.getByRole('spinbutton').first().fill(String(personas));
  if (opciones.alergia !== '') await apertura.getByPlaceholder(/alérgico/i).fill(opciones.alergia);
  if (opciones.celebracion) await apertura.getByRole('switch').click();
  const abierta = pagina.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/restaurante/abrir-mesa' &&
      r.request().method() === 'POST',
    { timeout: ESPERA_MS },
  );
  await apertura.getByRole('button', { name: 'Abrir mesa', exact: true }).click();
  const respuesta = await abierta;
  if (!respuesta.ok()) throw new Error(`abrir-mesa respondió ${String(respuesta.status())}`);
  await dialogoDeMesa(pagina, numero).waitFor({ timeout: ESPERA_MS });
}

/** Abre una mesa que ya tiene cuenta (toca su botón en la lista). */
export async function entrarALaMesa(pagina: Page, numero: number): Promise<void> {
  if ((await dialogoDeMesa(pagina, numero).count()) > 0) return;
  await aLaZonaDe(pagina, numero);
  await botonDeMesa(pagina, numero).click({ timeout: ESPERA_MS });
  await dialogoDeMesa(pagina, numero).waitFor({ timeout: ESPERA_MS });
}

function fichaDePlatillo(mesa: Locator, nombre: string): Locator {
  return mesa.getByRole('button', { name: new RegExp(`^${escapar(nombre)} \\$`) }).first();
}

async function personalizar(pagina: Page, linea: LineaPlaneada): Promise<void> {
  const dialogo = pagina.getByRole('dialog', { name: 'Personalizar producto' });
  await dialogo.waitFor({ timeout: ESPERA_MS });
  for (const o of linea.opciones)
    await dialogo
      .getByRole('button', { name: nombreDeOpcion(o.opcion) })
      .first()
      .click();
  if (linea.nota !== '') await dialogo.getByRole('textbox').fill(linea.nota);
  await dialogo.getByRole('button', { name: /^Agregar/ }).click();
  await dialogo.waitFor({ state: 'detached', timeout: ESPERA_MS });
}

async function agregarPorPeso(pagina: Page, linea: LineaPlaneada): Promise<void> {
  const dialogo = pagina.getByRole('dialog', { name: linea.producto.nombre });
  await dialogo.waitFor({ timeout: ESPERA_MS });
  const atajo = dialogo.getByRole('button', { name: kilosDichos(linea.cantidad), exact: true });
  if (linea.producto.presentaciones.includes(linea.cantidad) && (await atajo.count()) > 0)
    await atajo.click();
  else await dialogo.getByRole('spinbutton').fill(String(linea.cantidad));
  await dialogo.getByRole('button', { name: 'Agregar al pedido' }).click();
  await dialogo.waitFor({ state: 'detached', timeout: ESPERA_MS });
}

/** Toca el platillo en el diálogo de la mesa y lo deja en el pedido (sin enviar). */
export async function agregarLinea(
  pagina: Page,
  numero: number,
  linea: LineaPlaneada,
): Promise<void> {
  const mesa = dialogoDeMesa(pagina, numero);
  const ficha = fichaDePlatillo(mesa, linea.producto.nombre);
  await ficha.scrollIntoViewIfNeeded({ timeout: ESPERA_MS });
  if (esPorPeso(linea.producto)) {
    await ficha.click();
    await agregarPorPeso(pagina, linea);
    return;
  }
  for (let i = 0; i < linea.cantidad; i += 1) {
    await ficha.click();
    if (linea.producto.grupos.length > 0) await personalizar(pagina, linea);
  }
}

/** Lo que dice el carrito flotante («3 productos $482.50 · Ver pedido»), en centavos; `null` si no hay. */
export async function totalDelCarrito(pagina: Page): Promise<number | null> {
  const carrito = pagina
    .getByRole('button', { name: /\d+ productos? .*Ver pedido/ })
    .filter({ visible: true })
    .last();
  if ((await carrito.count()) === 0) return null;
  const monto = /\$([\d,]+\.\d\d)/.exec(await carrito.innerText());
  return monto?.[1] === undefined ? null : Math.round(Number(monto[1].replaceAll(',', '')) * 100);
}

/** Los «−» del carrito (y el «Quitar línea» de lo pedido por peso): no tienen nombre accesible. */
const QUITAR_DEL_CARRITO = 'button:has(svg.lucide-minus), button[title="Quitar línea"]';

/** ¿Queda algo en el carrito? El globo del teléfono lo dice; en tableta, la lista de al lado. */
async function hayAlgoEnElCarrito(pagina: Page): Promise<boolean> {
  if ((await totalDelCarrito(pagina)) !== null) return true;
  return (await pagina.locator(QUITAR_DEL_CARRITO).filter({ visible: true }).count()) > 0;
}

/**
 * Deja vacío el carrito de la mesa. Lo que quedó de un intento que falló a media ronda sobrevive a
 * la recarga y se iría con la ronda siguiente sin que el libro lo sepa (D1-054, D1-066 y D1-070
 * del día 1). Cierra la personalización que haya quedado abierta y toca «−» hasta que no quede
 * nada. Devuelve cuántos toques hizo.
 */
export async function vaciarCarrito(pagina: Page): Promise<number> {
  const personalizacion = pagina.getByRole('dialog', { name: 'Personalizar producto' });
  if ((await personalizacion.count()) > 0) {
    await pagina.keyboard.press('Escape');
    await personalizacion.waitFor({ state: 'detached', timeout: ESPERA_MS });
  }
  const quitar = pagina.locator(QUITAR_DEL_CARRITO).filter({ visible: true });
  let toques = 0;
  while (toques < 80 && (await hayAlgoEnElCarrito(pagina))) {
    if ((await quitar.count()) === 0) {
      await pagina
        .getByRole('button', { name: /Ver pedido/ })
        .filter({ visible: true })
        .last()
        .click({ timeout: ESPERA_MS });
      await quitar.first().waitFor({ timeout: ESPERA_MS });
    }
    await quitar.first().click({ timeout: ESPERA_MS });
    toques += 1;
    await pagina.waitForTimeout(150);
  }
  // En el teléfono la hoja del carrito queda abierta y vacía; su velo tapa la mesa: un toque fuera.
  const hojaVacia = pagina.getByText('Aún no agregas productos').filter({ visible: true });
  if ((await hojaVacia.count()) > 0) {
    await pagina.mouse.click(8, 8);
    await hojaVacia.waitFor({ state: 'hidden', timeout: ESPERA_MS });
  }
  if (await hayAlgoEnElCarrito(pagina)) throw new Error('El carrito no quedó vacío.');
  return toques;
}

/** «Enviar a Cocina»: abre el carrito si hace falta, deja la nota general y espera el sí del servidor. */
export async function enviarACocina(pagina: Page, notaGeneral: string): Promise<void> {
  const enviar = pagina
    .getByRole('button', { name: 'Enviar a Cocina', exact: true })
    .filter({ visible: true });
  if ((await enviar.count()) === 0) {
    await pagina
      .getByRole('button', { name: /Ver pedido/ })
      .filter({ visible: true })
      .last()
      .click({ timeout: ESPERA_MS });
  }
  const nota = pagina.getByPlaceholder('Nota para cocina...');
  if (notaGeneral !== '' && (await nota.count()) > 0) await nota.last().fill(notaGeneral);
  const enviada = pagina.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/restaurante/enviar-pedido' &&
      r.request().method() === 'POST',
    { timeout: ESPERA_MS },
  );
  await enviar.last().click({ timeout: ESPERA_MS });
  const respuesta = await enviada;
  if (respuesta.status() !== 200)
    throw new Error(`enviar-pedido respondió ${String(respuesta.status())}`);
  await pagina.getByText('¡Pedido enviado a cocina!').first().waitFor({ timeout: ESPERA_MS });
}

/** ¿La mesa dice «Esperando entrega» (hay algo listo en la estación)? */
export async function hayListoParaRecoger(pagina: Page, numero: number): Promise<boolean> {
  await aLaZonaDe(pagina, numero);
  const texto = await botonDeMesa(pagina, numero).innerText({ timeout: 5_000 });
  return texto.includes('Esperando entrega');
}

/** «Marcar entregado» / «Entregar listos» hasta que no quede botón; devuelve cuántos toques hizo. */
export async function entregarListos(pagina: Page, numero: number): Promise<number> {
  await entrarALaMesa(pagina, numero);
  const mesa = dialogoDeMesa(pagina, numero);
  const botones = mesa.getByRole('button', { name: /^(Entregar listos|Marcar entregado)$/ });
  await botones.first().waitFor({ timeout: ESPERA_MS });
  let toques = 0;
  while ((await botones.count()) > 0 && toques < 10) {
    const entregada = pagina.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/restaurante/entregar-pedidos' && r.ok(),
      { timeout: ESPERA_MS },
    );
    await botones.first().click();
    await entregada;
    toques += 1;
    await pagina.waitForTimeout(600);
  }
  return toques;
}

/**
 * El botón de una opción se llama como la opción y, si cuesta, también lleva su precio («Tarro
 * helado +$15.00»): se busca por el nombre al principio, no exacto.
 */
function nombreDeOpcion(opcion: string): RegExp {
  const escapada = opcion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escapada}(\\s|$)`);
}
