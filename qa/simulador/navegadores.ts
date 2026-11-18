/**
 * LOS NAVEGADORES DEL DÍA DE BOTS (DP-22): uno por MOTOR. Las PC con Windows corren en el Chrome 156
 * de Electron, el iMin en el Chromium 99 de su WebView y los teléfonos y tabletas en el Chromium de
 * Playwright. Cada navegador se abre la primera vez que un aparato lo pide, con el candado de siempre
 * (sólo contra localhost: el servidor y la base ya pasaron por `exigirCopiaLocal`).
 *
 * Lo que NO se esconde: si el Chrome 156 no existe, el perfil cae al Chromium de Playwright y el
 * informe lo DICE (`avisos()`); si el Chromium 99 no existe, el aparato no corre (se lanza con el
 * motivo) en vez de aparentar que corre en otro motor.
 */
import { chromium, type Browser } from '@playwright/test';

import { navegadorDe } from '../../pruebas/e2e/qa-final/arnes/ligero.ts';
import { aparatoPorId, motorDe, type Aparato } from '../../pruebas/e2e/qa-final/arnes/aparatos.ts';
import type { MotorId, MotorResuelto } from '../../pruebas/e2e/qa-final/arnes/motores.ts';

import { esDelArnes, type NombreDeAparato } from './aparatos.ts';

export interface Navegadores {
  /** El navegador que corresponde al aparato (el del iMin, ya con el caché HTTP apagado). */
  de(aparato: NombreDeAparato): Promise<Browser>;
  /** El motor con que corre cada aparato del arnés que se pidió (para el informe). */
  motores(): readonly { readonly aparato: string; readonly motor: MotorResuelto }[];
  /** Avisos que el informe tiene que decir (un motor sustituido, por ejemplo). */
  avisos(): readonly string[];
  cerrar(): Promise<void>;
}

export function crearNavegadores(porOmision: Browser): Navegadores {
  const abiertos = new Map<MotorId, Promise<Browser>>();
  const pedidos = new Map<string, MotorResuelto>();
  const abrir = (aparato: Aparato, motor: MotorResuelto): Promise<Browser> => {
    const guardado = abiertos.get(aparato.motor);
    if (guardado !== undefined) return guardado;
    const nuevo =
      motor.ejecutable === undefined
        ? Promise.resolve(porOmision)
        : chromium.launch({ executablePath: motor.ejecutable, args: ['--disable-gpu'] });
    abiertos.set(aparato.motor, nuevo);
    return nuevo;
  };
  return {
    async de(nombre) {
      if (!esDelArnes(nombre)) return porOmision;
      const aparato = aparatoPorId(nombre);
      const motor = motorDe(aparato);
      pedidos.set(nombre, motor);
      if (!motor.disponible) throw new Error(`${nombre}: ${motor.aviso ?? 'motor no disponible'}`);
      return navegadorDe(await abrir(aparato, motor), aparato);
    },
    motores: () => [...pedidos].map(([aparato, motor]) => ({ aparato, motor })),
    avisos: () => [
      ...new Set([...pedidos.values()].flatMap((m) => (m.aviso === null ? [] : [m.aviso]))),
    ],
    async cerrar() {
      for (const promesa of abiertos.values()) {
        const navegador = await promesa.catch(() => null);
        if (navegador !== null && navegador !== porOmision) await navegador.close();
      }
      abiertos.clear();
    },
  };
}
