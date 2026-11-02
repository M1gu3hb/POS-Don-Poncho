import type { Locator, Page, TestInfo } from '@playwright/test';

/**
 * EL DEDO EN LAS PRUEBAS DE NAVEGADOR (DP-12.3): tacto de verdad por CDP donde el proyecto tiene
 * tacto (tableta, teléfono) y el ratón en la PC. Arrastrar mide, cuadro por cuadro, cuánto se
 * separa lo arrastrado del dedo; mantener presionada es el gesto del globo de la mesa.
 */

/** El centro en la pantalla. El temblor gira la mesa sobre su centro: el centro no se mueve. */
export async function centro(objetivo: Locator): Promise<{ x: number; y: number }> {
  const caja = await objetivo.boundingBox();
  if (caja === null) throw new Error('La mesa no está a la vista.');
  return { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 };
}

/** Puntos de la pantalla por punto del plano: el ancho de la mesa (sin el giro) entre el suyo. */
export const escalaDe = async (objetivo: Locator, anchoEnElPlano: number): Promise<number> =>
  (await objetivo.evaluate((nodo) => (nodo as HTMLElement).offsetWidth)) / anchoEnElPlano;

const dosCuadros = (pagina: Page): Promise<void> =>
  pagina.evaluate(
    () =>
      new Promise<void>((listo) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            listo();
          });
        });
      }),
  );

export interface Dedo {
  bajar(x: number, y: number): Promise<void>;
  mover(x: number, y: number): Promise<void>;
  subir(): Promise<void>;
}

/** El dedo de verdad (eventos de tacto por CDP) donde hay tacto; el ratón en la PC. */
export async function dedoDe(pagina: Page, info: TestInfo): Promise<Dedo> {
  if (info.project.use.hasTouch !== true) {
    return {
      bajar: async (x, y) => {
        await pagina.mouse.move(x, y);
        await pagina.mouse.down();
      },
      mover: (x, y) => pagina.mouse.move(x, y),
      subir: () => pagina.mouse.up(),
    };
  }
  const cdp = await pagina.context().newCDPSession(pagina);
  const tocar = async (type: 'touchStart' | 'touchMove', x: number, y: number) => {
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [{ x, y }] });
  };
  return {
    bajar: (x, y) => tocar('touchStart', x, y),
    mover: (x, y) => tocar('touchMove', x, y),
    subir: async () => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
    },
  };
}

/**
 * Arrastra la mesa (dx, dy) puntos del plano, de 8 en 8 píxeles. En cada cuadro mide cuánto se
 * separa el centro de la mesa del dedo: es el «1:1». `alCuadro` mira lo demás (la vecina).
 */
export async function arrastrar(
  pagina: Page,
  info: TestInfo,
  laMesa: Locator,
  hacia: { readonly dx: number; readonly dy: number; readonly escala: number },
  alCuadro?: () => Promise<void>,
): Promise<number> {
  const inicio = await centro(laMesa);
  const [dx, dy] = [hacia.dx * hacia.escala, hacia.dy * hacia.escala];
  const pasos = Math.max(3, Math.round(Math.hypot(dx, dy) / 8));
  const dedo = await dedoDe(pagina, info);
  await dedo.bajar(inicio.x, inicio.y);
  let peor = 0;
  for (let paso = 1; paso <= pasos; paso += 1) {
    const [x, y] = [inicio.x + (dx * paso) / pasos, inicio.y + (dy * paso) / pasos];
    await dedo.mover(x, y);
    await dosCuadros(pagina);
    const ahora = await centro(laMesa);
    peor = Math.max(peor, Math.hypot(ahora.x - x, ahora.y - y));
    if (alCuadro !== undefined) await alCuadro();
  }
  await dedo.subir();
  return peor;
}

/** Mantener presionada con el dedo (700 ms, tacto real) o, con ratón, el clic derecho. */
export async function mantenerPresionada(pagina: Page, info: TestInfo, objetivo: Locator) {
  const { x, y } = await centro(objetivo);
  if (info.project.use.hasTouch !== true) {
    await pagina.mouse.click(x, y, { button: 'right' });
    return;
  }
  const dedo = await dedoDe(pagina, info);
  await dedo.bajar(x, y);
  // Es el gesto mismo, no una espera de algo: el dedo se queda sobre la mesa.
  await pagina.waitForTimeout(700);
  await dedo.subir();
}
