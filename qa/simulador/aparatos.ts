/**
 * LOS APARATOS: cada bot en su contexto de navegador con un aparato real de Don Poncho.
 * Android 360 y 412, iPhone, tableta 768/1024 y la PC 1920. Todos en Chromium (el iPhone, con su
 * tamaño y su agente; WebKit cuesta memoria y la semana corre con decenas de contextos a la vez).
 *
 * DP-22 · El día de bots usa además los perfiles TÁCTILES del arnés fiel (`pruebas/e2e/qa-final/arnes`):
 * la Caja en Windows 1366×768 al 125 %, el mesero en teléfono y en tableta vertical, la Cocina en el
 * iMin (Chromium 99, modo ligero) y el dueño en Windows 1920×1080. Su nombre es el id del arnés.
 */
import { devices, type BrowserContextOptions } from '@playwright/test';

import {
  aparatoPorId,
  motorDe,
  opcionesDeContexto,
  type Aparato,
} from '../../pruebas/e2e/qa-final/arnes/aparatos.ts';
import type { MotorResuelto } from '../../pruebas/e2e/qa-final/arnes/motores.ts';

/** Los aparatos de la semana de 45: no son táctiles de verdad salvo las tabletas. */
export type AparatoDeLaSemana =
  'android-360' | 'android-412' | 'iphone' | 'tableta-768' | 'tableta-1024' | 'pc-1920';

/** Los perfiles táctiles del arnés que usa el día de bots (ids de `arnes/aparatos.ts`). */
export type AparatoDelArnes =
  | 'win-1366x768-125'
  | 'win-1920x1080-100'
  | 'telefono-360x800'
  | 'telefono-390x844'
  | 'tableta-800x1280'
  | 'imin-1920x1080-c99';

export type NombreDeAparato = AparatoDeLaSemana | AparatoDelArnes;

export const APARATOS_DEL_ARNES: readonly AparatoDelArnes[] = [
  'win-1366x768-125',
  'win-1920x1080-100',
  'telefono-360x800',
  'telefono-390x844',
  'tableta-800x1280',
  'imin-1920x1080-c99',
];

export function esDelArnes(aparato: NombreDeAparato): aparato is AparatoDelArnes {
  return (APARATOS_DEL_ARNES as readonly string[]).includes(aparato);
}

export const APARATOS: Readonly<Record<AparatoDeLaSemana, BrowserContextOptions>> = {
  'android-360': { ...devices['Galaxy S9+'], viewport: { width: 360, height: 740 } },
  'android-412': devices['Pixel 7'],
  iphone: devices['iPhone 14'],
  'tableta-768': { viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: false },
  'tableta-1024': { viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: false },
  'pc-1920': { viewport: { width: 1920, height: 1080 } },
};

/** El perfil del arnés de un aparato del día de bots. */
export function perfilDelArnes(aparato: AparatoDelArnes): Aparato {
  return aparatoPorId(aparato);
}

/** El motor (Chrome 156, Chromium 99, Chromium de Playwright…) con que corre un aparato del arnés. */
export function motorDelAparato(aparato: AparatoDelArnes): MotorResuelto {
  return motorDe(aparatoPorId(aparato));
}

/** Las opciones comunes: idioma y zona de CDMX, y sin permisos que nadie pidió. */
export function opcionesDe(aparato: NombreDeAparato): BrowserContextOptions {
  const comunes = { locale: 'es-MX', timezoneId: 'America/Mexico_City' } as const;
  if (esDelArnes(aparato)) {
    const perfil = aparatoPorId(aparato);
    return { ...opcionesDeContexto(perfil, motorDe(perfil)), ...comunes };
  }
  const base = { ...APARATOS[aparato] };
  delete (base as { defaultBrowserType?: unknown }).defaultBrowserType;
  return { ...base, ...comunes };
}
