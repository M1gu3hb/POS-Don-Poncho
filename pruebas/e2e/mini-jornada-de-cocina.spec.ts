import { randomInt } from 'node:crypto';

import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

import {
  categoriaA,
  cocineroDe,
  crearEstacion,
  laEstacion,
  platilloDe,
} from './ayudantes/estaciones.ts';
import { escribir } from './ayudantes/modo-espera.ts';
import { Equipo, opcionesDelProyecto } from './ayudantes/roles.ts';
import {
  cabecerasDeEscrituraDePrueba,
  consultarPuente,
  entrar,
  exigirDemostracion,
  vigilarFallos,
} from './ayudantes/sesion.ts';

/**
 * DP-24 · MINI JORNADA DE COCINA CON BOTS: 10 mesas y 2 estaciones, platillos que terminan en
 * distinto orden.
 *
 * Dos meseros (Lupita y un segundo) abren cinco mesas cada uno y mandan por cada mesa dos platillos
 * de la Parrilla y uno de la Barra. Las dos cocinas, cada una en su navegador con dedo, sacan los
 * 30 platillos en un orden REVUELTO (siempre el mismo: la semilla es fija), de una mesa a otra.
 *
 * Al final, contra el SERVIDOR y las pantallas:
 *   · cada mesa quedó con sus tres platillos, ninguno perdido ni duplicado, y todo «listo»;
 *   · cada mesero recibe los avisos de SUS mesas y de ninguna otra, y la dueña no recibe ninguno;
 *   · los avisos en pantalla de cada mesero son sólo de sus mesas;
 *   · entregar una mesa la saca de los avisos y deja la mesa «ocupada».
 */

const SLUG = 'prueba-restaurante';
const MESAS = 10;
const N = String(randomInt(100, 1000));
const PARRILLA = `Parrilla ${N}`;

/** Un generador con semilla: el orden «revuelto» es siempre el mismo. */
function semilla(valor: number): () => number {
  let estado = valor;
  return () => {
    estado = (estado * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return estado / 4_294_967_296;
  };
}

function revolver<T>(lista: readonly T[], azar: () => number): T[] {
  const salida = [...lista];
  for (let i = salida.length - 1; i > 0; i -= 1) {
    const j = Math.floor(azar() * (i + 1));
    [salida[i], salida[j]] = [salida[j] as T, salida[i] as T];
  }
  return salida;
}

interface Platillo {
  readonly id?: string;
  readonly producto_nombre?: string | null;
  readonly estado?: string | null;
}
interface Comanda {
  readonly estado: string;
  readonly venta_id: string;
  readonly mesa_numero?: number | null;
  readonly estacion_preparacion_nombre?: string | null;
  readonly items?: readonly Platillo[];
}
interface AvisoDeListo {
  readonly mesaNumero: number;
  readonly platillos: readonly { readonly id: string }[];
}

function bloqueEn(
  cocina: Page,
  columna: 'nuevo' | 'en_preparacion' | 'listo',
  mesa: number,
): Locator {
  return cocina
    .locator(`section[aria-labelledby="columna-${columna}"] li[data-bloque]`)
    .filter({ hasText: new RegExp(`Mesa ${String(mesa)}(?!\\d)`) });
}

async function tocar(
  cocina: Page,
  mesa: number,
  nombre: string,
  de: 'nuevo' | 'en_preparacion',
  boton: 'Preparar' | 'Listo',
): Promise<void> {
  const fila = bloqueEn(cocina, de, mesa).locator('ul > li').filter({ hasText: nombre }).first();
  const antes = await gestosVistos(cocina);
  await fila.getByRole('button', { name: boton, exact: true }).tap();
  try {
    await expect(fila).toHaveCount(0, { timeout: 5_000 });
  } catch {
    // La pantalla pinta el toque en el acto: si la fila sigue ahí, el toque se perdió y ES la falla
    // (no se repite: repetirlo escondería justo lo que reportó la cocina). Se deja dicho QUÉ vio el
    // navegador (¿bajó el dedo? ¿llegó el clic?) para saber en qué capa se perdió.
    const despues = await gestosVistos(cocina);
    throw new Error(
      `TOQUE PERDIDO mesa ${String(mesa)} · ${nombre} · ${boton}: el navegador vio abajo+${String(despues.abajo - antes.abajo)} arriba+${String(despues.arriba - antes.arriba)} clics+${String(despues.clics - antes.clics)} y la fila no salió de la columna en 5 s.`,
    );
  }
}

interface Gestos {
  readonly abajo: number;
  readonly arriba: number;
  readonly clics: number;
}

/** Cuántos gestos de puntero y clics ha visto la página (se instala solo la primera vez). */
async function gestosVistos(pagina: Page): Promise<Gestos> {
  return pagina.evaluate(() => {
    const w = window as unknown as { __gestos?: { abajo: number; arriba: number; clics: number } };
    if (w.__gestos === undefined) {
      const cuenta = { abajo: 0, arriba: 0, clics: 0 };
      w.__gestos = cuenta;
      document.addEventListener('pointerdown', () => (cuenta.abajo += 1), true);
      document.addEventListener('pointerup', () => (cuenta.arriba += 1), true);
      document.addEventListener('click', () => (cuenta.clics += 1), true);
    }
    return { ...w.__gestos };
  });
}

test.describe('mini jornada de cocina (DP-24)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('10 mesas, 2 estaciones y platillos que terminan en desorden: nada se pierde ni se duplica', async ({
    browser,
  }, info) => {
    test.setTimeout(15 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    const aCerrar: BrowserContext[] = [];
    try {
      const duena = await equipo.pagina(info, 'dueno');
      const sinFallos = vigilarFallos(duena);
      const reseteo = await duena.request.post('/api/pruebas/resetear', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { confirmacion: 'RESETEAR' },
      });
      expect(reseteo.status(), `resetear: ${await reseteo.text()}`).toBe(200);
      await escribir(duena, '/api/datos/escribir', {
        entidad: 'ConfiguracionNegocio',
        operacion: 'update',
        datos: { estaciones_preparacion_activas: true },
      });
      await duena.goto('/configuracion?seccion=cocina');
      await crearEstacion(duena, PARRILLA);
      const parrilla = await laEstacion(duena, PARRILLA);
      const barra = await laEstacion(duena, 'Barra');
      await categoriaA(duena, 'Platos fuertes', parrilla);
      await categoriaA(duena, 'Entradas', parrilla);
      await categoriaA(duena, 'Bebidas', barra);
      const fuerte = await platilloDe(duena, 'Platos fuertes');
      const entrada = await platilloDe(duena, 'Entradas');
      const bebida = await platilloDe(duena, 'Bebidas');

      const deParrilla = await cocineroDe(browser, info, duena, SLUG, parrilla);
      const deBarra = await cocineroDe(browser, info, duena, SLUG, barra);
      aCerrar.push(deParrilla.pagina.context(), deBarra.pagina.context());
      // Con COCINA_CPU=4 las dos cocinas corren con la CPU estrangulada (lo que pasa en una
      // tableta vieja con la cocina a tope): ahí es donde un toque tardaba en llegar al servidor.
      const tasa = Number(process.env['COCINA_CPU'] ?? '1');
      if (tasa > 1) {
        for (const cocina of [deParrilla.pagina, deBarra.pagina]) {
          const cdp = await cocina.context().newCDPSession(cocina);
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: tasa });
        }
      }

      // Dos meseros: Lupita (de la demo) y otro creado para esta corrida.
      const lupita = await equipo.pagina(info, 'mesero');
      const pinDelOtro = String(randomInt(1000, 10_000));
      const nombreDelOtro = `Mesero ${N} E2E`;
      await escribir(duena, '/api/identidad/empleados', {
        nombre: nombreDelOtro,
        puesto: 'mesero',
        pin: pinDelOtro,
      });
      const contextoDelOtro = await browser.newContext(opcionesDelProyecto(info));
      aCerrar.push(contextoDelOtro);
      const otro = await contextoDelOtro.newPage();
      await entrar(otro, { slug: SLUG, nombre: nombreDelOtro, pin: pinDelOtro });
      await lupita.goto('/mesero');
      await otro.goto('/mesero');

      const mesas = await consultarPuente<{ id: string; numero: number }>(duena, 'Mesa', {
        limite: 60,
      });
      const lasDiez = [...mesas].sort((a, b) => a.numero - b.numero).slice(0, MESAS);
      expect(lasDiez, 'La demo no tiene diez mesas.').toHaveLength(MESAS);

      const deQuien = new Map<number, 'lupita' | 'otro'>();
      const ordenes = new Map<number, string>();
      await test.step('cada mesero abre sus cinco mesas y manda dos de Parrilla y una de Barra', async () => {
        for (const [i, mesa] of lasDiez.entries()) {
          const quien = i % 2 === 0 ? 'lupita' : 'otro';
          const pagina = quien === 'lupita' ? lupita : otro;
          deQuien.set(mesa.numero, quien);
          const apertura = await pagina.request.post('/api/restaurante/abrir-mesa', {
            headers: cabecerasDeEscrituraDePrueba(),
            data: { mesaId: mesa.id, personas: 2 },
          });
          expect(apertura.status(), await apertura.text()).toBe(200);
          const ordenId = String(
            ((await apertura.json()) as { datos?: { ordenId?: string } }).datos?.ordenId,
          );
          ordenes.set(mesa.numero, ordenId);
          const envio = await pagina.request.post('/api/restaurante/enviar-pedido', {
            headers: cabecerasDeEscrituraDePrueba(),
            data: {
              ordenId,
              lineas: [
                { productoId: fuerte.id, cantidad: '1' },
                { productoId: entrada.id, cantidad: '1' },
                { productoId: bebida.id, cantidad: '1' },
              ],
            },
          });
          expect(envio.status(), await envio.text()).toBe(200);
        }
      });

      await test.step('cada cocina ve las diez mesas y sólo lo suyo', async () => {
        await expect(deParrilla.pagina.locator('li[data-bloque]')).toHaveCount(MESAS, {
          timeout: 60_000,
        });
        await expect(deBarra.pagina.locator('li[data-bloque]')).toHaveCount(MESAS, {
          timeout: 60_000,
        });
        await expect(deParrilla.pagina.getByText(bebida.nombre)).toHaveCount(0);
        await expect(deBarra.pagina.getByText(fuerte.nombre)).toHaveCount(0);
      });

      const tareas = lasDiez.flatMap((m) => [
        { mesa: m.numero, nombre: fuerte.nombre, cocina: deParrilla.pagina },
        { mesa: m.numero, nombre: entrada.nombre, cocina: deParrilla.pagina },
        { mesa: m.numero, nombre: bebida.nombre, cocina: deBarra.pagina },
      ]);
      const orden = revolver(tareas, semilla(2411));

      await test.step('las dos cocinas sacan los 30 platillos en desorden, con el dedo', async () => {
        // Primero todos «Preparar» en un orden y luego todos «Listo» en OTRO: cada mesa tiene
        // platillos en columnas distintas a la vez durante toda la jornada.
        for (const t of orden) await tocar(t.cocina, t.mesa, t.nombre, 'nuevo', 'Preparar');
        const otroOrden = revolver(tareas, semilla(77));
        for (const [i, t] of otroOrden.entries()) {
          await tocar(t.cocina, t.mesa, t.nombre, 'en_preparacion', 'Listo');
          if (i % 7 === 0) {
            // En el camino, los avisos en pantalla de cada mesero son sólo de sus mesas.
            for (const [pagina, quien] of [
              [lupita, 'lupita'],
              [otro, 'otro'],
            ] as const) {
              const textos = await pagina.locator('[data-aviso]').allInnerTexts();
              for (const texto of textos) {
                const mesa = Number(/Mesa (\d+)/.exec(texto)?.[1]);
                expect(
                  deQuien.get(mesa),
                  `Un aviso de la mesa ${String(mesa)} llegó a otro mesero.`,
                ).toBe(quien);
              }
            }
            await expect(duena.locator('[data-aviso]')).toHaveCount(0);
          }
        }
      });

      await test.step('el servidor: tres platillos por mesa, ninguno perdido ni duplicado, todo listo', async () => {
        // La pantalla pinta cada toque antes de que el servidor conteste (DP-7): al verse hecho el
        // último «Listo», su pedido todavía puede ir en camino. Lo que se exige es que el servidor
        // LLEGUE a tenerlo todo (nada perdido ni duplicado), no que ya lo tenga en ese instante.
        for (const [numero, ordenId] of ordenes) {
          await expect(async () => {
            const comandas = await consultarPuente<Comanda>(duena, 'PedidoPreparacion', {
              filtro: { venta_id: ordenId },
              limite: 20,
            });
            const platillos = comandas.flatMap((c) => c.items ?? []);
            expect(
              platillos,
              `Mesa ${String(numero)}: platillos perdidos o duplicados.`,
            ).toHaveLength(3);
            expect(new Set(platillos.map((p) => p.id)).size).toBe(3);
            expect(platillos.map((p) => p.estado)).toEqual(['listo', 'listo', 'listo']);
            expect(comandas.map((c) => c.estado)).toEqual(['listo', 'listo']);
            const [mesa] = await consultarPuente<{ estado: string }>(duena, 'Mesa', {
              filtro: { numero },
              limite: 1,
            });
            expect(mesa?.estado, `Mesa ${String(numero)} no quedó lista.`).toBe(
              'en_espera_entrega',
            );
          }).toPass({ timeout: 30_000, intervals: [500] });
        }
      });

      await test.step('cada mesero recibe los avisos de SUS mesas y la dueña ninguno', async () => {
        const pedir = async (pagina: Page) =>
          pagina.request.post('/api/restaurante/avisos-de-listo', {
            headers: cabecerasDeEscrituraDePrueba(),
            data: {},
          });
        for (const [pagina, quien] of [
          [lupita, 'lupita'],
          [otro, 'otro'],
        ] as const) {
          const r = await pedir(pagina);
          expect(r.status(), await r.text()).toBe(200);
          const avisos = ((await r.json()) as { datos: { avisos: AvisoDeListo[] } }).datos.avisos;
          const suyas = [...deQuien].filter(([, q]) => q === quien).map(([m]) => m);
          expect([...new Set(avisos.map((a) => a.mesaNumero))].sort((a, b) => a - b)).toEqual(
            suyas.sort((a, b) => a - b),
          );
          expect(avisos.flatMap((a) => a.platillos)).toHaveLength(suyas.length * 3);
        }
        const dueña = await pedir(duena);
        expect(dueña.status(), 'La dueña no debe poder pedir los avisos.').toBeGreaterThanOrEqual(
          400,
        );
      });

      await test.step('entregar una mesa la saca de los avisos y la deja ocupada', async () => {
        const mesa = lasDiez[0]?.numero ?? 1;
        const ordenId = ordenes.get(mesa) ?? '';
        const entrega = await lupita.request.post('/api/restaurante/entregar-pedidos', {
          headers: cabecerasDeEscrituraDePrueba(),
          data: { ordenId },
        });
        expect(entrega.status(), await entrega.text()).toBe(200);
        const r = await lupita.request.post('/api/restaurante/avisos-de-listo', {
          headers: cabecerasDeEscrituraDePrueba(),
          data: {},
        });
        const avisos = ((await r.json()) as { datos: { avisos: AvisoDeListo[] } }).datos.avisos;
        expect(avisos.some((a) => a.mesaNumero === mesa)).toBe(false);
        const [fila] = await consultarPuente<{ estado: string }>(duena, 'Mesa', {
          filtro: { numero: mesa },
          limite: 1,
        });
        expect(fila?.estado).toBe('ocupada');
      });

      await escribir(duena, '/api/datos/escribir', {
        entidad: 'EstacionPreparacion',
        operacion: 'update',
        id: parrilla.id,
        datos: { activo: false },
      });
      sinFallos();
    } finally {
      for (const contexto of aCerrar) await contexto.close();
      await equipo.cerrar();
    }
  });
});
