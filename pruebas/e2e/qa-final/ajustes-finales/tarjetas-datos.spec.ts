import { readFileSync } from 'node:fs';

import type { Download, Locator } from '@playwright/test';

import { exigirDemostracion } from '../../ayudantes/sesion.ts';
import { escribirEnCampo, irASeccion } from '../arnes/configuracion.ts';
import { expect, exigirServidor, test } from '../arnes/prueba.ts';
import { toque } from '../arnes/toque.ts';
import { VariosAparatos } from '../arnes/varios-aparatos.ts';
import { resetearLaDemo, sqlLocal } from '../parte7/comun.ts';

import { capturar, cardDe, comoSql, MI_NEGOCIO, SLUG } from './comun.ts';

/**
 * DP-22 · LAS TARJETAS DE DATOS Y PROVEEDORES, DE PUNTA A PUNTA Y CON EL DEDO.
 *
 *   proveedores · exportar · importar
 *
 * La dueña (Windows 1366×768 al 125 %) crea un proveedor y lo ve donde se usa (el registro de una
 * compra); exporta lo que hay y cuenta las filas del archivo que bajó; importa un archivo suyo (lo
 * que se previsualiza no se guarda hasta confirmar) y vuelve a exportar: las cuentas tienen que
 * cuadrar con lo que el servidor tiene, contado en la base.
 */

const PROVEEDORES_EN_LA_BASE = `select count(*) from proveedores where activo = true and ${MI_NEGOCIO}`;

const enLaBase = (): number => Number(sqlLocal(PROVEEDORES_EN_LA_BASE));

/** Las filas de un CSV exportado (sin la cabecera); el archivo lleva BOM y comillas de Excel. */
function filasDe(texto: string): string[][] {
  const limpio = texto.startsWith(String.fromCharCode(0xfeff)) ? texto.slice(1) : texto;
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let entreComillas = false;
  for (let i = 0; i < limpio.length; i += 1) {
    const c = limpio.charAt(i);
    if (entreComillas) {
      if (c === '"' && limpio.charAt(i + 1) === '"') {
        celda += '"';
        i += 1;
      } else if (c === '"') entreComillas = false;
      else celda += c;
    } else if (c === '"') entreComillas = true;
    else if (c === ',') {
      fila.push(celda);
      celda = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpio.charAt(i + 1) === '\n') i += 1;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = '';
    } else celda += c;
  }
  if (celda !== '' || fila.length > 0) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas;
}

async function leerDescarga(descarga: Download): Promise<string> {
  const ruta = await descarga.path();
  return readFileSync(ruta, 'utf8');
}

/** El bloque de «Exportar datos actuales» con ese título (su fila con el botón CSV). */
function bloqueDeExportar(region: Locator, titulo: string): Locator {
  return region
    .getByText(titulo, { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"flex items-start gap-3")][1]');
}

test.describe('proveedores, exportar e importar', () => {
  test.use({ actionTimeout: 120_000, navigationTimeout: 60_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('proveedores: se crea con el dedo, se ofrece al registrar una compra, se edita y al desactivarlo deja de ofrecerse', async ({
    aparato,
  }, info) => {
    test.setTimeout(8 * 60_000);
    const aparatos = new VariosAparatos(info, SLUG);
    try {
      const duena = await aparatos.abrir({
        puesto: 'finales-proveedores',
        aparato: aparato.id,
        rol: 'dueno',
        ruta: '/',
      });
      const page = duena.page;
      await resetearLaDemo(page);
      const antes = enLaBase();

      const alRegistrarUnaCompra = async (): Promise<string[]> => {
        await page.goto('/compras', { waitUntil: 'domcontentloaded' });
        await toque(page, page.getByText('Registrar compra', { exact: true }).first());
        const dialogo = page.getByRole('dialog');
        await expect(dialogo).toBeVisible();
        const selector = dialogo
          .getByText('Proveedor', { exact: true })
          .locator('xpath=following::button[@role="combobox"][1]');
        await toque(page, selector);
        const opciones = await page.getByRole('option').allInnerTexts();
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');
        return opciones.map((o) => o.trim());
      };

      // Antes: ninguno de los nuestros se ofrece.
      expect((await alRegistrarUnaCompra()).some((o) => o.includes('Carnicería Los Arcos'))).toBe(
        false,
      );

      // Crear con el dedo.
      await irASeccion(page, 'productos');
      const region = cardDe(page, 'Proveedores');
      await toque(page, region.getByRole('button', { name: 'Nuevo' }));
      const dialogo = page.getByRole('dialog');
      await escribirEnCampo(
        page,
        dialogo.getByPlaceholder('Ej: Carnicería La Barranca'),
        'Carnicería Los Arcos',
      );
      await escribirEnCampo(page, dialogo.getByPlaceholder('Opcional').nth(0), 'Doña Tere');
      await escribirEnCampo(page, dialogo.getByPlaceholder('Opcional').nth(1), '55 2468 1357');
      const respuesta = page.waitForResponse(
        (r) => r.request().method() === 'POST' && r.url().includes('/api/datos/escribir'),
      );
      await toque(page, dialogo.getByRole('button', { name: 'Guardar', exact: true }));
      expect((await respuesta).ok()).toBe(true);
      await expect(
        region.locator('p.font-medium', { hasText: 'Carnicería Los Arcos' }),
      ).toBeVisible();
      await expect(region.getByText('Doña Tere')).toBeVisible();
      expect(enLaBase()).toBe(antes + 1);
      await capturar(page, 'proveedores', aparato.id, '1-creado');

      // Se usa: el registro de una compra lo ofrece.
      expect((await alRegistrarUnaCompra()).some((o) => o.includes('Carnicería Los Arcos'))).toBe(
        true,
      );

      // Se edita: el nombre cambia en la lista y en la base.
      await irASeccion(page, 'productos');
      const lista = cardDe(page, 'Proveedores');
      await toque(
        page,
        lista
          .locator('div.rounded-lg', { hasText: 'Doña Tere' })
          .getByRole('button', { name: 'Editar' }),
      );
      const edicion = page.getByRole('dialog');
      await escribirEnCampo(
        page,
        edicion.getByPlaceholder('Ej: Carnicería La Barranca'),
        'Carnicería El Pirul',
      );
      const guardada = page.waitForResponse(
        (r) => r.request().method() === 'POST' && r.url().includes('/api/datos/escribir'),
      );
      await toque(page, edicion.getByRole('button', { name: 'Guardar', exact: true }));
      expect((await guardada).ok()).toBe(true);
      await expect(
        lista.locator('p.font-medium', { hasText: 'Carnicería El Pirul' }),
      ).toBeVisible();
      expect(
        sqlLocal(
          `select count(*) from proveedores where nombre like '${comoSql('Carnicería El Pirul')}' and ${MI_NEGOCIO}`,
        ),
      ).toBe('1');

      // Se desactiva (no se borra): sale de la lista y de la compra, la fila sigue en la base.
      await toque(
        page,
        lista
          .locator('div.rounded-lg', { hasText: 'Doña Tere' })
          .getByRole('button', { name: 'Desactivar' }),
      );
      const confirmar = page.getByRole('alertdialog');
      const desactivada = page.waitForResponse(
        (r) => r.request().method() === 'POST' && r.url().includes('/api/datos/escribir'),
      );
      await toque(page, confirmar.getByRole('button').last());
      expect((await desactivada).ok()).toBe(true);
      await page.waitForTimeout(2500);
      process.stdout
        .write(`[prov] en la base: ${sqlLocal(`select activo from proveedores where nombre like '${comoSql('Carnicería El Pirul')}' and ${MI_NEGOCIO}`)}
`);
      await capturar(page, 'proveedores', aparato.id, '2-tras-desactivar');
      await expect(lista.locator('p.font-medium', { hasText: 'Carnicería El Pirul' })).toHaveCount(
        0,
      );
      expect(enLaBase()).toBe(antes);
      expect(
        sqlLocal(
          `select count(*) from proveedores where nombre like '${comoSql('Carnicería El Pirul')}' and ${MI_NEGOCIO}`,
        ),
      ).toBe('1');
      expect((await alRegistrarUnaCompra()).some((o) => o.includes('El Rosal'))).toBe(false);
    } finally {
      await aparatos.cerrar();
    }
  });

  test('exportar e importar: el CSV que baja trae las filas de la base; el que se sube se previsualiza sin guardar, al confirmar entra, y vuelve a salir', async ({
    aparato,
  }, info) => {
    test.setTimeout(10 * 60_000);
    const aparatos = new VariosAparatos(info, SLUG);
    try {
      const duena = await aparatos.abrir({
        puesto: 'finales-datos',
        aparato: aparato.id,
        rol: 'dueno',
        ruta: '/',
      });
      const page = duena.page;
      await resetearLaDemo(page);
      const todos = (): number =>
        Number(sqlLocal(`select count(*) from proveedores where ${MI_NEGOCIO}`));
      const base0 = todos();

      async function exportarProveedores(): Promise<string[][]> {
        await irASeccion(page, 'datos');
        const region = cardDe(page, 'Exportar datos actuales');
        const boton = bloqueDeExportar(region, 'Proveedores').getByRole('button', { name: 'CSV' });
        await boton.scrollIntoViewIfNeeded();
        const bajada = page.waitForEvent('download');
        await toque(page, boton);
        const descarga = await bajada;
        expect(descarga.suggestedFilename()).toMatch(/^proveedores_POS_MH_\d{4}-\d{2}-\d{2}\.csv$/);
        return filasDe(await leerDescarga(descarga));
      }

      // Exportar con proveedores en la base (el reseteo de la demo trae algunos, o no: se sabe contando).
      // Para que haya algo que contar, se importa primero un archivo propio de tres proveedores.
      const nuevos = [
        [
          'Abarrotes La Cañada',
          'Tomás Rivas',
          '55 1357 2468',
          'ventas@canada.example',
          'entrega martes',
          'sí',
        ],
        ['Verduras San Isidro', 'Lupe Mora', '55 8642 9753', 'pedidos@sanisidro.example', '', 'sí'],
        ['Lácteos del Valle', '', '55 3579 1468', '', 'sólo efectivo', 'sí'],
      ] as const;
      const encabezado = 'nombre,contacto,telefono,correo,notas,activo';
      const csv = [encabezado, ...nuevos.map((f) => f.join(','))].join('\n');
      // El mismo archivo con una fila repetida: la vista previa lo marca como error.
      const csvConError = [csv, 'Verduras San Isidro,Otra,55 0000 1111,,,sí'].join('\n');

      await irASeccion(page, 'datos');
      const importar = cardDe(page, 'Importar datos desde archivo');
      const bloque = importar
        .getByText('Proveedores', { exact: true })
        .locator('xpath=ancestor::div[contains(@class,"flex items-start gap-3")][1]');
      await bloque.scrollIntoViewIfNeeded();

      /** Abre «Importar» de proveedores y elige el archivo con el dedo: queda en la vista previa. */
      async function conArchivo(contenido: string): Promise<Locator> {
        await toque(page, bloque.getByRole('button', { name: 'Importar' }));
        const dialogo = page.getByRole('dialog');
        await expect(dialogo.getByText('Importar proveedores')).toBeVisible();
        const selector = page.waitForEvent('filechooser');
        await toque(page, dialogo.getByRole('button', { name: 'Elegir archivo' }));
        await (
          await selector
        ).setFiles({
          name: 'proveedores-nuevos.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(contenido, 'utf8'),
        });
        await expect(dialogo.getByText('Abarrotes La Cañada').first()).toBeVisible();
        return dialogo;
      }

      // 1 · Con un error en el archivo: no se puede confirmar y no entra nada.
      const malo = await conArchivo(csvConError);
      await expect(malo.getByText(/repetido en el mismo archivo/i)).toBeVisible();
      await expect(malo.getByRole('button', { name: 'Confirmar importación' })).toBeEnabled();
      expect(todos(), 'un archivo con errores no aplica nada').toBe(base0);
      await capturar(page, 'importar', aparato.id, '1-archivo-con-error');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);

      // 2 · El archivo bueno: la vista previa no guarda; "Volver" y cerrar tampoco.
      const bueno = await conArchivo(csv);
      expect(todos(), 'la vista previa no guarda nada').toBe(base0);
      await capturar(page, 'importar', aparato.id, '2-vista-previa');
      await toque(page, bueno.getByRole('button', { name: 'Volver' }));
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(todos()).toBe(base0);

      // 3 · Confirmar (con el archivo que trae la fila repetida): entran los tres, y la fila repetida NO entra.
      const confirmado = await conArchivo(csvConError);
      await toque(page, confirmado.getByRole('button', { name: 'Confirmar importación' }));
      await expect(page.getByText('Importación completada').first()).toBeVisible({
        timeout: 30_000,
      });
      await capturar(page, 'importar', aparato.id, '3-reporte');
      expect(todos(), 'entraron los tres y sólo los tres').toBe(base0 + 3);
      expect(
        sqlLocal(
          `select count(*) from proveedores where (nombre like '${comoSql('Abarrotes La Cañada')}' or nombre like 'Verduras San Isidro' or nombre like '${comoSql('Lácteos del Valle')}') and ${MI_NEGOCIO}`,
        ),
      ).toBe('3');
      await toque(page, page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).first());

      // 4 · El MISMO archivo otra vez no duplica: la vista previa dice que los actualizará.
      const otraVez = await conArchivo(csv);
      await expect(otraVez.getByText(/Se actualizará/).first()).toBeVisible();
      await page.keyboard.press('Escape');
      expect(todos()).toBe(base0 + 3);

      // Exportar: el archivo trae una fila por proveedor de la base (activos e inactivos), con los de ahora.
      const filas = await exportarProveedores();
      const [cabecera, ...cuerpo] = filas;
      expect(cabecera).toEqual([
        'id',
        'nombre',
        'contacto',
        'telefono',
        'correo',
        'notas',
        'activo',
      ]);
      expect(cuerpo.length, 'una fila por proveedor de la base').toBe(todos());
      const porNombre = new Map(cuerpo.map((f) => [f[1], f]));
      for (const [nombre, contacto, telefono] of nuevos) {
        const fila = porNombre.get(nombre);
        expect(fila, `el archivo trae a «${nombre}»`).toBeDefined();
        expect(fila?.[2]).toBe(contacto);
        expect(fila?.[3]).toBe(telefono);
        expect(fila?.[6]).toBe('sí');
      }

      // «Exportar TODO el respaldo»: un archivo por bloque con datos, y el aviso lo cuenta.
      const region = cardDe(page, 'Exportar datos actuales');
      const descargas: string[] = [];
      page.on('download', (d) => {
        descargas.push(d.suggestedFilename());
      });
      await toque(page, region.getByRole('button', { name: /Exportar TODO el respaldo/ }));
      await expect(page.getByText(/Respaldo completo: \d+ archivo/)).toBeVisible({
        timeout: 60_000,
      });
      const dicho = Number(
        /Respaldo completo: (\d+) archivo/.exec(await page.locator('body').innerText())?.[1],
      );
      expect(descargas.length, 'el aviso dice los archivos que de verdad bajaron').toBe(dicho);
      expect(descargas.some((n) => n.startsWith('proveedores_POS_MH_'))).toBe(true);
      await capturar(page, 'exportar', aparato.id, '1-respaldo-completo');
    } finally {
      await aparatos.cerrar();
    }
  });
});
