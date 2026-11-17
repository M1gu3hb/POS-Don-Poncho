import { test as base, type TestInfo } from '@playwright/test';

import { aparatoPorId, motorDe, type Aparato } from './aparatos.ts';
import { prepararContexto, sinCacheHttp } from './ligero.ts';
import type { MotorResuelto } from './motores.ts';

/**
 * EL `test` DEL QA FINAL. Todas las specs de `qa-final/` importan de aquí, no de `@playwright/test`:
 *
 *  · `aparato` — el perfil del proyecto en curso (`metadata.aparatoId` de `playwright.qa-final.config.ts`);
 *  · `motor` — el motor que de verdad corre, con su versión (para imprimirla en cada corrida);
 *  · el contexto de cada prueba ya lleva lo que la app de Android le pone a la página (`data-ligero`);
 *  · un perfil cuyo binario no existe se SALTA con su motivo, y se dice en la salida: nunca en silencio.
 */

export function aparatoDe(info: TestInfo): Aparato {
  const id: unknown = info.project.metadata['aparatoId'];
  if (typeof id !== 'string') {
    throw new Error(
      `El proyecto «${info.project.name}» no es un aparato del QA final (sin metadata.aparatoId): corre con playwright.qa-final.config.ts.`,
    );
  }
  return aparatoPorId(id);
}

export const test = base.extend<{ aparato: Aparato; motor: MotorResuelto }>({
  aparato: async ({ browserName }, usar, info) => {
    info.annotations.push({ type: 'navegador', description: browserName });
    await usar(aparatoDe(info));
  },
  // Automático: el perfil sin binario se salta ANTES de que se abra su contexto.
  motor: [
    async ({ aparato }, usar, info) => {
      const motor = motorDe(aparato);
      if (!motor.disponible) {
        process.stdout.write(`[qa-final] ${aparato.id}: ${motor.aviso ?? 'sin motor'}\n`);
        base.skip(true, motor.aviso ?? 'motor no disponible');
      }
      info.annotations.push({
        type: 'motor',
        description: `${motor.corre}${motor.version === null ? '' : ` ${motor.version}`}${motor.aviso === null ? '' : ` · ${motor.aviso}`}`,
      });
      await usar(motor);
    },
    { auto: true },
  ],
  context: async ({ context, aparato }, usar) => {
    await prepararContexto(context, aparato);
    if (aparato.familia === 'imin') await sinCacheHttp(context);
    await usar(context);
  },
});

export { expect } from '@playwright/test';

/** El servidor de la app tiene que estar contestando; si no, Playwright de otro modo lo construiría. */
export async function exigirServidor(baseURL: string | undefined): Promise<void> {
  if (baseURL === undefined) throw new Error('Sin baseURL no hay servidor que comprobar.');
  try {
    const respuesta = await fetch(baseURL, { signal: AbortSignal.timeout(10_000) });
    if (respuesta.status === 0) throw new Error('sin respuesta');
  } catch (error: unknown) {
    throw new Error(
      `El servidor ${baseURL} no contesta (${error instanceof Error ? error.message : String(error)}). Levántalo aparte con «pnpm --filter @morphiqpos/web exec next start -p <puerto>»; este config no lo construye.`,
      { cause: error },
    );
  }
}
