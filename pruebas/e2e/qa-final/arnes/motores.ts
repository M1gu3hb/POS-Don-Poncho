import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * LOS MOTORES DEL ARNÉS DE QA FINAL (DP-22).
 *
 * Los POS de verdad corren en dos motores que Playwright no trae:
 *
 *  · Electron 45.3.2 (las cuatro PC con Windows 10) = Chrome 156. Playwright 1.63 trae Chromium 153:
 *    no es la misma versión mayor. Se usa Chrome for Testing del hito 156 en
 *    `MORPHIQPOS_CHROMIUM_ELECTRON` (el `chrome.exe`). Si no está, el perfil cae al Chromium de
 *    Playwright y DICE que lo hizo (aviso en la salida de la corrida y en el informe): nunca en silencio.
 *  · El WebView del iMin D4-503 (Android 7.1.2) = Chromium 99 a 103 sin actualizar. Están en
 *    `MORPHIQPOS_CHROMIUM_VIEJO/<99|103>/chrome-win/chrome.exe`. Si falta el binario, el perfil se
 *    SALTA con un mensaje explícito.
 *
 * Las tabletas y los teléfonos corren en el Chromium de Playwright.
 */

export type MotorId = 'electron-156' | 'chromium-99' | 'chromium-103' | 'playwright';

export interface MotorResuelto {
  readonly id: MotorId;
  /** Lo que de verdad va a correr (puede ser distinto del pedido, y entonces `aviso` lo dice). */
  readonly corre: MotorId;
  /** El ejecutable; `undefined` = el Chromium que trae Playwright. */
  readonly ejecutable: string | undefined;
  /** La versión completa leída del `.manifest` del binario, sin ejecutarlo. */
  readonly version: string | null;
  /** `false` = el perfil se salta (`aviso` es el porqué). */
  readonly disponible: boolean;
  readonly aviso: string | null;
}

const RUTA_ELECTRON_POR_OMISION = 'D:/mpos-tmp/chromium-electron/156/chrome-win64/chrome.exe';

/** `chrome-win/99.0.4844.0.manifest` dice la versión sin tener que arrancar el navegador. */
export function versionDelBinario(ejecutable: string): string | null {
  try {
    const manifiesto = readdirSync(dirname(ejecutable)).find((f) =>
      /^\d+\.\d+\.\d+\.\d+\.manifest$/.test(f),
    );
    return manifiesto === undefined ? null : manifiesto.replace(/\.manifest$/, '');
  } catch (error: unknown) {
    process.stderr.write(
      `[qa-final] no se pudo leer la versión de ${ejecutable}: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return null;
  }
}

function delViejo(id: 'chromium-99' | 'chromium-103'): MotorResuelto {
  const carpeta = process.env['MORPHIQPOS_CHROMIUM_VIEJO'] ?? '';
  const numero = id === 'chromium-99' ? '99' : '103';
  const ejecutable = join(carpeta, numero, 'chrome-win', 'chrome.exe');
  if (carpeta === '' || !existsSync(ejecutable)) {
    return {
      id,
      corre: id,
      ejecutable: undefined,
      version: null,
      disponible: false,
      aviso:
        carpeta === ''
          ? `SALTADO: falta MORPHIQPOS_CHROMIUM_VIEJO (carpeta con ${numero}/chrome-win/chrome.exe).`
          : `SALTADO: no existe ${ejecutable}.`,
    };
  }
  return {
    id,
    corre: id,
    ejecutable,
    version: versionDelBinario(ejecutable),
    disponible: true,
    aviso: null,
  };
}

function delElectron(): MotorResuelto {
  const pedido = process.env['MORPHIQPOS_CHROMIUM_ELECTRON'] ?? '';
  const ejecutable = pedido === '' ? RUTA_ELECTRON_POR_OMISION : pedido;
  if (existsSync(ejecutable)) {
    return {
      id: 'electron-156',
      corre: 'electron-156',
      ejecutable,
      version: versionDelBinario(ejecutable),
      disponible: true,
      aviso: null,
    };
  }
  return {
    id: 'electron-156',
    corre: 'playwright',
    ejecutable: undefined,
    version: null,
    disponible: true,
    aviso: `SUSTITUIDO: no existe ${ejecutable}; las PC con Windows corren en el Chromium de Playwright (153), NO en el Chrome 156 de Electron.`,
  };
}

export function resolverMotor(id: MotorId): MotorResuelto {
  switch (id) {
    case 'electron-156':
      return delElectron();
    case 'chromium-99':
    case 'chromium-103':
      return delViejo(id);
    case 'playwright':
      return {
        id,
        corre: 'playwright',
        ejecutable: undefined,
        version: null,
        disponible: true,
        aviso: null,
      };
  }
}
