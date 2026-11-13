/**
 * LOS APARATOS: cada bot en su contexto de navegador con un aparato real de Don Poncho.
 * Android 360 y 412, iPhone, tableta 768/1024 y la PC 1920. Todos en Chromium (el iPhone, con su
 * tamaño y su agente; WebKit cuesta memoria y la semana corre con decenas de contextos a la vez).
 */
import { devices, type BrowserContextOptions } from '@playwright/test';

export type NombreDeAparato =
  'android-360' | 'android-412' | 'iphone' | 'tableta-768' | 'tableta-1024' | 'pc-1920';

export const APARATOS: Readonly<Record<NombreDeAparato, BrowserContextOptions>> = {
  'android-360': { ...devices['Galaxy S9+'], viewport: { width: 360, height: 740 } },
  'android-412': devices['Pixel 7'],
  iphone: devices['iPhone 14'],
  'tableta-768': { viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: false },
  'tableta-1024': { viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: false },
  'pc-1920': { viewport: { width: 1920, height: 1080 } },
};

/** Las opciones comunes: idioma y zona de CDMX, y sin permisos que nadie pidió. */
export function opcionesDe(aparato: NombreDeAparato): BrowserContextOptions {
  const base = { ...APARATOS[aparato] };
  delete (base as { defaultBrowserType?: unknown }).defaultBrowserType;
  return { ...base, locale: 'es-MX', timezoneId: 'America/Mexico_City' };
}
