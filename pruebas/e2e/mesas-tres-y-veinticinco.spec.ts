import { expect, type Page, test } from '@playwright/test';

import { abrirElQrDeLaMesa, type TelefonoDelComensal } from './ayudantes/mesas-heredadas.ts';
import { escribir } from './ayudantes/modo-espera.ts';
import { Equipo } from './ayudantes/roles.ts';
import {
  cabecerasDeEscrituraDePrueba,
  consultarPuente,
  exigirDemostracion,
  vigilarFallos,
} from './ayudantes/sesion.ts';

/**
 * DP-12.6 · CON 3 Y CON 25 MESAS: la demo tiene 12 y el restaurante puede tener más o menos.
 *
 * Con 3 (se quitan las demás) y luego con 25 en el Interior (las 22 que faltan, con «Nueva mesa»
 * en Configuración): los QR nuevos con «Generar tokens faltantes», ninguna encima de otra y todas
 * dentro del lienzo, el mapa (o la rejilla del teléfono) con todas, el portal de la última y unir
 * y separar dos. Todo se lee del SERVIDOR.
 */

const SLUG = 'prueba-restaurante';
/** El alto del mapa del mesero y del editor (`MAP_HEIGHT`). */
const ALTO_DEL_LIENZO = 600;

/** Las medidas del dominio (`medidasDeMesa`): [ancho, alto] por tamaño y forma. */
const MEDIDAS: Record<string, Record<string, readonly [number, number]>> = {
  chica: { redonda: [60, 60], cuadrada: [60, 60], rectangular: [90, 55] },
  mediana: { redonda: [80, 80], cuadrada: [80, 80], rectangular: [120, 70] },
  grande: { redonda: [110, 110], cuadrada: [110, 110], rectangular: [160, 90] },
};

interface Mesa {
  readonly id: string;
  readonly numero: number;
  readonly zona?: string | null;
  readonly activo?: boolean | null;
  readonly forma?: string | null;
  readonly tamano?: string | null;
  readonly posicion_x?: number | null;
  readonly posicion_y?: number | null;
  readonly qr_token?: string | null;
}

async function activas(lector: Page): Promise<readonly Mesa[]> {
  const todas = await consultarPuente<Mesa>(lector, 'Mesa', { limite: 200 });
  return todas.filter((m) => m.activo !== false);
}

function caja(m: Mesa) {
  const [ancho, alto] = MEDIDAS[m.tamano ?? 'mediana']?.[m.forma ?? 'redonda'] ?? [80, 80];
  return { x: m.posicion_x ?? 0, y: m.posicion_y ?? 0, ancho, alto };
}

/** Los pares de mesas de una misma zona que se enciman (por su medida real). */
function encimadas(mesas: readonly Mesa[]): readonly string[] {
  return mesas.flatMap((a, i) =>
    mesas.slice(i + 1).flatMap((b) => {
      const [p, q] = [caja(a), caja(b)];
      const seEnciman =
        a.zona === b.zona &&
        p.x < q.x + q.ancho &&
        q.x < p.x + p.ancho &&
        p.y < q.y + q.alto &&
        q.y < p.y + p.alto;
      return seEnciman ? [`${String(a.numero)}/${String(b.numero)}`] : [];
    }),
  );
}

async function generarLosQr(duena: Page, cuantas: number): Promise<void> {
  await duena.goto('/portal-qr');
  await duena.getByRole('tab', { name: 'Mesas QR' }).click();
  duena.once('dialog', (aviso) => void aviso.accept());
  await duena.getByRole('button', { name: 'Generar tokens faltantes' }).click();
  await expect
    .poll(async () => (await activas(duena)).filter((m) => (m.qr_token ?? '') !== '').length, {
      message: 'No todas las mesas tienen su QR.',
    })
    .toBe(cuantas);
}

/** El mapa del mesero (o su rejilla en el teléfono) pinta todas, y ninguna fuera de la vista. */
async function elMapaLasPinta(duena: Page, cuantas: number): Promise<void> {
  await duena.goto('/mesero');
  const pintadas = duena.locator('[data-mesa-id]');
  await expect(pintadas).toHaveCount(cuantas);
  // En el teléfono es una rejilla que se desplaza con la página: no hay marco que recorte.
  if ((duena.viewportSize()?.width ?? 1024) < 768) return;
  const mapa = pintadas.first().locator('xpath=..');
  const marco = await mapa.boundingBox();
  if (marco === null) throw new Error('El mapa no está a la vista.');
  for (const mesa of await pintadas.all()) {
    const suya = await mesa.boundingBox();
    expect(suya, 'Una mesa no se pinta.').not.toBeNull();
    if (suya !== null) expect(suya.y + suya.height).toBeLessThanOrEqual(marco.y + marco.height + 1);
  }
}

/** Une dos mesas con toques (sin gente) y las separa desde «Unir mesas». */
async function unirYSeparar(duena: Page, principal: number, otra: number): Promise<void> {
  await duena.emulateMedia({ reducedMotion: 'reduce' });
  await duena.goto('/mesero');
  await duena.getByRole('button', { name: 'Unir mesas' }).click();
  const plano = duena.getByRole('region', { name: 'Unir mesas' });
  const enElPlano = (n: number) =>
    plano.getByRole('button', { name: `Mesa ${String(n)}`, exact: true });
  await enElPlano(principal).click();
  await enElPlano(otra).click();
  await plano.getByRole('button', { name: /^Unir 2 mesas/ }).click();
  const numero = duena.getByRole('alertdialog', { name: '¿Qué número queda?' });
  await numero.getByRole('radio', { name: `Mesa ${String(principal)}` }).click();
  await numero.getByRole('button', { name: 'Unir', exact: true }).click();
  await expect(numero).toBeHidden();
  await expect(plano).toBeHidden();
  const unida = (await activas(duena)).find((m) => m.numero === otra);
  const cabeza = (await activas(duena)).find((m) => m.numero === principal);
  expect(
    (unida as { unida_a_mesa_id?: string | null } | undefined)?.unida_a_mesa_id,
    `La ${String(otra)} no quedó unida.`,
  ).toBe(cabeza?.id);

  await duena.getByRole('button', { name: 'Unir mesas' }).click();
  await enElPlano(principal).click();
  await plano.getByRole('button', { name: 'Separar mesas' }).click();
  const pregunta = duena.getByRole('alertdialog', { name: '¿Separar las mesas?' });
  await pregunta.getByRole('button', { name: 'Separar mesas' }).click();
  await expect(pregunta).toBeHidden();
  await expect(plano).toBeHidden();
  await duena.emulateMedia({ reducedMotion: null });
}

test.describe('con 3 y con 25 mesas (DP-12.6)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('crear y quitar, los QR, sin encimarse, el mapa, el portal y unir', async ({
    browser,
  }, info) => {
    test.setTimeout(12 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    const telefonos: TelefonoDelComensal[] = [];
    try {
      const duena = await equipo.pagina(info, 'dueno');
      const sinFallos = vigilarFallos(duena);
      const reseteo = await duena.request.post('/api/pruebas/resetear', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { confirmacion: 'RESETEAR' },
      });
      expect(reseteo.status(), `resetear_demo: ${await reseteo.text()}`).toBe(200);

      await test.step('con 3: se quitan las demás y todo sigue en pie', async () => {
        for (const m of await activas(duena)) {
          if (m.zona === 'Interior' && m.numero <= 3) continue;
          await escribir(duena, '/api/datos/escribir', {
            entidad: 'Mesa',
            operacion: 'delete',
            id: m.id,
          });
        }
        expect((await activas(duena)).map((m) => m.numero).sort()).toEqual([1, 2, 3]);
        await generarLosQr(duena, 3);
        await elMapaLasPinta(duena, 3);
        await unirYSeparar(duena, 1, 2);
      });

      await test.step('con 25: las 22 que faltan nacen con «Nueva mesa», ninguna encima de otra', async () => {
        await duena.goto('/configuracion?tab=mesas');
        const dialogo = duena.getByRole('dialog').filter({ hasText: 'Nombre visible' });
        for (let i = 0; i < 22; i += 1) {
          await duena.getByRole('button', { name: 'Nueva mesa' }).click();
          await dialogo.getByRole('button', { name: 'Crear mesa' }).click();
          await expect(dialogo).toBeHidden();
        }
        const mesas = await activas(duena);
        expect(mesas).toHaveLength(25);
        expect(new Set(mesas.map((m) => m.numero)).size, 'Números repetidos.').toBe(25);
        expect(encimadas(mesas), 'Mesas encimadas.').toEqual([]);
        const masAbajo = Math.max(...mesas.map((m) => caja(m).y + caja(m).alto));
        expect(masAbajo, 'Una mesa nació fuera del lienzo.').toBeLessThanOrEqual(ALTO_DEL_LIENZO);
      });

      await test.step('con 25: los QR nuevos, el mapa, el portal de la última y unir las dos últimas', async () => {
        await generarLosQr(duena, 25);
        await elMapaLasPinta(duena, 25);
        // Los números nuevos siguen al mayor, contando las quitadas (que conservan el suyo).
        const [penultima, ultima] = [...(await activas(duena))]
          .sort((a, b) => a.numero - b.numero)
          .slice(-2);
        if (penultima === undefined || ultima === undefined) throw new Error('Faltan mesas.');
        // La demo trae el portal apagado: se enciende para abrir el QR de la última.
        await escribir(duena, '/api/datos/escribir', {
          entidad: 'ConfiguracionNegocio',
          operacion: 'update',
          datos: { portal_qr_activo: true },
        });
        const telefono = await abrirElQrDeLaMesa(browser, info, SLUG, ultima.qr_token ?? '');
        telefonos.push(telefono);
        const rotulo = new RegExp(`\\bMesa ${String(ultima.numero)}(?!\\d)`);
        await expect(telefono.page.getByText(rotulo).first()).toBeVisible();
        await unirYSeparar(duena, penultima.numero, ultima.numero);
      });

      sinFallos();
    } finally {
      for (const telefono of telefonos) await telefono.cerrar();
      await equipo.cerrar();
    }
  });
});
