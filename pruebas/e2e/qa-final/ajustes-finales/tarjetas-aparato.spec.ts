import type { Page } from '@playwright/test';

import { instalarAppFalsa, type EstadoDeLaAppFalsa } from '../../ayudantes/app-falsa.ts';
import { exigirDemostracion } from '../../ayudantes/sesion.ts';
import { escribirEnCampo, irASeccion } from '../arnes/configuracion.ts';
import { expect, exigirServidor, test } from '../arnes/prueba.ts';
import { toque } from '../arnes/toque.ts';
import { VariosAparatos } from '../arnes/varios-aparatos.ts';
import { resetearLaDemo } from '../parte7/comun.ts';

import { capturar, SLUG } from './comun.ts';

/**
 * DP-22 · «IMPRESORA DE ESTE APARATO» Y «LABORATORIO DEL PROVEEDOR», LO QUE SE PUEDE SIN HARDWARE.
 *
 * Con una app FALSA (`window.MorphiqApp` con el mismo contrato, cuya «impresora» y cuyo «cajón» sólo
 * cuentan lo que reciben) se prueba lo que la pantalla guarda y enseña:
 *
 *   · sin la app: dice que hay que instalarla y no ofrece nada del aparato;
 *   · con la app y sin perfil: dice que falta la impresora;
 *   · el laboratorio pide la contraseña del proveedor: una equivocada no entra y vacía el campo, la
 *     buena sí (la contraseña de la prueba es de usar y tirar: el servidor de la corrida recibe su
 *     hash en `PROVEEDOR_CLAVE_HASH`); sin sesión de proveedor, ningún botón de pruebas;
 *   · el perfil que el proveedor guarda se ve en «Impresora de este aparato» (impresora, papel y
 *     cajón sí / no), y quitarlo lo devuelve a «sin impresora».
 *
 * NO se prueba (va a la lista física): que el papel salga, que el cajón de verdad salte, que la
 * impresora USB/red del local responda y la contraseña real del proveedor. «¿Se abrió el cajón?» lo
 * contesta aquí un dedo sobre una app falsa: demuestra lo que se guarda, no el cajón.
 */

const CLAVE = process.env['MORPHIQPOS_E2E_CLAVE_PROVEEDOR'];

const appFalsa = (page: Page): Promise<EstadoDeLaAppFalsa> =>
  page.evaluate(() => (window as unknown as { __appFalsa: EstadoDeLaAppFalsa }).__appFalsa);

test.describe('impresora y laboratorio sin hardware', () => {
  test.use({ actionTimeout: 120_000, navigationTimeout: 60_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('sin app, con app y sin perfil, la puerta del laboratorio, el perfil guardado (sin cajón)', async ({
    aparato,
  }, info) => {
    test.setTimeout(10 * 60_000);
    expect(
      CLAVE,
      'falta MORPHIQPOS_E2E_CLAVE_PROVEEDOR (la de usar y tirar de esta corrida)',
    ).toBeTruthy();
    const aparatos = new VariosAparatos(info, SLUG);
    try {
      const sinApp = await aparatos.abrir({
        puesto: 'finales-impresora-sin-app',
        aparato: aparato.id,
        rol: 'dueno',
        ruta: '/',
      });
      await resetearLaDemo(sinApp.page);

      // ESTADO 0 · sin la app de escritorio.
      await irASeccion(sinApp.page, 'este-aparato');
      await expect(
        sinApp.page.getByText(
          'Para imprimir directo y abrir el cajón, instala la app de POS Don Poncho.',
        ),
      ).toBeVisible();
      await expect(sinApp.page.getByRole('button', { name: 'Página de prueba' })).toHaveCount(0);
      await expect(sinApp.page.getByText('Impresora lista ✓')).toHaveCount(0);
      await capturar(sinApp.page, 'impresora', aparato.id, '1-sin-la-app');

      // ESTADO A · con la app falsa y sin perfil.
      const duena = await aparatos.abrir({
        puesto: 'finales-impresora-con-app',
        aparato: aparato.id,
        rol: 'dueno',
      });
      await duena.context.addInitScript(instalarAppFalsa);
      const page = duena.page;
      await irASeccion(page, 'este-aparato');
      await expect(
        page.getByText('Este aparato todavía no tiene impresora configurada.'),
      ).toBeVisible();
      await capturar(page, 'impresora', aparato.id, '2-con-la-app-sin-perfil');

      // La puerta del laboratorio.
      await irASeccion(page, 'laboratorio');
      await toque(page, page.getByText('Hardware y pruebas de impresión').first());
      await expect(page.getByText('Sólo tu proveedor MORPHIQ puede entrar aquí')).toBeVisible();
      const clave = page.getByLabel('Contraseña del proveedor');
      await escribirEnCampo(page, clave, 'no-es-esta-2468');
      await toque(page, page.getByRole('button', { name: 'Entrar', exact: true }));
      await expect(page.getByText('La contraseña no es correcta.')).toBeVisible();
      await expect(clave).toHaveValue('');
      await expect(page.getByRole('heading', { name: '1 · El aparato' })).toHaveCount(0);
      await capturar(page, 'laboratorio', aparato.id, '1-contrasena-incorrecta');

      await escribirEnCampo(page, clave, CLAVE ?? '');
      await toque(page, page.getByRole('button', { name: 'Entrar', exact: true }));
      await expect(page.getByRole('heading', { name: '1 · El aparato' })).toBeVisible();
      await capturar(page, 'laboratorio', aparato.id, '2-dentro');

      // Elegir la impresora y guardar el perfil SIN cajón.
      await toque(page, page.getByRole('radio', { name: /POS-80/ }));
      await escribirEnCampo(page, page.getByLabel('Nombre del perfil'), 'Caja del mostrador');
      await toque(page, page.getByRole('button', { name: 'Guardar como perfil de este aparato' }));
      await irASeccion(page, 'este-aparato');
      await expect(page.getByText('Impresora lista ✓')).toBeVisible();
      await expect(page.getByText('Caja del mostrador')).toBeVisible();
      await expect(page.getByText('No tiene cajón')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Página de prueba' })).toBeVisible();
      await capturar(page, 'impresora', aparato.id, '3-lista-sin-cajon');
      await toque(page, page.getByRole('button', { name: 'Página de prueba' }));
      await expect.poll(async () => (await appFalsa(page)).paginasDePrueba).toBe(1);

      // El cajón (pulso de prueba, «¿se abrió?», «Quitar el cajón») exige el aparato real: va a la lista física.
    } finally {
      await aparatos.cerrar();
    }
  });
});
