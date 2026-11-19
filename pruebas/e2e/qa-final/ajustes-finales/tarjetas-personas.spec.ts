import type { Locator, Page } from '@playwright/test';

import { exigirDemostracion } from '../../ayudantes/sesion.ts';
import { escribirEnCampo, irASeccion } from '../arnes/configuracion.ts';
import { expect, exigirServidor, test } from '../arnes/prueba.ts';
import { arrastrar, toque } from '../arnes/toque.ts';
import { VariosAparatos } from '../arnes/varios-aparatos.ts';
import { resetearLaDemo, sqlLocal } from '../parte7/comun.ts';

import { capturar, cardDe, comoSql, MI_NEGOCIO, SLUG } from './comun.ts';

/**
 * DP-22 · USUARIOS POS Y MAPA DE MESAS, CON EL DEDO.
 *
 *   usuarios-pos · mapa-de-mesas
 *
 * La dueña (Windows 1366×768 al 125 %) da de alta a una persona con su PIN de prueba; esa persona entra
 * en OTRO aparato (el acceso, con sesión nueva) tecleando su PIN en el teclado de la pantalla y cae en
 * su pantalla; la dueña la desactiva y ya no entra. Y arrastra una mesa del mapa con el dedo: la
 * posición queda guardada en el servidor y la pantalla la recuerda al recargar.
 */

const PIN_NUEVO = '8642';
const NOMBRE_NUEVO = `Rubén Ochoa ${String((Date.now() % 9000) + 1000)}`;

/** La tarjeta de una persona en la pantalla de acceso (su nombre es el primer párrafo). */
function tarjetaDeAcceso(page: Page, nombre: string): Locator {
  return page.getByRole('button').filter({
    has: page.locator('p:first-child', { hasText: nombre }),
  });
}

/** Teclea un PIN en el teclado de la pantalla, con el dedo. */
async function teclear(page: Page, pin: string): Promise<void> {
  for (const digito of pin) {
    await toque(page, page.getByRole('button', { name: digito, exact: true }));
  }
}

test.describe('usuarios POS y mapa de mesas', () => {
  test.use({ actionTimeout: 120_000, navigationTimeout: 60_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('usuarios-pos: la persona nueva entra con su PIN en otro aparato, la dueña la desactiva y ya no entra, la reactiva y vuelve a entrar', async ({
    aparato,
  }, info) => {
    test.setTimeout(10 * 60_000);
    const aparatos = new VariosAparatos(info, SLUG);
    try {
      const duena = await aparatos.abrir({
        puesto: 'finales-usuarios-duena',
        aparato: aparato.id,
        rol: 'dueno',
        ruta: '/',
      });
      const page = duena.page;
      await resetearLaDemo(page);
      const acceso = await aparatos.abrir({
        puesto: 'finales-usuarios-acceso',
        aparato: 'tableta-800x1280',
        ruta: `/n/${SLUG}/login-pos`,
      });
      const pantallaDeAcceso = acceso.page;
      await expect(tarjetaDeAcceso(pantallaDeAcceso, NOMBRE_NUEVO)).toHaveCount(0);

      // Alta con el dedo: nombre, puesto y PIN dos veces.
      await irASeccion(page, 'personas');
      const region = cardDe(page, 'Usuarios POS');
      await toque(page, region.getByRole('button', { name: 'Nuevo usuario' }));
      const dialogo = page.getByRole('dialog');
      await escribirEnCampo(page, dialogo.getByPlaceholder('Nombre del usuario'), NOMBRE_NUEVO);
      await toque(page, dialogo.getByRole('combobox', { name: 'Puesto' }));
      await toque(page, page.getByRole('option', { name: 'Mesero', exact: true }));
      const campos = dialogo.getByPlaceholder('••••');
      await escribirEnCampo(page, campos.nth(0), PIN_NUEVO);
      await escribirEnCampo(page, campos.nth(1), PIN_NUEVO);
      await capturar(page, 'usuarios-pos', aparato.id, '1-alta');
      const guardada = page.waitForResponse(
        (r) => r.request().method() === 'POST' && r.url().includes('/api/identidad/'),
      );
      await toque(page, dialogo.getByRole('button', { name: 'Guardar', exact: true }));
      expect((await guardada).ok()).toBe(true);
      const fila = page.getByTestId('fila-de-usuario').filter({ hasText: NOMBRE_NUEVO });
      await expect(fila).toBeVisible();
      await expect(fila).toContainText('Mesero');
      expect(
        sqlLocal(
          `select count(*) from empleos e join personas p on p.id = e.persona_id where p.nombre like '${comoSql(NOMBRE_NUEVO)}' and e.rol = 'mesero' and e.activo = true and e.${MI_NEGOCIO}`,
        ),
      ).toBe('1');
      // El PIN no se guarda en claro.
      expect(sqlLocal("select count(*) from credenciales_pin where pin_hash like '%8642%'")).toBe(
        '0',
      );

      // Entra en el otro aparato: toca su tarjeta y teclea su PIN; cae en la pantalla del mesero.
      await pantallaDeAcceso.reload();
      await toque(pantallaDeAcceso, tarjetaDeAcceso(pantallaDeAcceso, NOMBRE_NUEVO));
      await expect(pantallaDeAcceso.getByText(`Iniciando como: ${NOMBRE_NUEVO}`)).toBeVisible();
      await teclear(pantallaDeAcceso, PIN_NUEVO);
      await pantallaDeAcceso.waitForURL((url) => !url.pathname.endsWith('/login-pos'), {
        timeout: 30_000,
      });
      expect(new URL(pantallaDeAcceso.url()).pathname).toMatch(/mesero/);
      await capturar(pantallaDeAcceso, 'usuarios-pos', 'tableta-800x1280', '2-entra-con-su-pin');

      // Un PIN equivocado no entra (otra sesión, sin sesión previa).
      const otro = await aparatos.abrir({
        puesto: 'finales-usuarios-pin-malo',
        aparato: 'tableta-800x1280',
        ruta: `/n/${SLUG}/login-pos`,
      });
      await toque(otro.page, tarjetaDeAcceso(otro.page, NOMBRE_NUEVO));
      await teclear(otro.page, '1357');
      await expect(otro.page.getByText(/incorrecto|no es correcto|inválido/i).first()).toBeVisible({
        timeout: 15_000,
      });
      expect(new URL(otro.page.url()).pathname).toMatch(/login-pos/);

      // Desactivar: pide confirmación, la persona sale de la lista de acceso.
      await irASeccion(page, 'personas');
      const lista = cardDe(page, 'Usuarios POS');
      await toque(page, lista.getByRole('button', { name: `Desactivar a ${NOMBRE_NUEVO}` }));
      const confirmar = page.getByRole('alertdialog');
      await expect(confirmar.getByText(`¿Desactivar a ${NOMBRE_NUEVO}?`)).toBeVisible();
      await toque(page, confirmar.getByRole('button').last());
      await expect(
        page.getByTestId('fila-de-usuario').filter({ hasText: NOMBRE_NUEVO }),
      ).toHaveCount(0);
      expect(
        sqlLocal(
          `select count(*) from empleos e join personas p on p.id = e.persona_id where p.nombre like '${comoSql(NOMBRE_NUEVO)}' and e.activo = true and e.${MI_NEGOCIO}`,
        ),
      ).toBe('0');
      await otro.page.reload();
      await expect(tarjetaDeAcceso(otro.page, NOMBRE_NUEVO)).toHaveCount(0);

      // Reactivar: «Ver desactivados» → «Reactivar»; vuelve a la lista de acceso y entra con su PIN.
      await toque(
        page,
        cardDe(page, 'Usuarios POS').getByRole('button', { name: /desactivados/i }),
      );
      await toque(page, page.getByRole('button', { name: `Reactivar a ${NOMBRE_NUEVO}` }));
      await expect(
        page.getByTestId('fila-de-usuario').filter({ hasText: NOMBRE_NUEVO }),
      ).toBeVisible();
      await otro.page.reload();
      await toque(otro.page, tarjetaDeAcceso(otro.page, NOMBRE_NUEVO));
      await teclear(otro.page, PIN_NUEVO);
      await otro.page.waitForURL((url) => !url.pathname.endsWith('/login-pos'), {
        timeout: 30_000,
      });
      await capturar(otro.page, 'usuarios-pos', 'tableta-800x1280', '3-reactivado-entra');
    } finally {
      await aparatos.cerrar();
    }
  });

  test('mapa-de-mesas: arrastrar una mesa con el dedo guarda su posición en el servidor y la pantalla la recuerda', async ({
    aparato,
  }, info) => {
    test.setTimeout(8 * 60_000);
    const aparatos = new VariosAparatos(info, SLUG);
    try {
      const duena = await aparatos.abrir({
        puesto: 'finales-mapa-duena',
        aparato: aparato.id,
        rol: 'dueno',
        ruta: '/',
      });
      const page = duena.page;
      await resetearLaDemo(page);
      const posicion = (numero: number): { x: number; y: number } => {
        const [x, y] = sqlLocal(
          `select posicion_x || ',' || posicion_y from mesas where numero = ${String(numero)} and activa = true and ${MI_NEGOCIO} limit 1`,
        )
          .split(',')
          .map(Number);
        return { x: x ?? Number.NaN, y: y ?? Number.NaN };
      };
      const NUMERO = 1;
      const antes = posicion(NUMERO);
      expect(Number.isFinite(antes.x), 'la mesa 1 tiene posición').toBe(true);

      await irASeccion(page, 'salon');
      const region = cardDe(page, 'Mapa de mesas');
      const lienzo = region.locator('div.rounded-2xl.overflow-hidden.border-2').first();
      await lienzo.scrollIntoViewIfNeeded();
      await expect(lienzo).toBeVisible();
      await capturar(page, 'mapa-de-mesas', aparato.id, '1-antes');
      const caja = await lienzo.boundingBox();
      expect(caja).not.toBeNull();
      if (caja === null) return;
      // DP-22 · Lote 8: el lienzo se escala al ancho disponible (Windows 1366×768 al 125 % lo dejaba en
      // ~470 px y cortaba las mesas del fondo). Se declara en `data-escala`; sin el atributo es 1.
      const escala = Number((await lienzo.getAttribute('data-escala')) ?? '1');
      expect(escala).toBeGreaterThan(0.3);
      // Ninguna mesa queda cortada por el borde del lienzo, y el lienzo cabe a lo ancho de la pantalla.
      const cortadas = await lienzo.evaluate((el) => {
        const marco = el.getBoundingClientRect();
        return Array.from(el.children)
          .map((hijo) => ({ r: hijo.getBoundingClientRect(), t: (hijo.textContent ?? '').trim() }))
          .filter(
            ({ r }) =>
              r.right > marco.right + 1 ||
              r.bottom > marco.bottom + 1 ||
              r.left < marco.left - 1 ||
              r.top < marco.top - 1,
          )
          .map(({ t }) => t);
      });
      expect(cortadas, 'mesas cortadas por el borde del mapa').toEqual([]);
      const anchoDePantalla = page.viewportSize()?.width ?? 0;
      expect(caja.x + caja.width, 'el mapa cabe a lo ancho de la pantalla').toBeLessThanOrEqual(
        anchoDePantalla + 1,
      );
      // La mesa 1 está en (x, y) lógicos del plano: el dedo cae dentro de su recuadro (a la escala del mapa).
      const origen = {
        x: caja.x + (antes.x + 30) * escala,
        y: caja.y + (antes.y + 30) * escala,
      };
      const destino = { x: origen.x + 120, y: origen.y + 80 };
      const guardado = page.waitForResponse(
        (r) => r.request().method() === 'POST' && r.url().includes('/api/datos/escribir'),
      );
      await arrastrar(page, origen, destino);
      expect((await guardado).ok()).toBe(true);
      // El servidor tiene la coordenada LÓGICA nueva (el movimiento en pantalla dividido entre la
      // escala), no la de antes ni los píxeles de pantalla.
      await expect.poll(() => posicion(NUMERO).x).toBeGreaterThan(antes.x + 90 / escala);
      const despues = posicion(NUMERO);
      expect(Math.abs(despues.x - antes.x - 120 / escala)).toBeLessThan(30 / escala);
      expect(Math.abs(despues.y - antes.y - 80 / escala)).toBeLessThan(30 / escala);
      // Y la pantalla la recuerda al recargar: la mesa está donde se dejó.
      await page.reload();
      const lienzo2 = cardDe(page, 'Mapa de mesas')
        .locator('div.rounded-2xl.overflow-hidden.border-2')
        .first();
      await lienzo2.scrollIntoViewIfNeeded();
      const caja2 = await lienzo2.boundingBox();
      // `style.left` dice «123px»: se lee con parseFloat (con Number daba NaN y la prueba nunca veía la mesa).
      await expect
        .poll(
          () =>
            lienzo2.evaluate((el, p) => {
              const hijos = Array.from(el.children) as HTMLElement[];
              return hijos.some(
                (h) =>
                  Math.abs(Number.parseFloat(h.style.left) - p.x) < 2 &&
                  Math.abs(Number.parseFloat(h.style.top) - p.y) < 2,
              );
            }, despues),
          { message: 'la mesa se pinta en la posición guardada', timeout: 20_000 },
        )
        .toBe(true);
      expect(caja2).not.toBeNull();
      await capturar(page, 'mapa-de-mesas', aparato.id, '2-despues');

      // Devolverla (preparación: la demo queda como estaba).
      sqlLocal(
        `update mesas set posicion_x = ${String(antes.x)}, posicion_y = ${String(antes.y)} where numero = ${String(NUMERO)} and ${MI_NEGOCIO}`,
      );
    } finally {
      await aparatos.cerrar();
    }
  });
});
