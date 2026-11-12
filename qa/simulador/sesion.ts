/**
 * LA SESIÓN DE CADA PERSONA: entrar con PIN, salir, cambiar de persona en el mismo aparato,
 * despertar el modo espera y reconocer una sesión vencida (para volver a entrar).
 *
 * Todo por las pantallas de verdad: la lista de personas, su tarjeta y el teclado de cuatro
 * dígitos. El PIN sale de `pinVigente(entorno, persona)` (el archivo de PIN de prueba, fuera del
 * repo, releído: el día 0 crea personas después de arrancar) y nunca se imprime: los errores dicen
 * «la persona», jamás el PIN.
 *
 * También abre el navegador y los contextos (con el aparato, el reloj de QA y la vigilancia de
 * consola y red) y deja puesto el «despertador» del modo espera, que se traga los clics.
 */
import { readFileSync } from 'node:fs';

import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';

import { opcionesDe, type NombreDeAparato } from './aparatos.ts';
import { pinVigente, type Entorno } from './entorno.ts';
import { vigilar } from './incidentes.ts';
import { guionDelNavegador, parametrosValidos } from './reloj/formula.ts';

/** Segundos que se le da a una pantalla antes de darla por perdida (la máquina de QA es lenta). */
const ESPERA_MS = 60_000;
const SLUG = 'don-poncho';

export type ResultadoDeEntrada = 'entro' | 'pin_rechazado' | 'bloqueado';

function esLaPantallaDeAcceso(pagina: Page): boolean {
  return new URL(pagina.url()).pathname.endsWith('/login-pos');
}

/** ¿La sesión de esta página ya no vale? (Nos mandaron a la pantalla de acceso o el servidor la rechaza.) */
export async function sesionVencida(pagina: Page, entorno: Entorno): Promise<boolean> {
  if (pagina.isClosed()) return false;
  if (esLaPantallaDeAcceso(pagina)) return true;
  const respuesta = await pagina
    .context()
    .request.get(`${entorno.appUrl}/api/catalogo/sesion`, { timeout: ESPERA_MS });
  return respuesta.status() === 401 || respuesta.status() === 403;
}

/** Toca la tarjeta de la persona y teclea su PIN en la pantalla de acceso que ya está abierta. */
async function tocarTarjetaYTeclear(
  pagina: Page,
  entorno: Entorno,
  persona: string,
): Promise<ResultadoDeEntrada> {
  const tarjeta = pagina.getByRole('button').filter({
    has: pagina.locator('p:first-child', {
      hasText: new RegExp(`^${persona.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
    }),
  });
  await tarjeta.first().click({ timeout: ESPERA_MS });
  const delPin = pagina.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/auth/entrar' && r.request().method() === 'POST',
    { timeout: ESPERA_MS },
  );
  for (const digito of pinVigente(entorno, persona)) {
    await pagina.getByRole('button', { name: digito, exact: true }).click({ timeout: ESPERA_MS });
  }
  const estado = (await delPin).status();
  if (estado === 200) {
    await pagina.waitForURL((u) => !u.pathname.endsWith('/login-pos'), {
      timeout: ESPERA_MS,
      waitUntil: 'commit',
    });
    return 'entro';
  }
  return estado === 423 || estado === 429 ? 'bloqueado' : 'pin_rechazado';
}

/** Entra con el PIN de prueba de la persona, por la pantalla de acceso, y espera su pantalla de inicio. */
export async function entrarConPin(
  pagina: Page,
  entorno: Entorno,
  persona: string,
): Promise<ResultadoDeEntrada> {
  await pagina.goto(`${entorno.appUrl}/n/${SLUG}/login-pos`, {
    waitUntil: 'domcontentloaded',
    timeout: ESPERA_MS,
  });
  return tocarTarjetaYTeclear(pagina, entorno, persona);
}

/** Lo mismo, pero lanza si no entró: para los bots que no tienen nada que hacer sin sesión. */
export async function entrarOFallar(
  pagina: Page,
  entorno: Entorno,
  persona: string,
): Promise<void> {
  const resultado = await entrarConPin(pagina, entorno, persona);
  if (resultado !== 'entro') throw new Error(`«${persona}» no pudo entrar (${resultado}).`);
}

/** Sale con el botón «Salir» del menú (en el teléfono, abriendo antes el menú). */
export async function salir(pagina: Page): Promise<void> {
  const salirBtn = pagina.getByRole('button', { name: 'Salir', exact: true });
  if (!(await salirBtn.isVisible())) {
    const menu = pagina.getByRole('button', { name: 'Abrir menú' });
    if (await menu.isVisible()) await menu.click({ timeout: ESPERA_MS });
  }
  await salirBtn.click({ timeout: ESPERA_MS });
  await pagina.waitForURL((u) => u.pathname.endsWith('/login-pos'), {
    timeout: ESPERA_MS,
    waitUntil: 'commit',
  });
}

/** ¿Está el modo espera tapando la pantalla? */
export async function enModoEspera(pagina: Page): Promise<boolean> {
  return pagina.getByRole('dialog', { name: /Modo espera/ }).isVisible();
}

/**
 * Despierta el modo espera (se traga los clics: hay que despertarlo ANTES de actuar). Si al despertar
 * pide el PIN de quien estaba, lo teclea. Devuelve si hubo algo que despertar.
 */
export async function despertar(pagina: Page, entorno: Entorno, persona: string): Promise<boolean> {
  const espera = pagina.getByRole('dialog', { name: /Modo espera/ });
  const pidePin = pagina.getByRole('dialog', { name: /Escribe tu PIN/ });
  if (!(await espera.isVisible()) && !(await pidePin.isVisible())) return false;
  if (await espera.isVisible()) await espera.click({ timeout: ESPERA_MS });
  if (await pidePin.isVisible({ timeout: 3_000 }).catch(() => false)) {
    for (const digito of pinVigente(entorno, persona)) {
      await pidePin
        .getByRole('button', { name: digito, exact: true })
        .click({ timeout: ESPERA_MS });
    }
  }
  await espera.waitFor({ state: 'hidden', timeout: ESPERA_MS });
  return true;
}

/**
 * Cambia de persona en el mismo aparato. Si el aparato está pidiendo el PIN al despertar usa
 * «Cambiar de persona»; si no, sale por el menú y entra otra vez con la otra tarjeta.
 */
export async function cambiarDePersona(
  pagina: Page,
  entorno: Entorno,
  persona: string,
): Promise<ResultadoDeEntrada> {
  const cambiar = pagina.getByRole('button', { name: 'Cambiar de persona' });
  if (await cambiar.isVisible()) {
    await cambiar.click({ timeout: ESPERA_MS });
    await pagina.waitForURL((u) => u.pathname.endsWith('/login-pos'), {
      timeout: ESPERA_MS,
      waitUntil: 'commit',
    });
  } else {
    await salir(pagina);
  }
  return tocarTarjetaYTeclear(pagina, entorno, persona);
}

/** Si la sesión venció, vuelve a entrar y lo dice (para que el bot anote «sesión vencida» como lo que es). */
export async function asegurarSesion(
  pagina: Page,
  entorno: Entorno,
  persona: string,
): Promise<'vigente' | 'reentro'> {
  if (!(await sesionVencida(pagina, entorno))) return 'vigente';
  await entrarOFallar(pagina, entorno, persona);
  return 'reentro';
}

// --- El navegador, los contextos y el despertador del modo espera (de los bots de caja y gerencia) ---

/** Lo que se espera a una acción de los bots de caja y gerencia antes de darla por perdida. */
export const LIMITE_MS = 45_000;

export async function abrirNavegador(): Promise<Browser> {
  return chromium.launch({ args: ['--disable-gpu'] });
}

/** Un contexto con el aparato, el reloj de QA inyectado y la vigilancia de consola y red. */
export async function contextoDe(
  navegador: Browser,
  entorno: Entorno,
  aparato: NombreDeAparato,
): Promise<{ contexto: BrowserContext; pagina: Page }> {
  const contexto = await navegador.newContext({
    ...opcionesDe(aparato),
    baseURL: entorno.appUrl,
    acceptDownloads: true,
  });
  const reloj = parametrosValidos(JSON.parse(readFileSync(entorno.archivoReloj, 'utf8')));
  if (reloj !== null) await contexto.addInitScript(guionDelNavegador(reloj));
  const pagina = await contexto.newPage();
  pagina.setDefaultTimeout(LIMITE_MS);
  pagina.setDefaultNavigationTimeout(60_000);
  vigilar(pagina);
  return { contexto, pagina };
}

const quienEs = new WeakMap<Page, string>();
const conDespertador = new WeakSet<Page>();

/**
 * El modo espera se traga los clics. Con el reloj simulado (×6) la inactividad llega pronto: en
 * cuanto la capa aparece, se toca para volver (y, si pide el PIN, se teclea el de quien está
 * entrado). Playwright corre este manejador solo, antes de cada acción que la capa estorbaría.
 */
function vigilarElModoEspera(pagina: Page, entorno: Entorno): void {
  const capa = pagina.getByRole('dialog', { name: /Modo espera/ });
  void pagina.addLocatorHandler(capa, async () => {
    // El primer toque arranca el clip de despertar (≈3 s); el segundo lo salta. Si la capa ya se
    // fue entre los dos toques, el segundo no encuentra nada que tocar, y eso está bien.
    for (let toque = 0; toque < 2; toque += 1) {
      if (!(await capa.isVisible())) break;
      await capa.click({ timeout: 5_000 });
    }
    const pidePin = pagina.getByRole('dialog', { name: /Escribe tu PIN/ });
    const persona = quienEs.get(pagina);
    if (persona !== undefined && (await pidePin.isVisible())) {
      for (const digito of pinVigente(entorno, persona)) {
        await pidePin.getByRole('button', { name: digito, exact: true }).click();
      }
    }
  });
}

/** Instala (una sola vez por página) el manejador que despierta el modo espera. */
export function activarElDespertador(pagina: Page, entorno: Entorno, persona: string): void {
  quienEs.set(pagina, persona);
  if (conDespertador.has(pagina)) return;
  conDespertador.add(pagina);
  vigilarElModoEspera(pagina, entorno);
}

/** Entra como `persona` con el despertador puesto; lanza si el servidor no la deja entrar. */
export async function entrarConDespertador(
  pagina: Page,
  entorno: Entorno,
  persona: string,
): Promise<void> {
  activarElDespertador(pagina, entorno, persona);
  await entrarOFallar(pagina, entorno, persona);
}

/** Un contexto ya con la sesión de `persona` abierta y el despertador puesto. */
export async function sesionDe(
  navegador: Browser,
  entorno: Entorno,
  persona: string,
  aparato: NombreDeAparato,
): Promise<{ contexto: BrowserContext; pagina: Page }> {
  const c = await contextoDe(navegador, entorno, aparato);
  await entrarConDespertador(c.pagina, entorno, persona);
  return c;
}
