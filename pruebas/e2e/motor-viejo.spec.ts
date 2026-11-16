import { chromium, expect, test, type Browser, type Page } from '@playwright/test';

import {
  archivoDe,
  correrRecorrido,
  guardar,
  type Resultado,
} from './ayudantes/correr-recorrido.ts';
import { compararCapturas } from './ayudantes/dos-motores.ts';
import { desplazados, diferenciasDeEstilo } from './ayudantes/medidas-de-dos-motores.ts';
import { PARADAS } from './ayudantes/recorrido-compatible.ts';

/**
 * DP-20.1 · EL MODO COMPATIBLE, EN UN MOTOR VIEJO DE VERDAD.
 *
 * Los POS con Android 7 (el iMin D4-503) traen un WebView de Chromium 99–103 que no se actualiza.
 * La prueba anda el MISMO recorrido —login, mesero, cocina, caja (cuenta, dividir, cobro, ticket,
 * para llevar), configuración y el laboratorio— dos veces contra la misma base: en el Chrome de hoy
 * y en un Chromium viejo. Y exige, parada por parada:
 *
 *  - que el motor viejo llegue, sin un solo error de consola ni de página;
 *  - que las zonas lisas (fondos, tarjetas, velos) sean del mismo color, pixel por pixel;
 *  - que cada cosa esté en el mismo sitio —los diálogos, centrados— y nada se mueva ni se encime;
 *  - que el texto, el fondo y el borde de cada elemento sean del mismo color en los dos motores.
 *
 * Y que un motor que ni siquiera entiende las capas de CSS vea el aviso de «aparato demasiado
 * viejo», y los demás no.
 *
 * NO corre en la CI: hace falta un Chromium de 180 MB sin parches de seguridad, que sólo se usa
 * contra el servidor local. En la CI va el contrato sobre el CSS del build
 * (`pnpm verify:modo-compatible`), que es lo que impide la regresión.
 *
 * Variables: `MORPHIQPOS_CHROMIUM_VIEJO` (el ejecutable del 99 o del 103; sin ella se salta),
 * `MORPHIQPOS_CHROMIUM_SIN_CAPAS` (uno anterior al 99, para el aviso) y `MORPHIQPOS_CAPTURAS`
 * (dónde dejar las capturas de cada motor y el «lado a lado» de cada parada).
 */

const VIEJO = process.env['MORPHIQPOS_CHROMIUM_VIEJO'] ?? '';
const SIN_CAPAS = process.env['MORPHIQPOS_CHROMIUM_SIN_CAPAS'] ?? '';
const CAPTURAS = process.env['MORPHIQPOS_CAPTURAS'] ?? '';

/** Cuántos bloques lisos pueden diferir en una parada, de cada mil (lo tapado no cuenta). */
const BLOQUES_DISTINTOS_POR_MIL = 1;
const SLUG = 'prueba-restaurante';

function erroresDe(motor: string, r: Resultado): string[] {
  return [...r.errores].flatMap(([parada, lista]) =>
    lista.map((e) => `[${motor}] ${parada} · ${e}`),
  );
}

/** Compara una parada entre los dos motores; devuelve la fila del informe y lo que no cuadra. */
async function compararParada(
  herramienta: Page,
  parada: string,
  viejo: Resultado,
  moderno: Resultado,
): Promise<{ fila: string; problemas: string[] }> {
  const delViejo = viejo.paradas.get(parada);
  const delModerno = moderno.paradas.get(parada);
  if (delViejo === undefined || delModerno === undefined) {
    return {
      fila: `${parada.padEnd(26)} no llegó`,
      problemas: [`${parada}: no llegó a compararse`],
    };
  }
  const pixeles = await compararCapturas(herramienta, delViejo.captura, delModerno.captura, {
    tapar: [...delViejo.tapadas, ...delModerno.tapadas],
  });
  guardar(CAPTURAS, 'lado-a-lado', archivoDe(parada), Buffer.from(pixeles.ladoALado, 'base64'));
  const todosLosMovidos = desplazados(delViejo.medidas, delModerno.medidas);
  const movidos = todosLosMovidos.filter((m) => !m.porBotonConIcono);
  const porBoton = todosLosMovidos.length - movidos.length;
  const estilos = diferenciasDeEstilo(delViejo.medidas, delModerno.medidas);

  const problemas: string[] = [];
  const porMil = pixeles.proporcion * 1000;
  if (porMil > BLOQUES_DISTINTOS_POR_MIL) {
    const donde = pixeles.peores.map((b) => `(${String(b.x)},${String(b.y)})`).join(' ');
    problemas.push(
      `${parada}: ${String(pixeles.distintos)} bloques lisos de otro color (${porMil.toFixed(2)} ‰) en ${donde}`,
    );
  }
  for (const m of movidos.slice(0, 6)) {
    problemas.push(
      `${parada}: ${m.esDialogo ? 'DIÁLOGO' : 'elemento'} en otro sitio · ${m.camino.split('>').slice(-3).join('>')} «${m.texto}» viejo ${JSON.stringify(m.viejo)} moderno ${JSON.stringify(m.moderno)}`,
    );
  }
  for (const e of estilos.slice(0, 6)) {
    problemas.push(
      `${parada}: ${e.que} distinto · ${e.camino.split('>').slice(-3).join('>')} «${e.texto}» viejo ${e.viejo} moderno ${e.moderno}`,
    );
  }
  const fila = [
    parada.padEnd(26),
    String(viejo.errores.get(parada)?.length ?? 0).padStart(8),
    `${porMil.toFixed(2)} ‰`.padStart(12),
    String(movidos.length).padStart(9),
    String(porBoton).padStart(9),
    String(estilos.length).padStart(9),
    String(delModerno.medidas.length).padStart(11),
  ].join('');
  return { fila, problemas };
}

test.describe('el modo compatible en un motor viejo', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });
  test.skip(VIEJO === '', 'Sin MORPHIQPOS_CHROMIUM_VIEJO no hay motor viejo que probar.');

  test('el Chromium viejo llega a todas las paradas y pinta lo mismo que el Chrome de hoy', async ({
    browser,
  }, info) => {
    test.setTimeout(15 * 60_000);
    const base = String(info.project.use.baseURL);
    const moderno = await correrRecorrido('moderno', browser, base, CAPTURAS);
    const navegadorViejo = await chromium.launch({ executablePath: VIEJO, headless: true });
    let viejo: Resultado;
    let version: string;
    try {
      version = navegadorViejo.version();
      viejo = await correrRecorrido('viejo', navegadorViejo, base, CAPTURAS);
    } finally {
      await navegadorViejo.close();
    }

    const herramienta = await (await browser.newContext()).newPage();
    const filas: string[] = [];
    const problemas: string[] = [];
    for (const parada of PARADAS) {
      const comparada = await compararParada(herramienta, parada, viejo, moderno);
      filas.push(comparada.fila);
      problemas.push(...comparada.problemas);
    }
    await herramienta.context().close();

    process.stdout.write(
      [
        '',
        `Chromium ${version} contra Chrome ${browser.version()}`,
        `${'parada'.padEnd(26)}${'errores'.padStart(8)}${'lisos ≠'.padStart(12)}${'movidos'.padStart(9)}${'(botón)'.padStart(9)}${'estilos'.padStart(9)}${'elementos'.padStart(11)}`,
        ...filas,
        '',
        ...erroresDe('viejo', viejo),
        ...erroresDe('moderno', moderno),
        ...viejo.pendientes.map((p) => `[viejo] pendiente · ${p}`),
        ...problemas,
        '',
      ].join('\n'),
    );

    expect(moderno.pendientes, 'Tramos que el Chrome de hoy no pudo andar.').toEqual([]);
    expect(viejo.pendientes, 'Tramos que el Chromium viejo no pudo andar.').toEqual([]);
    expect(
      erroresDe('viejo', viejo),
      'El motor viejo tuvo errores de consola o de página.',
    ).toEqual([]);
    expect(problemas, 'El motor viejo no pinta lo mismo que el moderno.').toEqual([]);
    // «Probar compatibilidad», en el laboratorio: cada motor sabe en qué nivel trabaja.
    expect(viejo.paradas.get('laboratorio')?.nota, 'El nivel que se dice el motor viejo').toBe(
      'compatible',
    );
    expect(moderno.paradas.get('laboratorio')?.nota, 'El nivel que se dice el Chrome de hoy').toBe(
      'moderno',
    );
  });
});

/** ¿Se ve el aviso de «aparato demasiado viejo» en la entrada del POS, con este navegador? */
async function avisoALaVista(navegador: Browser, base: string): Promise<boolean> {
  const contexto = await navegador.newContext({ baseURL: base });
  try {
    const page = await contexto.newPage();
    await page.goto(`/n/${SLUG}/login-pos`);
    return await page.getByText('Este aparato es demasiado viejo para el POS.').isVisible();
  } finally {
    await contexto.close();
  }
}

test.describe('el aviso de aparato demasiado viejo', () => {
  test.skip(
    SIN_CAPAS === '',
    'Sin MORPHIQPOS_CHROMIUM_SIN_CAPAS no hay motor tan viejo que probar.',
  );

  test('lo ve un motor que no entiende las capas de CSS, y ninguno que sí', async ({
    browser,
  }, info) => {
    const base = String(info.project.use.baseURL);
    const sinCapas = await chromium.launch({ executablePath: SIN_CAPAS, headless: true });
    try {
      expect(await avisoALaVista(sinCapas, base), `Chromium ${sinCapas.version()}`).toBe(true);
    } finally {
      await sinCapas.close();
    }
    expect(await avisoALaVista(browser, base), 'El Chrome de hoy').toBe(false);
    if (VIEJO === '') return;
    const viejo = await chromium.launch({ executablePath: VIEJO, headless: true });
    try {
      expect(await avisoALaVista(viejo, base), `Chromium ${viejo.version()}`).toBe(false);
    } finally {
      await viejo.close();
    }
  });
});
