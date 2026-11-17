import { expect, test } from './arnes/prueba.ts';
import { pagina, servirCalibracion, urlDe } from './arnes/calibracion/pagina.ts';

/**
 * LOS PERFILES SON LO QUE DICEN SER (DP-22). En cada aparato: tacto de verdad (puntero grueso, sin
 * ratón, `ontouchstart`, puntos de contacto), el viewport y la densidad declarados, el motor que
 * se pidió (la versión mayor del User-Agent y del propio navegador) y, en el iMin, el modo ligero.
 */

const ID = 'perfil';

test.describe('los perfiles de aparato', () => {
  test('tiene el tacto, el tamaño, la densidad y el motor que declara', async ({
    page,
    aparato,
    motor,
    browser,
  }) => {
    await servirCalibracion(
      page,
      new Map([[`/caso/${ID}/limpia`, pagina({ cuerpo: '<p>Perfil</p>' })]]),
    );
    await page.goto(urlDe(ID, 'limpia'));
    const visto = await page.evaluate(() => ({
      gruesoCualquiera: matchMedia('(any-pointer: coarse)').matches,
      gruesoPrimario: matchMedia('(pointer: coarse)').matches,
      finoCualquiera: matchMedia('(any-pointer: fine)').matches,
      sinHover: matchMedia('(any-hover: none)').matches,
      ontouchstart: 'ontouchstart' in window,
      puntos: navigator.maxTouchPoints,
      ancho: innerWidth,
      alto: innerHeight,
      densidad: devicePixelRatio,
      agente: navigator.userAgent,
      ligero: document.documentElement.hasAttribute('data-ligero'),
    }));
    process.stdout.write(
      `[perfil] ${aparato.id} · ${browser.version()} (${motor.corre}) · ${String(visto.ancho)}×${String(visto.alto)} @${String(visto.densidad)} · coarse=${String(visto.gruesoCualquiera)} fine=${String(visto.finoCualquiera)} puntos=${String(visto.puntos)}\n`,
    );

    expect(visto.gruesoCualquiera, '(any-pointer: coarse)').toBe(true);
    expect(visto.finoCualquiera, 'sin ratón: (any-pointer: fine) es falso').toBe(false);
    expect(visto.ontouchstart, "'ontouchstart' in window").toBe(true);
    expect(visto.puntos, 'navigator.maxTouchPoints').toBeGreaterThan(0);
    expect(visto.ancho, 'viewport: ancho').toBe(aparato.viewport.width);
    expect(visto.alto, 'viewport: alto').toBe(aparato.viewport.height);
    expect(visto.densidad, 'devicePixelRatio').toBe(aparato.escala);
    expect(visto.ligero, '<html data-ligero> sólo en el iMin').toBe(aparato.ligero);
    // El motor: la versión mayor del navegador que corre es la del User-Agent que declara.
    const mayorDelNavegador = browser.version().split('.')[0];
    expect(visto.agente, 'User-Agent').toContain(`Chrome/${mayorDelNavegador ?? ''}.`);
    if (aparato.motor === 'chromium-99') expect(mayorDelNavegador).toBe('99');
    if (aparato.motor === 'chromium-103') expect(mayorDelNavegador).toBe('103');
    if (motor.corre === 'electron-156') expect(mayorDelNavegador).toBe('156');
  });
});
