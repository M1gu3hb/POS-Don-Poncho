import { spawnSync } from 'node:child_process';

import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  abrirElQrDeLaMesa,
  abrirLaCaja,
  botonDeLaMesa,
  CARTA,
  comandasDeLaCuenta,
  dialogoDeLaMesa,
  laMesa,
  prepararElPortalDelComensal,
  type TelefonoDelComensal,
  unidadesEsperadas,
  unidadesPorPlatillo,
  yaAbierto,
} from './ayudantes/mesas-heredadas.ts';
import { sesionDeLaCaja } from './ayudantes/conciliacion.ts';
import { enviarElPedidoDeLaMesa } from './ayudantes/pedido-de-la-mesa.ts';
import { Equipo } from './ayudantes/roles.ts';
import {
  cabecerasDeEscrituraDePrueba,
  consultarPuente,
  exigirDemostracion,
  vigilarFallos,
} from './ayudantes/sesion.ts';

/**
 * DP-25 · Parte 8.2 · EL JUGO «MIXTO», EN EL NAVEGADOR (con dedo).
 *
 * Se arma el «Jugo» como está en producción (grupo «Sabor del jugo», único y obligatorio, con
 * Naranja y Zanahoria), se corre el guion `agregar-jugo-mixto-produccion.mjs` (ensayo, real y otra
 * vez real: no duplica) y se comprueba que «Mixto» se ve y se elige en el portal del comensal, en el
 * mesero y en la Caja, y que llega a la comanda, a la cuenta y al ticket.
 */

const SLUG = 'prueba-restaurante';
const DUENO = 'Dueña de prueba';
const MESA = 6;
const ZONA = 'Interior';
const MESERO = 'Lupita';
const GRUPO = 'Sabor del jugo';
const JUGO = 'Jugo';
const FONDO_CENTAVOS = 150_000;

interface Sobre {
  readonly ok?: boolean;
  readonly datos?: Record<string, unknown>;
}

async function comando(page: Page, ruta: string, datos: Record<string, unknown>): Promise<Sobre> {
  const respuesta = await page.request.post(ruta, {
    headers: cabecerasDeEscrituraDePrueba(),
    data: datos,
    timeout: 120_000,
  });
  const cuerpo = (await respuesta.json().catch(() => ({}))) as Sobre;
  expect(respuesta.ok(), `${ruta}: ${JSON.stringify(cuerpo)}`).toBe(true);
  return cuerpo;
}

/** El guion de producción, contra la base DESECHABLE de la prueba (nunca otra). */
function correrElGuion(ensayo: boolean): string {
  const url = process.env['DATABASE_URL'] ?? '';
  if (!/^postgres:\/\/[^@]*@(localhost|127\.0\.0\.1):\d+\//.test(url)) {
    throw new Error('Sólo contra la base desechable local.');
  }
  const salida = spawnSync(
    process.execPath,
    [
      '--conditions=react-server',
      'scripts/agregar-jugo-mixto-produccion.mjs',
      '--negocio',
      SLUG,
      '--persona',
      DUENO,
      ...(ensayo ? ['--ensayo'] : []),
    ],
    { encoding: 'utf8', env: { ...process.env, DATABASE_URL: url } },
  );
  expect(salida.status, `${salida.stdout}\n${salida.stderr}`).toBe(0);
  return salida.stdout;
}

/** Las opciones del grupo en el servidor (la biblioteca de grupos). */
async function opcionesDelGrupo(duena: Page): Promise<readonly { id: string; nombre: string }[]> {
  const cuerpo = await comando(duena, '/api/catalogo/grupos-de-opciones', {});
  const grupos = (cuerpo.datos?.['grupos'] ?? cuerpo.datos) as readonly {
    nombre: string;
    opciones: readonly { id: string; nombre: string }[];
  }[];
  return grupos.find((g) => g.nombre === GRUPO)?.opciones ?? [];
}

test.describe('el jugo Mixto', () => {
  test.use({ actionTimeout: 30_000, navigationTimeout: 60_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('el guion agrega «Mixto» sin duplicar y se elige en el portal, el mesero y la Caja', async ({
    browser,
  }, info) => {
    test.setTimeout(12 * 60_000);
    const pulsar = (objetivo: Locator) =>
      info.project.use.hasTouch === true ? objetivo.tap() : objetivo.click();
    const equipo = new Equipo(browser, SLUG);
    const fallos: (() => void)[] = [];
    const telefonos: TelefonoDelComensal[] = [];
    try {
      const duena = await equipo.pagina(info, 'dueno');
      fallos.push(vigilarFallos(duena));
      const reseteo = await duena.request.post('/api/pruebas/resetear', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { confirmacion: 'RESETEAR' },
      });
      expect(reseteo.status(), `resetear: ${await reseteo.text()}`).toBe(200);

      let jugoId = '';
      let seccion = '';
      await test.step('el Jugo como en producción: «Sabor del jugo» (única, obligatoria) con Naranja y Zanahoria', async () => {
        const [limonada] = await consultarPuente<{ categoria_id: string }>(
          duena,
          'ProductoTerminado',
          { filtro: { nombre: CARTA.limonada.nombre }, limite: 1 },
        );
        const [categoria] = await consultarPuente<{ nombre: string }>(duena, 'CategoriaProducto', {
          filtro: { id: limonada?.categoria_id },
          limite: 1,
        });
        seccion = categoria?.nombre ?? '';
        const creado = await comando(duena, '/api/catalogo/crear-producto', {
          nombre: JUGO,
          categoriaId: limonada?.categoria_id,
          precioVenta: '35',
          costoUnitario: '0',
          tipoVenta: 'precio_fijo',
          unidadVenta: 'pieza',
          estrategiaConsumo: 'ninguno',
          permiteVentaSinStock: true,
          stockMinimo: '0',
          visibleEnPos: true,
        });
        jugoId = String(creado.datos?.['id']);
        // Como el Jugo de producción: sale por la barra (sin área no hay comanda que preparar).
        await comando(duena, '/api/datos/escribir', {
          entidad: 'ProductoTerminado',
          operacion: 'update',
          id: jugoId,
          datos: { area_preparacion: 'barra' },
        });
        const grupo = await comando(duena, '/api/catalogo/guardar-grupo-de-opciones', {
          nombre: GRUPO,
          tipo: 'unica',
          obligatorio: true,
          opciones: [
            { nombre: 'Naranja', precio: '0' },
            { nombre: 'Zanahoria', precio: '0' },
          ],
        });
        await comando(duena, '/api/catalogo/asignar-grupos-de-opciones', {
          productoId: jugoId,
          grupoIds: [String(grupo.datos?.['grupoId'])],
        });
        expect((await opcionesDelGrupo(duena)).map((o) => o.nombre)).toEqual([
          'Naranja',
          'Zanahoria',
        ]);
      });

      await test.step('el guion: el ensayo no escribe, el real agrega UNA «Mixto» y otra corrida no duplica', async () => {
        expect(correrElGuion(true)).toContain('Ensayo: no se escribe nada');
        expect((await opcionesDelGrupo(duena)).map((o) => o.nombre)).toEqual([
          'Naranja',
          'Zanahoria',
        ]);
        expect(correrElGuion(false)).toContain('«Mixto» (+$0) agregada');
        expect((await opcionesDelGrupo(duena)).map((o) => o.nombre)).toEqual([
          'Naranja',
          'Zanahoria',
          'Mixto',
        ]);
        expect(correrElGuion(false)).toContain('ya está');
        expect((await opcionesDelGrupo(duena)).map((o) => o.nombre)).toEqual([
          'Naranja',
          'Zanahoria',
          'Mixto',
        ]);
      });

      let ordenId = '';
      const notasDelJugo = async () =>
        (
          await consultarPuente<{ producto_nombre?: string; notas_producto?: string | null }>(
            duena,
            'DetalleVenta',
            { filtro: { venta_id: ordenId }, limite: 20 },
          )
        )
          .filter((l) => l.producto_nombre === JUGO)
          .map((l) => l.notas_producto ?? '');

      await test.step('el portal del comensal ofrece «Mixto», se elige y llega a la comanda con su opción', async () => {
        const token = await prepararElPortalDelComensal(duena, {
          mesa: MESA,
          zona: ZONA,
          mesero: MESERO,
          pedidosDelComensal: true,
        });
        const comensal = await abrirElQrDeLaMesa(browser, info, SLUG, token);
        telefonos.push(comensal);
        const telefono = comensal.page;
        fallos.push(vigilarFallos(telefono));
        // El portal enseña una categoría a la vez: se abre la del jugo.
        await telefono.getByText(seccion, { exact: true }).first().click();
        await telefono
          .getByRole('button', { name: new RegExp(`^${JUGO},.*Ver y agregar$`) })
          .click();
        for (const opcion of ['Naranja', 'Zanahoria', 'Mixto']) {
          await expect(telefono.getByText(opcion, { exact: true })).toBeVisible();
        }
        await telefono.getByText('Mixto', { exact: true }).click();
        await telefono.getByRole('button', { name: /^Agregar\s*·/ }).click();
        const enviado = await enviarElPedidoDeLaMesa(telefono, token);
        expect(enviado.status(), 'El servidor rechazó el pedido del comensal.').toBe(200);
        const mesa = await consultarPuente<{ venta_activa_id?: string | null }>(duena, 'Mesa', {
          filtro: { numero: MESA },
          limite: 1,
        });
        ordenId = mesa[0]?.venta_activa_id ?? '';
        expect(ordenId, 'La mesa no quedó con cuenta.').not.toBe('');
        await expect
          .poll(async () => unidadesPorPlatillo(await comandasDeLaCuenta(duena, ordenId)), {
            message: 'El jugo del portal no llegó a la comanda.',
          })
          .toEqual(unidadesEsperadas([{ nombre: JUGO, veces: 1 }]));
        expect((await notasDelJugo()).join(' ')).toContain('Mixto');
      });

      await test.step('el mesero lo elige con el dedo y sale a la barra con «Mixto»', async () => {
        const mesera = await equipo.pagina(info, 'mesero');
        fallos.push(vigilarFallos(mesera, { sondeando: () => true }));
        await mesera.goto('/');
        await mesera.waitForURL(/\/mesero$/);
        await laMesa(mesera, MESA).click();
        const mesa = dialogoDeLaMesa(mesera, MESA);
        await yaAbierto(mesa);
        await mesa.getByRole('button', { name: new RegExp(`^${JUGO} \\$`) }).click();
        const personalizar = mesera.getByRole('dialog', { name: 'Personalizar producto' });
        await expect(personalizar.getByText(GRUPO)).toBeVisible();
        for (const opcion of ['Naranja', 'Zanahoria', 'Mixto']) {
          await expect(
            personalizar.getByRole('button', { name: opcion, exact: true }),
          ).toBeVisible();
        }
        await pulsar(personalizar.getByRole('button', { name: 'Mixto', exact: true }));
        await pulsar(personalizar.getByRole('button', { name: /^Agregar/ }));
        await expect(personalizar).toHaveCount(0);
        const enviar = await botonDeLaMesa(mesera, MESA, 'Enviar a Cocina');
        const enviado = mesera.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === '/api/restaurante/enviar-pedido' &&
            r.request().method() === 'POST',
        );
        await pulsar(enviar);
        expect((await enviado).status(), 'El servidor rechazó el pedido de la mesera.').toBe(200);
        await expect
          .poll(async () => unidadesPorPlatillo(await comandasDeLaCuenta(duena, ordenId)), {
            message: 'El jugo de la mesera no llegó a la comanda.',
          })
          .toEqual(unidadesEsperadas([{ nombre: JUGO, veces: 2 }]));
        const notas = await notasDelJugo();
        expect(notas).toHaveLength(2);
        for (const nota of notas) expect(nota).toContain('Mixto');
      });

      await test.step('la Caja lo elige con el dedo, lo lee en la cuenta y sale en el ticket', async () => {
        const rosa = await equipo.pagina(info, 'cajero');
        fallos.push(vigilarFallos(rosa, { sondeando: () => true }));
        await rosa.goto('/pos');
        if ((await sesionDeLaCaja(rosa)) === null) {
          await rosa.goto('/caja');
          await abrirLaCaja(rosa, FONDO_CENTAVOS);
          await rosa.goto('/pos');
        }
        await rosa.getByPlaceholder('Buscar producto...').fill(JUGO);
        const agregada = rosa.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === '/api/venta/agregar-linea' &&
            r.request().method() === 'POST',
        );
        await pulsar(rosa.getByText(JUGO, { exact: true }).first());
        const dialogo = rosa.getByRole('dialog', { name: 'Personalizar producto' });
        await expect(dialogo.getByText(GRUPO)).toBeVisible();
        for (const opcion of ['Naranja', 'Zanahoria', 'Mixto']) {
          await expect(dialogo.getByRole('button', { name: opcion, exact: true })).toBeVisible();
        }
        await pulsar(dialogo.getByRole('button', { name: 'Mixto', exact: true }));
        await pulsar(dialogo.getByRole('button', { name: /^Agregar/ }));
        const respuesta = await agregada;
        expect(respuesta.status(), 'El servidor rechazó la línea con «Mixto».').toBe(200);
        const ordenDeLaCaja = String(
          (respuesta.request().postDataJSON() as { ordenId?: string }).ordenId,
        );
        const ver = rosa.getByRole('button', { name: /^Ver orden \(/ });
        const opcionElegida = rosa.getByText(`${GRUPO}: Mixto`).locator('visible=true').first();
        await expect(ver.or(opcionElegida)).toBeVisible();
        if (await ver.isVisible()) await pulsar(ver);
        await expect(opcionElegida).toBeVisible();

        const estado = await comando(rosa, '/api/venta/estado', { ordenId: ordenDeLaCaja });
        const total = Number(
          (estado.datos?.['cotizacion'] as { totalCentavos?: string } | null)?.totalCentavos,
        );
        expect(total).toBeGreaterThan(0);
        await comando(rosa, '/api/venta/cobrar', {
          ordenId: ordenDeLaCaja,
          pagos: [{ metodo: 'efectivo', montoCentavos: total }],
          totalEsperadoCentavos: total,
        });
        const ticket = await comando(rosa, '/api/venta/ticket', { ordenId: ordenDeLaCaja });
        expect(JSON.stringify(ticket.datos)).toContain(`${GRUPO}: Mixto`);
      });

      for (const exigirSinFallos of fallos) exigirSinFallos();
      const limpieza = await duena.request.post('/api/pruebas/resetear', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { confirmacion: 'RESETEAR' },
      });
      expect(limpieza.status(), `resetear al final: ${await limpieza.text()}`).toBe(200);
    } finally {
      for (const t of telefonos) await t.cerrar();
      await equipo.cerrar();
    }
  });
});
