import { spawnSync } from 'node:child_process';

import { CARTA } from '../../ayudantes/mesas-heredadas.ts';
import { exigirDemostracion } from '../../ayudantes/sesion.ts';
import { escribirEnCampo, irASeccion } from '../arnes/configuracion.ts';
import { expect, exigirServidor, test } from '../arnes/prueba.ts';
import { toque } from '../arnes/toque.ts';
import { VariosAparatos } from '../arnes/varios-aparatos.ts';
import { mesaConPedido, resetearLaDemo, sqlLocal } from '../parte7/comun.ts';

import { capturar, cardDe, guardado, MI_NEGOCIO, SLUG } from './comun.ts';

/**
 * DP-22 · «REINICIAR SISTEMA PARA CLIENTE», SÓLO SOBRE LA BASE DESECHABLE DE ESTA PRUEBA.
 *
 * Corre ÚLTIMO (deja la demo vacía: la siguiente prueba tiene que volver a resetearla). Contra la base
 * local `morphiqpos_desechable` del clúster de la prueba; `sqlLocal` se niega con cualquier otra URL.
 *
 * La persona de plataforma se marca con el guion de siempre (`scripts/marcar-plataforma.mjs`, que no
 * tiene ruta HTTP) sobre el negocio de prueba. Se mira, contando filas, qué borra cada botón y qué
 * conserva; y que el otro negocio de la base (`prueba-restaurante-dos`) no se toca.
 */

const OTRO_NEGOCIO =
  "organizacion_id = (select id from organizaciones where slug = 'prueba-restaurante-dos')";

function marcarPlataforma(): void {
  const url = process.env['DATABASE_URL'] ?? '';
  if (!/^postgres:\/\/[^@]*@(localhost|127\.0\.0\.1):\d+\//.test(url)) {
    throw new Error('Sólo contra la base desechable local.');
  }
  const salida = spawnSync(
    process.execPath,
    [
      '--conditions=react-server',
      'scripts/marcar-plataforma.mjs',
      '--org',
      SLUG,
      '--persona',
      'Dueña de prueba',
    ],
    { encoding: 'utf8', env: { ...process.env, DATABASE_URL: url } },
  );
  expect(salida.status, `${salida.stdout}\n${salida.stderr}`).toBe(0);
}

const contar = (tabla: string, filtro: string): number =>
  Number(sqlLocal(`select count(*) from ${tabla} where ${filtro}`));

function foto(filtro: string): Record<string, number> {
  return {
    ordenes: contar('ordenes', filtro),
    productos: contar('productos', filtro),
    mesas: contar('mesas', filtro),
    empleos: contar('empleos', filtro),
    proveedores: contar('proveedores', filtro),
    configuracion: contar('configuracion', filtro),
  };
}

test.describe('reiniciar sistema', () => {
  test.use({ actionTimeout: 120_000, navigationTimeout: 60_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('«Borrar solo ventas y pruebas» conserva el catálogo y «Borrar todos los datos» lo vacía; los dos piden el nombre del negocio y no tocan al otro negocio', async ({
    aparato,
  }, info) => {
    test.setTimeout(12 * 60_000);
    const aparatos = new VariosAparatos(info, SLUG);
    try {
      const inicio = await aparatos.abrir({
        puesto: 'finales-reiniciar-inicio',
        aparato: aparato.id,
        rol: 'dueno',
        ruta: '/',
      });
      await resetearLaDemo(inicio.page);
      marcarPlataforma();
      // Una cuenta vendida de verdad: algo que «ventas y pruebas» tenga que borrar.
      const { ordenId } = await mesaConPedido(inicio.page, inicio.page, 5, [
        { nombre: CARTA.arrachera.nombre },
      ]);
      expect(ordenId).toBeTruthy();
      const nombreDelNegocio = String(await guardado(inicio.page, 'nombre_negocio'));
      expect(nombreDelNegocio.length).toBeGreaterThan(2);

      // La persona de plataforma entra de nuevo (la marca se lee al entrar).
      const duena = await aparatos.abrir({
        puesto: 'finales-reiniciar-plataforma',
        aparato: aparato.id,
        rol: 'dueno',
        ruta: '/',
      });
      const page = duena.page;
      const antes = foto(MI_NEGOCIO);
      const delOtro = foto(OTRO_NEGOCIO);
      expect(antes['ordenes'], 'hay una cuenta que borrar').toBeGreaterThan(0);
      expect(antes['productos']).toBeGreaterThan(0);
      expect(antes['mesas']).toBeGreaterThan(0);

      async function abrirDialogo(boton: string): Promise<void> {
        await irASeccion(page, 'mantenimiento');
        const region = cardDe(page, 'Reiniciar sistema para cliente');
        await expect(region).toBeVisible();
        await toque(page, region.getByRole('button', { name: boton, exact: true }));
        await expect(page.getByRole('dialog')).toBeVisible();
      }

      // 1 · «Borrar solo ventas y pruebas», con el nombre equivocado: nada se borra y lo dice.
      const dentro = page.getByRole('dialog');
      await abrirDialogo('Borrar solo ventas y pruebas');
      const campo = dentro.getByRole('textbox');
      await escribirEnCampo(page, campo, 'Otro Negocio Cualquiera');
      await capturar(page, 'reiniciar', aparato.id, '1-pide-el-nombre');
      await toque(page, dentro.getByRole('button', { name: /^Sí, borrar/ }).last());
      await page.waitForTimeout(2500);
      expect(foto(MI_NEGOCIO), 'con el nombre equivocado no se borra nada').toEqual(antes);
      await capturar(page, 'reiniciar', aparato.id, '2-nombre-equivocado');

      // 2 · Con el nombre bien: se van las cuentas; el catálogo, las mesas, la gente y la configuración se quedan.
      await escribirEnCampo(page, campo, nombreDelNegocio);
      await toque(page, dentro.getByRole('button', { name: /^Sí, borrar/ }).last());
      await expect.poll(() => contar('ordenes', MI_NEGOCIO), { timeout: 60_000 }).toBe(0);
      const trasPruebas = foto(MI_NEGOCIO);
      expect(trasPruebas['productos'], 'conserva los productos').toBe(antes['productos']);
      expect(trasPruebas['mesas'], 'conserva las mesas').toBe(antes['mesas']);
      expect(trasPruebas['empleos'], 'conserva a la gente').toBe(antes['empleos']);
      expect(trasPruebas['configuracion'], 'conserva la configuración').toBe(
        antes['configuracion'],
      );
      expect(foto(OTRO_NEGOCIO), 'el otro negocio no se toca').toEqual(delOtro);
      await capturar(page, 'reiniciar', aparato.id, '3-tras-borrar-ventas');

      // 3 · «Borrar todos los datos del sistema»: se van el catálogo y las mesas; se queda quien lo hizo.
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await abrirDialogo('Borrar todos los datos del sistema');
      const campo2 = page.getByRole('dialog').getByRole('textbox');
      await escribirEnCampo(page, campo2, 'Otro Negocio Cualquiera');
      await toque(
        page,
        page
          .getByRole('dialog')
          .getByRole('button', { name: /^Sí, borrar/ })
          .last(),
      );
      await page.waitForTimeout(2500);
      expect(contar('productos', MI_NEGOCIO), 'nombre equivocado: sigue el catálogo').toBe(
        antes['productos'],
      );
      await escribirEnCampo(page, campo2, nombreDelNegocio);
      await toque(
        page,
        page
          .getByRole('dialog')
          .getByRole('button', { name: /^Sí, borrar/ })
          .last(),
      );
      await expect.poll(() => contar('productos', MI_NEGOCIO), { timeout: 60_000 }).toBe(0);
      const trasTodo = foto(MI_NEGOCIO);
      expect(trasTodo['mesas'], 'se van las mesas').toBe(0);
      expect(
        trasTodo['empleos'],
        'se queda quien lo hizo (y su gente de plataforma)',
      ).toBeGreaterThan(0);
      expect(foto(OTRO_NEGOCIO), 'el otro negocio no se toca').toEqual(delOtro);
      await capturar(page, 'reiniciar', aparato.id, '4-tras-borrar-todo');
    } finally {
      await aparatos.cerrar();
    }
  });
});
