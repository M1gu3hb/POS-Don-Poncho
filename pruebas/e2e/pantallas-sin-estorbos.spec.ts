import { readFileSync } from 'node:fs';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { abrirElQrDeLaMesa, prepararElPortalDelComensal } from './ayudantes/mesas-heredadas.ts';
import { Equipo } from './ayudantes/roles.ts';
import {
  cabecerasDeEscrituraDePrueba,
  consultarPuente,
  exigirDemostracion,
  vigilarFallos,
} from './ayudantes/sesion.ts';

/**
 * DP-12.6 · LAS PANTALLAS QUE SE VEÍAN MAL: nada se desborda a lo ancho, nada flotante tapa un
 * botón, y los botones del menú QR cubren lo que declaran.
 *
 * Se mide en el navegador, con cajas (`boundingBox`) y con la imagen ya cargada, en los anchos
 * de teléfono de 320 a 430 px: lo que se ve bien a 412 puede romperse a 320.
 */

const SLUG = 'prueba-restaurante';
const MESA = 6;
const ANCHOS_DE_TELEFONO = [320, 375, 412, 430] as const;
/** Lo que mide, de alto, la pantalla en la que la carta se desliza por debajo de «Atención». */
const ALTO_DE_PANTALLA_BAJA = 560;
const PAGINA = 'Lo fuerte';
/** Lo que sobra en una caja medida con fracciones de píxel. */
const TOLERANCIA_PX = 1.5;

interface Caja {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function seTocan(a: Caja, b: Caja): boolean {
  return (
    a.x < b.x + b.width - 0.5 &&
    b.x < a.x + a.width - 0.5 &&
    a.y < b.y + b.height - 0.5 &&
    b.y < a.y + a.height - 0.5
  );
}

async function caja(lugar: Locator, que: string): Promise<Caja> {
  const medida = await lugar.boundingBox();
  expect(medida, `No se pudo medir ${que}.`).not.toBeNull();
  return medida as Caja;
}

/** La página no es más ancha que la pantalla: nada obliga a deslizar de lado. */
async function sinDesborde(page: Page, que: string): Promise<void> {
  const medidas = await page.evaluate(() => ({
    pagina: document.documentElement.scrollWidth,
    pantalla: window.innerWidth,
  }));
  expect(
    medidas.pagina,
    `${que}: la página mide ${String(medidas.pagina)} px en una pantalla de ${String(medidas.pantalla)}.`,
  ).toBeLessThanOrEqual(medidas.pantalla);
}

/**
 * Baja hasta el final REAL de la página: las listas siguen creciendo un momento (imágenes,
 * lecturas), así que se baja otra vez hasta que la altura y el número de elementos dejan de
 * cambiar en tres lecturas seguidas.
 */
async function alFinalDeLaPagina(page: Page): Promise<void> {
  let previa = '';
  let iguales = 0;
  for (let vuelta = 0; vuelta < 40 && iguales < 3; vuelta += 1) {
    const ahora = await page.evaluate(async () => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      // Dos pintadas: el último contenido termina de acomodarse.
      await new Promise((listo) => requestAnimationFrame(() => requestAnimationFrame(listo)));
      return `${String(document.documentElement.scrollHeight)}/${String(document.body.querySelectorAll('*').length)}`;
    });
    iguales = ahora === previa ? iguales + 1 : 0;
    previa = ahora;
    await page.waitForTimeout(300);
  }
}

/**
 * Lo que un elemento flotante TAPA de verdad: de los `candidatos`, los que se cruzan con su caja y,
 * quitando el flotante un instante, son lo que el dedo tocaría en ese punto. Una caja que se cruza
 * no basta: un botón dentro de un acordeón cerrado tiene caja y no se ve ni se toca.
 */
async function tapadosPor(page: Page, flotante: Locator, candidatos: string): Promise<string[]> {
  const elemento = await flotante.elementHandle();
  expect(elemento, 'No se encontró el elemento flotante.').not.toBeNull();
  return page.evaluate(
    ({ flotante: arriba, candidatos: selector }) => {
      const caja = arriba.getBoundingClientRect();
      const visibilidad = arriba.style.visibility;
      const tapados: string[] = [];
      for (const e of document.querySelectorAll(selector)) {
        const r = e.getBoundingClientRect();
        const izquierda = Math.max(r.left, caja.left);
        const derecha = Math.min(r.right, caja.right);
        const arribaY = Math.max(r.top, caja.top);
        const abajoY = Math.min(r.bottom, caja.bottom);
        if (derecha - izquierda < 1 || abajoY - arribaY < 1) continue;
        arriba.style.visibility = 'hidden';
        const golpe = document.elementFromPoint((izquierda + derecha) / 2, (arribaY + abajoY) / 2);
        arriba.style.visibility = visibilidad;
        if (golpe !== null && (e === golpe || e.contains(golpe))) {
          const nombre = (e.getAttribute('aria-label') ?? e.textContent ?? '').trim();
          tapados.push(`${e.tagName.toLowerCase()} «${nombre.slice(0, 40)}»`);
        }
      }
      return tapados;
    },
    { flotante: elemento as NonNullable<typeof elemento> & Element, candidatos },
  );
}

async function escribir(duena: Page, ruta: string, datos: object): Promise<void> {
  const r = await duena.request.post(ruta, {
    headers: cabecerasDeEscrituraDePrueba(),
    data: datos,
  });
  expect(r.status(), `${ruta}: ${(await r.text()).slice(0, 300)}`).toBe(200);
}

test.describe('las pantallas sin estorbos', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 60_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('menú QR del comensal: los botones de precio cubren su caja en todos los teléfonos y «Atención» no tapa ninguno', async ({
    browser,
  }, info) => {
    test.skip(info.project.name !== 'telefono', 'el menú del comensal se mide en teléfono');
    test.setTimeout(8 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    const telefonos: { cerrar: () => Promise<void> }[] = [];
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await escribir(duena, '/api/pruebas/resetear', { confirmacion: 'RESETEAR' });
      const token = await prepararElPortalDelComensal(duena, {
        mesa: MESA,
        zona: 'Interior',
        mesero: null,
        pedidosDelComensal: true,
      });
      await escribir(duena, '/api/datos/escribir', {
        entidad: 'ConfiguracionNegocio',
        operacion: 'update',
        datos: { portal_qr_modo_menu: 'menu_subido' },
      });
      await escribir(duena, '/api/datos/escribir', {
        entidad: 'MenuQRSeccion',
        operacion: 'create',
        datos: {
          nombre: PAGINA,
          imagen_url: new URL('/menu-qr/02-lo-fuerte.webp', duena.url()).href,
          orden: 1,
          activo: true,
        },
      });
      const [pagina] = await consultarPuente<{ id: string }>(duena, 'MenuQRSeccion', {
        filtro: { nombre: PAGINA },
        limite: 1,
      });
      const productos = await consultarPuente<{ id: string }>(duena, 'ProductoTerminado', {
        limite: 40,
      });
      // Las cajas de la carta real: dónde mide `generar-menu-qr --posiciones` cada renglón.
      const declaradas = (
        JSON.parse(readFileSync('docs/cliente/botones-menu-qr.json', 'utf8')) as Record<
          string,
          readonly { x: number; y: number; ancho: number; alto: number }[]
        >
      )['02-lo-fuerte'];
      expect(declaradas?.length ?? 0, 'No hay posiciones de la carta «Lo fuerte».').toBeGreaterThan(
        5,
      );
      const botones = (declaradas ?? []).map((c, i) => ({
        id: `b${String(i)}`,
        tipo: 'platillo',
        x: c.x,
        y: c.y,
        ancho: c.ancho,
        alto: c.alto,
        productoId: productos[i % productos.length]?.id,
        mostrarPrecio: true,
      }));
      await escribir(duena, '/api/datos/escribir', {
        entidad: 'ConfiguracionNegocio',
        operacion: 'update',
        datos: { portal_qr_botones: { [pagina?.id ?? '']: botones } },
      });

      /** Lo que mide UN renglón de la carta, en % de la imagen: el botón más bajo. */
      const renglonDeLaCarta = Math.min(...botones.map((b) => b.alto));
      const comensal = await abrirElQrDeLaMesa(browser, info, SLUG, token);
      telefonos.push(comensal);
      const telefono = comensal.page;
      const exigirSinFallos = vigilarFallos(telefono);
      const carta = telefono.getByRole('article', { name: PAGINA });
      await expect(carta).toBeVisible();
      const imagen = carta.getByRole('img', { name: PAGINA });

      for (const ancho of ANCHOS_DE_TELEFONO) {
        await test.step(`a ${String(ancho)} px`, async () => {
          // Una pantalla BAJA (un teléfono con el teclado o la barra del navegador): la carta es más
          // alta que ella y sus últimas filas pasan por debajo de «Atención» al deslizar.
          await telefono.setViewportSize({ width: ancho, height: ALTO_DE_PANTALLA_BAJA });
          await imagen.scrollIntoViewIfNeeded();
          // Con la imagen YA cargada: sin ella los botones no tienen dónde ir.
          await expect
            .poll(() =>
              imagen.evaluate(
                (img) => (img as HTMLImageElement).complete && img.clientHeight > 100,
              ),
            )
            .toBe(true);
          await sinDesborde(telefono, `menú QR a ${String(ancho)} px`);

          const cajaDeLaImagen = await caja(imagen, 'la imagen');
          const agregar = carta.getByRole('button', { name: /^Agregar / });
          expect(await agregar.count(), 'Faltan botones sobre la carta.').toBe(botones.length);
          for (const [i, declarada] of botones.entries()) {
            const boton = agregar.nth(i);
            const medida = await caja(boton, `el botón ${String(i)}`);
            const esperada = {
              x: cajaDeLaImagen.x + (declarada.x / 100) * cajaDeLaImagen.width,
              y: cajaDeLaImagen.y + (declarada.y / 100) * cajaDeLaImagen.height,
              width: (declarada.ancho / 100) * cajaDeLaImagen.width,
              height: (declarada.alto / 100) * cajaDeLaImagen.height,
            };
            const cubre =
              medida.x <= esperada.x + TOLERANCIA_PX &&
              medida.y <= esperada.y + TOLERANCIA_PX &&
              medida.x + medida.width >= esperada.x + esperada.width - TOLERANCIA_PX &&
              medida.y + medida.height >= esperada.y + esperada.height - TOLERANCIA_PX;
            expect(
              cubre,
              `A ${String(ancho)} px el botón ${String(i)} mide ${JSON.stringify(medida)} y su caja declarada es ${JSON.stringify(esperada)}.`,
            ).toBe(true);
            // Lo que se ve del botón —la marca con el precio— tiene que tapar la primera línea
            // del renglón (donde va el precio impreso de la carta) de arriba abajo, y llegar al
            // borde derecho: si no, el precio impreso se asoma.
            const marca = await caja(boton.locator('[data-slot="badge"]'), `la marca ${String(i)}`);
            const unRenglon = (renglonDeLaCarta / 100) * cajaDeLaImagen.height;
            const primeraLinea = Math.min(esperada.height, unRenglon);
            expect(
              marca.y <= esperada.y + TOLERANCIA_PX &&
                marca.y + marca.height >= esperada.y + primeraLinea - TOLERANCIA_PX,
              `A ${String(ancho)} px la marca del botón ${String(i)} (${JSON.stringify(marca)}) no tapa la primera línea (${primeraLinea.toFixed(1)} px) del renglón ${JSON.stringify(esperada)}.`,
            ).toBe(true);
            const bordeDerecho = esperada.x + esperada.width;
            expect(
              marca.x + marca.width >= bordeDerecho + 2 &&
                marca.x + marca.width <= bordeDerecho + 5,
              `A ${String(ancho)} px la marca del botón ${String(i)} (${JSON.stringify(marca)}) no sobresale del borde derecho del renglón (2 a 5 px, para que sus puntas redondas no descubran la última cifra impresa) (${bordeDerecho.toFixed(1)}).`,
            ).toBe(true);
          }

          // «Atención» no tapa NADA de la carta: ni estando la última fila justo debajo de ella (la
          // columna derecha es donde se toca el precio) ...
          const atencion = telefono.getByRole('button', { name: 'Atención', exact: true });
          const flotante = atencion.locator('xpath=..');
          const alFondo = await caja(agregar.last(), 'el último botón');
          await telefono.evaluate((y) => {
            window.scrollBy(0, y - (window.innerHeight - 60));
          }, alFondo.y + alFondo.height);
          const cajaDeAtencion = await caja(flotante, 'el botón «Atención» y su rótulo');
          for (const [i] of botones.entries()) {
            const marca = await agregar.nth(i).locator('[data-slot="badge"]').boundingBox();
            if (marca === null) continue;
            expect(
              seTocan(cajaDeAtencion, marca),
              `A ${String(ancho)} px «Atención» (${JSON.stringify(cajaDeAtencion)}) tapa la marca ${String(i)} (${JSON.stringify(marca)}) con la carta a media pantalla.`,
            ).toBe(false);
          }
          // ... ni al final de la página.
          await alFinalDeLaPagina(telefono);
          const alFinal = await tapadosPor(
            telefono,
            flotante,
            'article button, article img, article p',
          );
          expect(
            alFinal,
            `A ${String(ancho)} px, al final, «Atención» tapa ${alFinal.join(', ')}.`,
          ).toEqual([]);
        });
      }
      exigirSinFallos();
    } finally {
      for (const telefono of telefonos) await telefono.cerrar();
      await equipo.cerrar();
    }
  });

  test('Cocina en el teléfono: el encabezado no se pisa ni se aprieta', async ({
    browser,
  }, info) => {
    test.skip(info.project.name !== 'telefono', 'el encabezado se mide en teléfono');
    const equipo = new Equipo(browser, SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await duena.goto('/cocina');
      const titulo = duena.getByRole('heading', { level: 1, name: /^Cocina/ });
      await expect(titulo).toBeVisible();
      for (const ancho of ANCHOS_DE_TELEFONO) {
        await test.step(`a ${String(ancho)} px`, async () => {
          await duena.setViewportSize({ width: ancho, height: 800 });
          await sinDesborde(duena, `Cocina a ${String(ancho)} px`);
          const encabezado = titulo.locator('xpath=ancestor::div[contains(@class,"flex-wrap")][1]');
          const conectar = encabezado.getByRole('button', { name: 'Conectar teléfono' });
          const activos = encabezado.getByText(/pedido\(s\) activos/);
          const bloqueDelTitulo = titulo.locator('xpath=..');
          const cajas = {
            titulo: await caja(titulo, 'el título'),
            bloque: await caja(bloqueDelTitulo, 'el bloque del título'),
            conectar: await caja(conectar, '«Conectar teléfono»'),
            activos: await caja(activos, 'los pedidos activos'),
          };
          expect(
            seTocan(cajas.bloque, cajas.conectar),
            `A ${String(ancho)} px «Conectar teléfono» ${JSON.stringify(cajas.conectar)} pisa el título ${JSON.stringify(cajas.bloque)}.`,
          ).toBe(false);
          // El título cabe en renglones de verdad (no una columna de letras) y «N pedido(s)
          // activos» queda en un renglón.
          expect(cajas.bloque.width, 'El título quedó apretado.').toBeGreaterThanOrEqual(150);
          expect(
            cajas.activos.height,
            '«pedido(s) activos» se partió en varios renglones.',
          ).toBeLessThanOrEqual(20);
          for (const otro of await encabezado.getByRole('button').all()) {
            const medida = await otro.boundingBox();
            if (medida === null) continue;
            expect(
              seTocan(cajas.bloque, medida),
              `A ${String(ancho)} px un botón (${JSON.stringify(medida)}) pisa el título (${JSON.stringify(cajas.bloque)}).`,
            ).toBe(false);
            expect(medida.x + medida.width, 'Un botón se sale de la pantalla.').toBeLessThanOrEqual(
              ancho,
            );
          }
        });
      }
    } finally {
      await equipo.cerrar();
    }
  });

  test('el botón redondo del menú no tapa nada al final de Recetas ni de Platillos', async ({
    browser,
  }, info) => {
    test.skip(
      info.project.name !== 'telefono',
      'el botón del menú sólo existe por debajo de 1024 px',
    );
    test.setTimeout(3 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      for (const ruta of ['/recetas', '/productos']) {
        await duena.goto(ruta);
        const menu = duena.getByRole('button', { name: 'Mantén presionado para abrir el menú' });
        await expect(menu).toBeVisible();
        for (const ancho of ANCHOS_DE_TELEFONO) {
          await duena.setViewportSize({ width: ancho, height: 800 });
          await sinDesborde(duena, `${ruta} a ${String(ancho)} px`);
          await alFinalDeLaPagina(duena);
          const tapados = await tapadosPor(
            duena,
            menu.locator('xpath=..'),
            'main button, main a[href], main [role="button"], main [role="tab"], main input',
          );
          expect(
            tapados,
            `${ruta} a ${String(ancho)} px, al final: el botón del menú tapa ${tapados.join(', ')}.`,
          ).toEqual([]);
        }
      }
    } finally {
      await equipo.cerrar();
    }
  });

  test('Portal QR → Solicitudes: las pestañas de filtros caben a lo ancho', async ({
    browser,
  }, info) => {
    const equipo = new Equipo(browser, SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await duena.goto('/portal-qr');
      await duena.getByRole('tab', { name: 'Solicitudes' }).click();
      const filtros = duena.getByRole('button', {
        name: /^(Activas|Pendientes|Atendidas|Resueltas|Todas)/,
      });
      await expect(filtros).toHaveCount(5);
      const anchos =
        info.project.name === 'telefono'
          ? [...ANCHOS_DE_TELEFONO]
          : [duena.viewportSize()?.width ?? 1024];
      for (const ancho of anchos) {
        await duena.setViewportSize({ width: ancho, height: 800 });
        await sinDesborde(duena, `Solicitudes a ${String(ancho)} px`);
        for (const [i, filtro] of (await filtros.all()).entries()) {
          const medida = await caja(filtro, `el filtro ${String(i)}`);
          expect(
            medida.x >= -0.5 && medida.x + medida.width <= ancho + 0.5,
            `A ${String(ancho)} px el filtro ${String(i)} se sale: ${JSON.stringify(medida)}.`,
          ).toBe(true);
        }
      }
    } finally {
      await equipo.cerrar();
    }
  });

  test('el nombre de la mesa no se repite: «Mesa 6», no «Mesa 6 · Mesa 6»', async ({
    browser,
  }, info) => {
    test.setTimeout(6 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    const telefonos: { cerrar: () => Promise<void> }[] = [];
    const repetido = /Mesa (\d+)\s*·\s*Mesa \1\b/;
    try {
      const duena = await equipo.pagina(info, 'dueno');
      const exigirSinFallos = vigilarFallos(duena);
      await escribir(duena, '/api/pruebas/resetear', { confirmacion: 'RESETEAR' });
      const token = await prepararElPortalDelComensal(duena, {
        mesa: MESA,
        zona: 'Interior',
        mesero: null,
        pedidosDelComensal: true,
      });

      await test.step('Portal QR → Mesas QR', async () => {
        await duena.goto('/portal-qr');
        await duena.getByRole('tab', { name: 'Mesas QR' }).click();
        await expect(duena.getByText(`Mesa ${String(MESA)}`).first()).toBeVisible();
        expect(await duena.locator('main').innerText()).not.toMatch(repetido);
      });

      await test.step('el portal del comensal', async () => {
        const comensal = await abrirElQrDeLaMesa(browser, info, SLUG, token);
        telefonos.push(comensal);
        await expect(comensal.page.getByText(`Mesa ${String(MESA)}`).first()).toBeVisible();
        expect(await comensal.page.locator('body').innerText()).not.toMatch(repetido);
      });
      exigirSinFallos();
    } finally {
      for (const telefono of telefonos) await telefono.cerrar();
      await equipo.cerrar();
    }
  });
});
