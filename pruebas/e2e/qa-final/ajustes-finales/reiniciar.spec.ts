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

/**
 * El mantenimiento destructivo tiene límite de tasa: TRES por hora y por origen (`ejecutarMantenimiento`),
 * y un nombre mal escrito cuenta. La prueba hace cuatro intentos seguidos, así que antes de cada uno que
 * debe prosperar vacía el contador de ESTA base desechable (el límite en sí es lo que se quiere).
 */
const liberarElLimite = (): void => {
  sqlLocal('delete from limite_tasa');
};

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
    // DP-22 · Lote 8: el resto de lo que la pantalla promete borrar o conservar.
    insumos: contar('insumos', filtro),
    existencias: contar('existencias', filtro),
    recetas: contar('recetas', filtro),
    categorias: contar('categorias', filtro),
    modificadores: contar('modificadores', filtro),
    zonas: contar('zonas', filtro),
    menu_qr_secciones: contar('menu_qr_secciones', filtro),
    movimientos_stock: contar('movimientos_stock', filtro),
    compras: contar('compras', filtro),
    gastos: contar('gastos', filtro),
    cortes_turno: contar('cortes_turno', filtro),
    sesiones_caja: contar('sesiones_caja', filtro),
    solicitudes_qr: contar('solicitudes_qr', filtro),
    sucursales: contar('sucursales', filtro),
    estaciones_preparacion: contar('estaciones_preparacion', filtro),
  };
}

/** Lo guardado en `configuracion.valores` del negocio (texto): para decir si cambió. */
const valoresDeConfiguracion = (): string =>
  sqlLocal(`select valores::text from configuracion where ${MI_NEGOCIO}`);

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
      liberarElLimite();
      expect(antes['ordenes'], 'hay una cuenta que borrar').toBeGreaterThan(0);
      expect(antes['productos']).toBeGreaterThan(0);
      expect(antes['mesas']).toBeGreaterThan(0);

      async function abrirDialogo(boton: string): Promise<void> {
        await irASeccion(page, 'mantenimiento');
        const region = cardDe(page, 'Reiniciar sistema para cliente');
        await expect(region).toBeVisible();
        // Lo que la pantalla promete debe ser lo que el comando hace: no resetea la configuración.
        await expect(region).toContainText('Conserva la configuración del negocio');
        await expect(region).not.toContainText('Resetea la configuración');
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
      liberarElLimite();
      const respuestaDePruebas = page.waitForResponse(
        (r) =>
          r.url().includes('/api/mantenimiento/reiniciar-pruebas') &&
          r.request().method() === 'POST',
        { timeout: 60_000 },
      );
      await toque(page, dentro.getByRole('button', { name: /^Sí, borrar/ }).last());
      const respuestaP = await respuestaDePruebas;
      expect(respuestaP.status(), (await respuestaP.text()).slice(0, 400)).toBe(200);
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
      const antesDeTodo = foto(MI_NEGOCIO);
      const valoresAntes = valoresDeConfiguracion();
      const auditoriaAntes = contar('auditoria', MI_NEGOCIO);
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await abrirDialogo('Borrar todos los datos del sistema');
      await expect(page.getByRole('dialog')).toContainText(
        'La configuración del negocio, la gente y sus usuarios se conservan',
      );
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
      liberarElLimite();
      // La respuesta del servidor se mira de verdad (no sólo el efecto en la base).
      const respuestaDeTodo = page.waitForResponse(
        (r) =>
          r.url().includes('/api/mantenimiento/reiniciar-todo') && r.request().method() === 'POST',
        { timeout: 60_000 },
      );
      await toque(
        page,
        page
          .getByRole('dialog')
          .getByRole('button', { name: /^Sí, borrar/ })
          .last(),
      );
      const respuesta = await respuestaDeTodo;
      expect(respuesta.status(), (await respuesta.text()).slice(0, 400)).toBe(200);
      await expect.poll(() => contar('productos', MI_NEGOCIO), { timeout: 60_000 }).toBe(0);
      const trasTodo = foto(MI_NEGOCIO);
      expect(trasTodo['mesas'], 'se van las mesas').toBe(0);
      expect(
        trasTodo['empleos'],
        'se queda quien lo hizo (y su gente de plataforma)',
      ).toBeGreaterThan(0);
      expect(foto(OTRO_NEGOCIO), 'el otro negocio no se toca').toEqual(delOtro);
      // Qué borró y qué NO, contando filas antes y después (queda en el informe de la prueba).
      const resumen = JSON.stringify({
        antes: antesDeTodo,
        despues: trasTodo,
        configuracionCambio: valoresDeConfiguracion() !== valoresAntes,
      });
      info.annotations.push({ type: 'borrar-todo', description: resumen });
      process.stdout.write(`borrar-todo ${resumen}
`);
      // Lo que la pantalla promete borrar: el catálogo, el inventario y lo transaccional, a cero.
      for (const tabla of [
        'productos',
        'mesas',
        'insumos',
        'existencias',
        'recetas',
        'categorias',
        'modificadores',
        'proveedores',
        'menu_qr_secciones',
        'movimientos_stock',
        'compras',
        'gastos',
        'cortes_turno',
        'sesiones_caja',
        'solicitudes_qr',
        'ordenes',
      ]) {
        expect(trasTodo[tabla], `se va ${tabla}`).toBe(0);
      }
      // Lo que debe quedar: la organización y su sucursal, la gente, la estación general y las zonas de fábrica.
      expect(trasTodo['sucursales'], 'se queda la sucursal').toBe(antesDeTodo['sucursales']);
      expect(trasTodo['empleos'], 'se queda la gente').toBe(antesDeTodo['empleos']);
      expect(trasTodo['estaciones_preparacion'], 'queda la estación general').toBeGreaterThan(0);
      expect(trasTodo['zonas'], 'se vuelven a sembrar las zonas de fábrica').toBe(5);
      expect(contar('auditoria', MI_NEGOCIO), 'el borrado deja su rastro').toBeGreaterThan(
        auditoriaAntes,
      );
      await capturar(page, 'reiniciar', aparato.id, '4-tras-borrar-todo');

      // Y la app queda usable: el salón vacío ofrece «Crear primera mesa» y el diálogo abre.
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await irASeccion(page, 'salon');
      await expect(page.getByText('No hay mesas configuradas')).toBeVisible();
      await toque(page, page.getByRole('button', { name: 'Crear primera mesa' }));
      await expect(page.getByRole('dialog')).toBeVisible();
      await capturar(page, 'reiniciar', aparato.id, '5-salon-vacio-usable');
    } finally {
      await aparatos.cerrar();
    }
  });
});
