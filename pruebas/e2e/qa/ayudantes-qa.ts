import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  devices,
  expect,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
  type TestInfo,
} from '@playwright/test';

import { abrirElQrDeLaMesa, type TelefonoDelComensal } from '../ayudantes/mesas-heredadas.ts';
import { cabecerasDeEscrituraDePrueba, entrar } from '../ayudantes/sesion.ts';

/**
 * QA-1 · LA JORNADA EN UNA COPIA DESECHABLE DE DON PONCHO (`morphiqpos_qa`, puerto 3210).
 *
 * Los ayudantes de `pruebas/e2e/ayudantes/` se niegan con `don-poncho` (`exigirDemostracion`: «un
 * negocio real, nunca se prueba»), y con razón: aquí la base es una COPIA que se tira. Esta jornada
 * no usa esa puerta; entra con el mismo `entrar()` de siempre (la pantalla de acceso con su tarjeta
 * y su PIN) y deja escrito qué hizo en el libro, para la bitácora.
 *
 * Los PIN de la copia (de cuatro cifras, como en producción) NO viven en el repositorio: salen de un
 * JSON FUERA de él, que apunta `QA1_PINES`. Las sesiones se guardan por persona y aparato en `pruebas/e2e/.sesiones` (ignorada
 * por git), para gastar pocas de las 20 entradas por 5 minutos que permite el servidor.
 */

export const SLUG = 'don-poncho';
/** Las de la copia (`QA1_PINES`) o un cocinero que creó la preparación («Cocina Postres QA»). */
export type Persona = string;
export type Aparato = 'pc' | 'tableta' | 'telefono';

const CARPETA = join('pruebas', 'e2e', '.sesiones');
const LIBRO = join(CARPETA, 'qa1-libro.jsonl');
const ESTADO = join(CARPETA, 'qa1-estado.json');

const DISPOSITIVO: Readonly<Record<Aparato, BrowserContextOptions>> = {
  pc: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
  tableta: { ...devices['Galaxy Tab S4 landscape'], viewport: { width: 1280, height: 800 } },
  telefono: { ...devices['Pixel 7'] },
};

/** El PIN de prueba de la copia (sale del JSON externo; nunca del repositorio). */
export function pinDe(persona: string): string {
  const ruta = process.env['QA1_PINES'];
  if (ruta === undefined || ruta === '') throw new Error('Falta QA1_PINES (JSON fuera del repo).');
  const pines = JSON.parse(readFileSync(ruta, 'utf8')) as Record<string, string>;
  const pin = pines[persona];
  if (pin === undefined) throw new Error(`QA1_PINES no trae a «${persona}».`);
  return pin;
}

function opciones(info: TestInfo, aparato: Aparato): BrowserContextOptions {
  const uso = info.project.use;
  return {
    ...DISPOSITIVO[aparato],
    ...(uso.baseURL === undefined ? {} : { baseURL: uso.baseURL }),
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
    acceptDownloads: true,
  };
}

/** La voz que el aparato diría, espiada en `window.__voz` (nadie la oye: sin tarjeta de audio). */
async function espiarLaVoz(contexto: BrowserContext): Promise<void> {
  await contexto.addInitScript(() => {
    const dicho: string[] = [];
    Object.defineProperty(window, '__voz', { value: dicho });
    window.speechSynthesis.speak = (frase: SpeechSynthesisUtterance) => {
      dicho.push(frase.text);
      setTimeout(() => {
        frase.dispatchEvent(new Event('end'));
      }, 20);
    };
  });
}

export const loQueDijo = (page: Page): Promise<readonly string[]> =>
  page.evaluate(() => [...((window as unknown as { __voz?: string[] }).__voz ?? [])]);

export const ultimoSonido = (page: Page): Promise<string | null> =>
  page.evaluate(() => document.documentElement.getAttribute('data-ultimo-sonido'));

/** Un navegador por persona y aparato, con su sesión guardada mientras el servidor la reconozca. */
export class Jornada {
  readonly #abiertos = new Map<string, BrowserContext>();
  readonly #telefonos: TelefonoDelComensal[] = [];

  constructor(
    readonly browser: Browser,
    readonly info: TestInfo,
  ) {}

  async pagina(persona: Persona, aparato: Aparato = 'pc'): Promise<Page> {
    const clave = `${aparato}-${persona}`;
    let contexto = this.#abiertos.get(clave);
    if (contexto === undefined) {
      contexto = await this.#abrir(persona, aparato, clave);
      this.#abiertos.set(clave, contexto);
    }
    const abiertas = contexto.pages();
    const pagina = abiertas[0] ?? (await contexto.newPage());
    pagina.setDefaultTimeout(20_000);
    pagina.setDefaultNavigationTimeout(30_000);
    return pagina;
  }

  async #abrir(persona: Persona, aparato: Aparato, clave: string): Promise<BrowserContext> {
    mkdirSync(CARPETA, { recursive: true });
    const limpio = clave.normalize('NFD').replace(/[^A-Za-z0-9-]/g, '');
    const archivo = join(CARPETA, `qa1-${limpio}.json`);
    const base = opciones(this.info, aparato);
    if (existsSync(archivo)) {
      const guardado = await this.browser.newContext({ ...base, storageState: archivo });
      const viva = await guardado.request.get('/api/catalogo/sesion');
      if (viva.status() === 200) {
        await espiarLaVoz(guardado);
        return guardado;
      }
      await guardado.close();
    }
    const nuevo = await this.browser.newContext({
      ...base,
      ...(existsSync(archivo) ? { storageState: archivo } : {}),
    });
    // La pantalla de acceso de verdad: tarjeta de la persona y PIN de cuatro cifras en su teclado.
    const entrada = await nuevo.newPage();
    await entrar(entrada, { slug: SLUG, nombre: persona, pin: pinDe(persona) });
    await entrada.close();
    await nuevo.storageState({ path: archivo });
    await espiarLaVoz(nuevo);
    return nuevo;
  }

  /** Otro teléfono de comensal (sin sesión) que abre el QR de la mesa. */
  async comensal(token: string): Promise<Page> {
    const telefono = await abrirElQrDeLaMesa(this.browser, this.info, SLUG, token);
    this.#telefonos.push(telefono);
    telefono.page.setDefaultTimeout(20_000);
    telefono.page.on('response', (r) => {
      if (r.status() !== 429) return;
      anotar({
        aparato: 'telefono',
        quien: 'comensal',
        accion: '429 del portal',
        detalle: `${r.request().method()} ${new URL(r.url()).pathname}`,
      });
    });
    return telefono.page;
  }

  async cerrar(): Promise<void> {
    for (const t of this.#telefonos) await t.cerrar();
    for (const c of this.#abiertos.values()) await c.close();
    this.#abiertos.clear();
    this.#telefonos.length = 0;
  }
}

// ═══ EL LIBRO: lo que se hizo, con su hora, quién, dónde y lo que debería verse ═══

export interface Asiento {
  readonly aparato: Aparato | 'servidor';
  readonly quien: string;
  readonly accion: string;
  readonly detalle?: string;
  /** Lo que el sistema DEBERÍA mostrar después. */
  readonly esperado?: string;
  /** Datos de dinero/almacén que la tabla final suma. */
  readonly datos?: Readonly<Record<string, string | number | null>>;
}

const hora = (): string =>
  new Date().toLocaleTimeString('es-MX', { hour12: false, timeZone: 'America/Mexico_City' });

export function anotar(asiento: Asiento): void {
  mkdirSync(CARPETA, { recursive: true });
  appendFileSync(LIBRO, `${JSON.stringify({ hora: hora(), ...asiento })}\n`);
}

/** Lo anotado hasta ahora (una línea por asiento). */
export function leerLibro(): readonly (Asiento & { readonly hora: string })[] {
  if (!existsSync(LIBRO)) return [];
  return readFileSync(LIBRO, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as Asiento & { hora: string });
}

export function leerEstado(): Record<string, unknown> {
  return existsSync(ESTADO)
    ? (JSON.parse(readFileSync(ESTADO, 'utf8')) as Record<string, unknown>)
    : {};
}

export function guardarEstado(parcial: Readonly<Record<string, unknown>>): void {
  mkdirSync(CARPETA, { recursive: true });
  writeFileSync(ESTADO, JSON.stringify({ ...leerEstado(), ...parcial }, null, 2));
}

// ═══ ESCRIBIR Y LEER POR LA API, con la sesión de la persona ═══

export async function escribir(
  pagina: Page,
  ruta: string,
  datos: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const respuesta = await pagina.request.post(ruta, {
    headers: cabecerasDeEscrituraDePrueba(),
    data: datos,
  });
  const texto = await respuesta.text();
  expect(respuesta.status(), `${ruta}: ${texto.slice(0, 400)}`).toBe(200);
  const cuerpo = JSON.parse(texto) as { readonly datos?: Record<string, unknown> };
  return cuerpo.datos ?? {};
}

export async function leer(
  pagina: Page,
  ruta: string,
  datos: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  return escribir(pagina, ruta, datos);
}

/** La sesión de caja de la terminal de esta pestaña, o `null` si no hay caja abierta. */
export async function sesionDeLaCaja(pagina: Page): Promise<string | null> {
  const datos = await leer(pagina, '/api/caja/estado', {});
  return datos['abierta'] === true ? String(datos['sesionCajaId']) : null;
}

/** Lo que el servidor dice que debería haber en el cajón de esta terminal ahora (centavos). */
export async function esperadoDelCajon(pagina: Page): Promise<number> {
  const datos = await leer(pagina, '/api/caja/estado', { efectivoContadoCentavos: 0 });
  return Number(datos['efectivoEsperadoCentavos']);
}

export const pesos = (centavos: number): string => (centavos / 100).toFixed(2);
export const dinero = (centavos: number): string =>
  `$${(centavos / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
