import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { medirLaPantalla, TAMANOS, type Hallazgo } from './ayudantes/barrido-medidas.ts';
import { Equipo } from './ayudantes/roles.ts';
import {
  abrirCajaPorLaRuta,
  cabecerasDeEscrituraDePrueba,
  consultarPuente,
  exigirDemostracion,
} from './ayudantes/sesion.ts';

/**
 * DP-21 · Bloque 16 · EL BARRIDO VISUAL, PANTALLA POR PANTALLA (M21).
 *
 * Recorre las pantallas del restaurante, con sus diálogos principales abiertos, en seis tamaños
 * (1920×1080, 1280×800, 1366×768, 1024×768, 800×1280 y 390×844), con la barra lateral abierta y
 * cerrada, y en 1280×800 (el iMin) y 390×844 (el teléfono) también con el teclado abierto (el alto
 * visible menos 40 %). En cada una MIDE (`ayudantes/barrido-medidas.ts`) y falla con datos:
 * desborde horizontal de la página, blancos táctiles de menos de 44 px, texto que no cabe, tarjetas
 * de una fila de distinto alto, campos que no se alinean y lo que la barra o el teclado tapan.
 *
 * Variables: `MORPHIQPOS_BARRIDO` (id de pantalla, o varias separadas por coma, para correr sólo
 * esas), `MORPHIQPOS_BARRIDO_INFORME` (dónde dejar el informe completo en JSON) y
 * `MORPHIQPOS_BARRIDO_CAPTURAS` (carpeta donde dejar JPEG calidad 70 de cada vista).
 *
 * Supone, del negocio de prueba: `prueba-restaurante` con la dueña de la demo y una caja que se
 * puede abrir por la ruta. Lo que una pantalla no tiene a la mano (un botón que no está) se anota
 * como «no disponible» y no falla.
 */

const SLUG = 'prueba-restaurante';
const SOLO = (process.env['MORPHIQPOS_BARRIDO'] ?? '').split(',').filter((s) => s !== '');
const INFORME = process.env['MORPHIQPOS_BARRIDO_INFORME'] ?? '';
const CAPTURAS = process.env['MORPHIQPOS_BARRIDO_CAPTURAS'] ?? '';
const CLAVE_BARRA = 'mpos.barra-lateral';
/** La barra fija sólo existe de 1024 px; abajo hay cajón y no hay qué abrir o cerrar. */
const ANCHO_CON_BARRA = 1024;

interface Dialogo {
  readonly nombre: string;
  readonly abrir: (page: Page) => Promise<boolean>;
}

interface Pantalla {
  readonly id: string;
  readonly ruta: string;
  readonly preparar?: (page: Page) => Promise<void>;
  readonly dialogos?: readonly Dialogo[];
}

const clic = (rol: 'button' | 'tab', nombre: RegExp | string) => async (page: Page) => {
  const boton = page.getByRole(rol, { name: nombre }).first();
  if ((await boton.count()) === 0 || !(await boton.isVisible())) return false;
  await boton.click();
  return true;
};

/** La mesa que el barrido abre para ver el panel de la mesa (y «Cambiar de mesa»). */
let mesaAbierta = '';

const PANTALLAS: readonly Pantalla[] = [
  {
    id: 'caja-movimientos',
    ruta: '/caja',
    preparar: async (page) => {
      await clic('tab', 'Movimientos')(page);
    },
  },
  { id: 'corte', ruta: '/restaurante/cierre-diario-y-arqueo' },
  { id: 'caja-cobro', ruta: '/caja' },
  {
    id: 'mesero',
    ruta: '/mesero',
    dialogos: [
      {
        nombre: 'abrir mesa',
        abrir: async (page) => (await page.locator('[data-mesa-id]').first().click(), true),
      },
    ],
  },
  {
    id: 'mesero-panel',
    ruta: '/mesero',
    preparar: async (page) => {
      if (mesaAbierta !== '') await page.locator(`[data-mesa-id="${mesaAbierta}"]`).click();
    },
    dialogos: [{ nombre: 'cambiar de mesa', abrir: clic('button', /Cambiar de mesa/) }],
  },
  {
    id: 'compras',
    ruta: '/compras',
    dialogos: [
      { nombre: 'registrar compra', abrir: clic('button', /Registrar compra|Nueva compra/) },
      { nombre: 'registrar gasto', abrir: clic('button', /Registrar gasto|Nuevo gasto/) },
    ],
  },
  { id: 'configuracion', ruta: '/configuracion' },
  { id: 'registros', ruta: '/registros' },
  { id: 'ventas', ruta: '/ventas' },
  { id: 'cocina', ruta: '/cocina' },
  { id: 'inventario', ruta: '/inventario' },
  {
    id: 'productos',
    ruta: '/productos',
    dialogos: [
      { nombre: 'nuevo producto', abrir: clic('button', /Nuevo producto|Agregar producto/) },
    ],
  },
  { id: 'portal-qr', ruta: '/portal-qr' },
  { id: 'tablero', ruta: '/' },
];

async function fijarBarra(page: Page, abierta: boolean): Promise<void> {
  await page.evaluate(
    ([clave, valor]) => {
      localStorage.setItem(clave ?? '', valor ?? '');
    },
    [CLAVE_BARRA, abierta ? 'abierta' : 'plegada'],
  );
}

/** Sólo se captura en los dos tamaños de los POS de verdad (el iMin y el teléfono): lo demás pesa y no se sube. */
const TAMANOS_CAPTURADOS = ['1280x800', '390x844'];

async function capturar(page: Page, nombre: string): Promise<void> {
  if (CAPTURAS === '' || !TAMANOS_CAPTURADOS.some((t) => nombre.includes(t))) return;
  mkdirSync(CAPTURAS, { recursive: true });
  try {
    await page.screenshot({
      path: join(CAPTURAS, `${nombre}.jpg`),
      type: 'jpeg',
      quality: 70,
      timeout: 8_000,
    });
  } catch (error: unknown) {
    // Una captura que no sale no invalida lo medido: se dice y se sigue.
    const motivo = error instanceof Error ? error.message : String(error);
    process.stdout.write(`sin captura de ${nombre}: ${motivo.slice(0, 80)}\n`);
  }
}

interface Fila {
  readonly pantalla: string;
  readonly vista: string;
  readonly hallazgo: Hallazgo;
}

test.describe('el barrido visual (DP-21 · Bloque 16)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('cada pantalla, en cada tamaño, cumple el criterio', async ({ browser }, info) => {
    test.setTimeout(60 * 60_000);
    const duena = await new Equipo(browser, SLUG).pagina(info, 'dueno');
    await abrirCajaPorLaRuta(duena, 100_000);
    const [cinco] = await consultarPuente<{ id: string }>(duena, 'Mesa', {
      filtro: { numero: 5 },
      limite: 1,
    });
    if (cinco !== undefined) {
      // Si una corrida anterior la dejó abierta, sirve igual: la respuesta 422 «ya está abierta» no importa.
      await duena.request.post('/api/restaurante/abrir-mesa', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { mesaId: cinco.id, personas: 2 },
      });
      mesaAbierta = cinco.id;
    }
    const filas: Fila[] = [];
    const noDisponibles: string[] = [];

    for (const pantalla of PANTALLAS) {
      if (SOLO.length > 0 && !SOLO.includes(pantalla.id)) continue;
      for (const tamano of TAMANOS) {
        await duena.setViewportSize({ width: tamano.ancho, height: tamano.alto });
        const barras = tamano.ancho >= ANCHO_CON_BARRA ? [true, false] : [false];
        for (const abierta of barras) {
          const vista = `${pantalla.id}-${tamano.nombre}-${abierta ? 'barra-abierta' : tamano.ancho >= ANCHO_CON_BARRA ? 'barra-plegada' : 'cajon'}`;
          // `/sistema` es ligera y no pide sesión: sólo hace falta un origen donde escribir la elección.
          await duena.goto('/sistema', { waitUntil: 'domcontentloaded' });
          await fijarBarra(duena, abierta);
          await duena.goto(pantalla.ruta, { waitUntil: 'domcontentloaded', timeout: 60_000 });
          await expect(duena.locator('main')).toBeVisible();
          await duena.waitForTimeout(700);
          if (pantalla.preparar !== undefined) await pantalla.preparar(duena);
          await duena.waitForTimeout(300);
          for (const h of await medirLaPantalla(duena))
            filas.push({ pantalla: pantalla.id, vista, hallazgo: h });
          await capturar(duena, vista);

          for (const dialogo of pantalla.dialogos ?? []) {
            if (!(await dialogo.abrir(duena))) {
              noDisponibles.push(`${vista} · ${dialogo.nombre}`);
              continue;
            }
            await duena.waitForTimeout(400);
            const clave = `${vista}-${dialogo.nombre.replaceAll(' ', '-')}`;
            for (const h of await medirLaPantalla(duena))
              filas.push({ pantalla: pantalla.id, vista: clave, hallazgo: h });
            await capturar(duena, clave);
            if (tamano.conTeclado) {
              const teclado = Math.round(tamano.alto * 0.4);
              await duena.setViewportSize({ width: tamano.ancho, height: tamano.alto - teclado });
              await duena.waitForTimeout(300);
              for (const h of await medirLaPantalla(duena, { tecladoPx: 0 }))
                filas.push({ pantalla: pantalla.id, vista: `${clave}-teclado`, hallazgo: h });
              await duena.setViewportSize({ width: tamano.ancho, height: tamano.alto });
            }
            await duena.keyboard.press('Escape');
            await duena.waitForTimeout(200);
          }
        }
      }
    }
    await duena.evaluate((clave) => {
      localStorage.removeItem(clave);
    }, CLAVE_BARRA);

    if (INFORME !== '') writeFileSync(INFORME, JSON.stringify({ filas, noDisponibles }, null, 1));
    const resumen = new Map<string, number>();
    for (const f of filas)
      resumen.set(
        `${f.pantalla} · ${f.hallazgo.tipo}`,
        (resumen.get(`${f.pantalla} · ${f.hallazgo.tipo}`) ?? 0) + 1,
      );
    process.stdout.write(
      [
        '',
        ...[...resumen].map(([k, n]) => `${k.padEnd(34)} ${String(n)}`),
        `no disponibles: ${String(noDisponibles.length)}`,
        '',
      ].join('\n'),
    );
    // El tablero lo rehace otro agente (Bloques 13 y 14): se retrata y se informa, pero no se exige aquí.
    const exigidas = filas.filter((f) => f.pantalla !== 'tablero');
    expect(
      exigidas
        .slice(0, 40)
        .map(
          (f) => `${f.vista} · ${f.hallazgo.tipo} · ${f.hallazgo.donde} · ${f.hallazgo.detalle}`,
        ),
      'El barrido encontró cosas que no cumplen el criterio.',
    ).toEqual([]);
  });
});
