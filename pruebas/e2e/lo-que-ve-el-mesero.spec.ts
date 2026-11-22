import { randomInt } from 'node:crypto';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { categoriaA, crearEstacion, laEstacion, platilloDe } from './ayudantes/estaciones.ts';
import {
  CARTA,
  abrirLaMesa,
  armarElPedido,
  botonDeLaMesa,
  dialogoDeLaMesa,
  escapar,
  laMesa,
  yaAbierto,
} from './ayudantes/mesas-heredadas.ts';
import { escribir } from './ayudantes/modo-espera.ts';
import { Equipo } from './ayudantes/roles.ts';
import {
  abrirCajaPorLaRuta,
  cabecerasDeEscrituraDePrueba,
  consultarPuente,
  exigirDemostracion,
  soltarLaCaja,
  vigilarFallos,
} from './ayudantes/sesion.ts';

/**
 * DP-25 · Parte 3 · LO QUE EL MESERO VE DENTRO DE LA MESA, con el dedo (teléfono y 1024×768).
 *
 *   3.1 cada platillo enviado dice en qué va (Nuevo → En preparación → Listo → Entregado) cuando la
 *       cocina lo mueve, con glifo y palabra;
 *   3.2 «Michelado» se ve en el carrito («Nuevo pedido») y en la lista de lo enviado («Pedido actual»);
 *   3.3 la leyenda está a la vista y su «?» abre las instrucciones;
 *   3.4 el avance de la estación («Barra 2 de 3», «Barra ✓») se lee a un metro: tamaño, negritas y
 *       contraste AA medidos, en la nubecita del mapa y en la tarjeta de la mesa;
 *   3.5 si OTRA sesión cancela o cobra la cuenta que la mesera tiene abierta, le sale el aviso y la
 *       pantalla vuelve al mapa.
 */

const SLUG = 'prueba-restaurante';
const N = String(randomInt(100, 1000));
const PARRILLA = `Parrilla ${N}`;
const MESA_DEL_PEDIDO = 3;
const MESA_QUE_SE_CANCELA = 4;
const MESA_QUE_SE_COBRA = 5;

interface ItemLeido {
  readonly id: string;
  readonly producto_nombre?: string | null;
  readonly estado?: string | null;
}
interface ComandaLeida {
  readonly id: string;
  readonly estacion_preparacion_nombre?: string | null;
  readonly items?: readonly ItemLeido[];
}

async function comandasDe(lector: Page, ordenId: string): Promise<readonly ComandaLeida[]> {
  return consultarPuente<ComandaLeida>(lector, 'PedidoPreparacion', {
    filtro: { venta_id: ordenId },
    limite: 20,
  });
}

/** El platillo de la cuenta, en la comanda de la estación que sea. */
function platilloDeLaCuenta(
  comandas: readonly ComandaLeida[],
  nombre: string,
): { readonly comandaId: string; readonly itemId: string } {
  for (const comanda of comandas) {
    const item = comanda.items?.find((i) => i.producto_nombre === nombre);
    if (item !== undefined) return { comandaId: comanda.id, itemId: item.id };
  }
  throw new Error(`La cuenta no tiene el platillo «${nombre}» en ninguna comanda.`);
}

async function mover(
  duena: Page,
  platillo: { readonly comandaId: string; readonly itemId: string },
  estado: 'en_preparacion' | 'listo',
): Promise<void> {
  await escribir(duena, '/api/restaurante/transicionar-pedido', {
    comandaId: platillo.comandaId,
    comandaItemId: platillo.itemId,
    estado,
  });
}

/** Las medidas que importan para leerlo a un metro: tamaño, grosor y contraste de texto sobre fondo. */
async function medidasDe(objetivo: Locator): Promise<{
  readonly tamano: number;
  readonly grosor: number;
  readonly contraste: number;
}> {
  return objetivo.evaluate((el) => {
    const aRgb = (color: string): [number, number, number] => {
      const lienzo = document.createElement('canvas');
      lienzo.width = 1;
      lienzo.height = 1;
      const c = lienzo.getContext('2d');
      if (c === null) return [0, 0, 0];
      c.clearRect(0, 0, 1, 1);
      c.fillStyle = color;
      c.fillRect(0, 0, 1, 1);
      const d = c.getImageData(0, 0, 1, 1).data;
      return [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0];
    };
    const luz = ([r, g, b]: [number, number, number]): number => {
      const canal = (v: number): number => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return (0.2 + 0.0126) * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
    };
    const estilo = getComputedStyle(el);
    // El fondo efectivo: el primero que no sea transparente subiendo por los ancestros.
    let fondo = 'rgb(255, 255, 255)';
    for (let n: Element | null = el; n !== null; n = n.parentElement) {
      const f = getComputedStyle(n).backgroundColor;
      if (f !== 'rgba(0, 0, 0, 0)' && f !== 'transparent') {
        fondo = f;
        break;
      }
    }
    const a = luz(aRgb(estilo.color));
    const b = luz(aRgb(fondo));
    return {
      tamano: Number.parseFloat(estilo.fontSize),
      grosor: Number(estilo.fontWeight),
      contraste: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
    };
  });
}

async function resetearLaDemo(duena: Page): Promise<void> {
  const reseteo = await duena.request.post('/api/pruebas/resetear', {
    headers: cabecerasDeEscrituraDePrueba(),
    data: { confirmacion: 'RESETEAR' },
  });
  expect(reseteo.status(), `resetear: ${await reseteo.text()}`).toBe(200);
}

test.describe('lo que ve el mesero dentro de la mesa (DP-25 · Parte 3)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('estado de cada platillo, «Michelado», leyenda con «?» y el avance por estación', async ({
    browser,
  }, info) => {
    test.setTimeout(10 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      const sinFallos = vigilarFallos(duena);
      await resetearLaDemo(duena);
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
      await categoriaA(duena, 'Bebidas', barra);
      const fuerte = (await platilloDe(duena, 'Platos fuertes')).nombre;

      // La cerveza trae «Prepárala» con el Michelado (+$15): el precio sube y se tiene que ver por qué.
      const [cerveza] = await consultarPuente<{ id: string }>(duena, 'ProductoTerminado', {
        filtro: { nombre: CARTA.cerveza.nombre },
        limite: 1,
      });
      const grupo = await escribir(duena, '/api/catalogo/guardar-grupo-de-opciones', {
        nombre: 'Prepárala',
        tipo: 'unica',
        obligatorio: false,
        opciones: [
          { nombre: 'Michelado', precio: '15' },
          { nombre: 'Cubano', precio: '20' },
        ],
      });
      await escribir(duena, '/api/catalogo/asignar-grupos-de-opciones', {
        productoId: cerveza?.id,
        grupoIds: [(grupo.datos as { grupoId: string }).grupoId],
      });

      const lupita = await equipo.pagina(info, 'mesero');
      if (info.project.name === 'tablet')
        await lupita.setViewportSize({ width: 1024, height: 768 });
      await lupita.goto('/mesero');
      await expect(laMesa(lupita, MESA_DEL_PEDIDO)).toBeVisible({ timeout: 30_000 });
      const { ordenId } = await abrirLaMesa(lupita, duena, MESA_DEL_PEDIDO, 2);
      const mesa = dialogoDeLaMesa(lupita, MESA_DEL_PEDIDO);

      await test.step('3.2 · «Michelado» se ve en el carrito antes de enviar', async () => {
        // La cerveza abre «Personalizar producto»: la opción trae su precio en el nombre del botón.
        await mesa
          .getByRole('button', { name: new RegExp(`^${escapar(CARTA.cerveza.nombre)} \\$`) })
          .tap();
        const personalizar = lupita.getByRole('dialog', { name: 'Personalizar producto' });
        await personalizar.getByRole('button', { name: /Michelado/ }).tap();
        await personalizar.getByRole('button', { name: 'Agregar al pedido' }).tap();
        await expect(personalizar).toHaveCount(0);
        await armarElPedido(lupita, MESA_DEL_PEDIDO, [
          { nombre: CARTA.limonada.nombre, veces: 1 },
          { nombre: CARTA.mineral.nombre, veces: 1 },
          { nombre: fuerte, veces: 1 },
        ]);
        const enviar = await botonDeLaMesa(lupita, MESA_DEL_PEDIDO, 'Enviar a Cocina');
        await expect(
          lupita.locator('[data-opciones-del-carrito]').filter({ visible: true }).first(),
        ).toContainText('Michelado');
        const enviada = lupita.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === '/api/restaurante/enviar-pedido' &&
            r.request().method() === 'POST',
        );
        await enviar.tap();
        expect((await enviada).status()).toBe(200);
        await expect(lupita.getByText('¡Pedido enviado a cocina!').first()).toBeVisible({
          timeout: 30_000,
        });
      });

      const lista = lupita.locator('[data-lo-enviado-de-la-mesa]').filter({ visible: true });
      const renglon = (nombre: string): Locator =>
        lista.locator('[data-renglon-enviado]').filter({ hasText: nombre });
      const abrirLaLista = async (): Promise<void> => {
        // En el teléfono la lista de lo enviado vive en la hoja del carrito.
        if ((await lista.count()) === 0) {
          await (await botonDeLaMesa(lupita, MESA_DEL_PEDIDO, 'Solicitar cuenta')).waitFor();
        }
        await expect(lista).toBeVisible({ timeout: 20_000 });
      };

      await test.step('3.1 y 3.2 · lo enviado trae su estado y su «Michelado»', async () => {
        await abrirLaLista();
        const deLaCerveza = renglon(CARTA.cerveza.nombre);
        await expect(deLaCerveza).toBeVisible({ timeout: 20_000 });
        await expect(deLaCerveza.locator('[data-opciones-del-platillo]')).toContainText(
          'Prepárala: Michelado',
        );
        const indicador = deLaCerveza.locator('[data-estado-del-platillo]');
        await expect(indicador).toHaveAttribute('data-estado-del-platillo', 'nuevo');
        // El color nunca va solo: el glifo y la palabra.
        await expect(indicador).toContainText('Nuevo');
      });

      await test.step('3.1 · cuando cocina lo mueve, el estado cambia solo', async () => {
        const comandas = await comandasDe(duena, ordenId);
        expect(
          comandas.some((c) => c.estacion_preparacion_nombre === 'Barra'),
          'La Barra no recibió su comanda.',
        ).toBe(true);
        const delaCerveza = platilloDeLaCuenta(comandas, CARTA.cerveza.nombre);
        await mover(duena, delaCerveza, 'en_preparacion');
        const indicador = renglon(CARTA.cerveza.nombre).locator('[data-estado-del-platillo]');
        await expect(indicador).toHaveAttribute('data-estado-del-platillo', 'en_preparacion', {
          timeout: 20_000,
        });
        await expect(indicador).toContainText('En preparación');
        await mover(duena, delaCerveza, 'listo');
        await expect(indicador).toHaveAttribute('data-estado-del-platillo', 'listo', {
          timeout: 20_000,
        });
        await expect(indicador).toContainText('Listo');
      });

      await test.step('3.3 · la leyenda está a la vista y su «?» abre las instrucciones', async () => {
        const leyenda = mesa.locator('[data-leyenda-de-la-mesa]');
        await expect(leyenda).toBeVisible();
        for (const palabra of ['Nuevo', 'En preparación', 'Listo', 'Entregado']) {
          await expect(leyenda).toContainText(palabra);
        }
        const interrogacion = leyenda.getByRole('button', { name: 'Cómo leer esta pantalla' });
        const caja = await interrogacion.boundingBox();
        expect(caja?.height ?? 0, 'El «?» mide menos de 44 px.').toBeGreaterThanOrEqual(43.5);
        expect(caja?.width ?? 0).toBeGreaterThanOrEqual(43.5);
        await expect(interrogacion).toHaveAttribute('aria-expanded', 'false');
        await interrogacion.tap();
        await expect(interrogacion).toHaveAttribute('aria-expanded', 'true');
        const instrucciones = leyenda.locator('[data-leyenda-instrucciones]');
        await expect(instrucciones).toContainText('Marcar entregado');
        await expect(instrucciones).toContainText('Pedir la cuenta de todos modos');
        await expect(instrucciones).toContainText('Regresar');
        await expect(leyenda.locator('[data-leyenda-colores]')).toContainText('Esperando orden');
        await interrogacion.tap();
        await expect(instrucciones).toHaveCount(0);
      });

      await test.step('3.4 · «Barra 2 de 3» y luego «Barra ✓», legibles a un metro', async () => {
        const comandas = await comandasDe(duena, ordenId);
        const limonada = platilloDeLaCuenta(comandas, CARTA.limonada.nombre);
        const mineral = platilloDeLaCuenta(comandas, CARTA.mineral.nombre);
        await mover(duena, limonada, 'en_preparacion');
        await mover(duena, limonada, 'listo');
        const tarjeta = mesa.locator('[data-estacion="Barra"] [data-avance-de-la-estacion]');
        await expect(tarjeta).toHaveText('Barra 2 de 3', { timeout: 20_000 });
        await expect(tarjeta).toHaveAttribute('data-avance-de-la-estacion', 'parcial');
        const parcial = await medidasDe(tarjeta);
        expect(parcial.tamano, 'La tarjeta de la estación se lee chica.').toBeGreaterThanOrEqual(
          16,
        );
        expect(parcial.grosor).toBeGreaterThanOrEqual(700);
        expect(parcial.contraste, `Contraste ${String(parcial.contraste)}`).toBeGreaterThanOrEqual(
          4.5,
        );

        await mover(duena, mineral, 'en_preparacion');
        await mover(duena, mineral, 'listo');
        await expect(tarjeta).toHaveText('Barra ✓', { timeout: 20_000 });
        await expect(tarjeta).toHaveAttribute('data-avance-de-la-estacion', 'completo');
        const completa = await medidasDe(tarjeta);
        expect(completa.tamano).toBeGreaterThanOrEqual(16);
        expect(
          completa.contraste,
          `Contraste ${String(completa.contraste)}`,
        ).toBeGreaterThanOrEqual(4.5);

        // En el mapa: la nubecita de la estación terminada, verde y más grande.
        await lupita.keyboard.press('Escape');
        await expect(lupita.getByRole('dialog')).toHaveCount(0);
        const nube = lupita.locator('[data-nube="Barra ✓"]');
        await expect(nube).toBeVisible({ timeout: 20_000 });
        const enElMapa = await medidasDe(nube);
        expect(enElMapa.tamano, 'La nubecita se lee chica.').toBeGreaterThanOrEqual(16);
        expect(enElMapa.grosor).toBeGreaterThanOrEqual(800);
        expect(
          enElMapa.contraste,
          `Contraste ${String(enElMapa.contraste)}`,
        ).toBeGreaterThanOrEqual(4.5);
        // La Parrilla todavía no sacó nada: no hay nubecita suya.
        await expect(lupita.locator(`[data-nube^="${PARRILLA}"]`)).toHaveCount(0);
      });

      await test.step('3.1 · «Marcar entregado» deja el platillo como Entregado', async () => {
        await laMesa(lupita, MESA_DEL_PEDIDO).tap();
        await yaAbierto(mesa);
        const entregada = lupita.waitForResponse(
          (r) => new URL(r.url()).pathname === '/api/restaurante/entregar-pedidos' && r.ok(),
        );
        await mesa
          .locator('[data-estacion="Barra"]')
          .getByRole('button', { name: 'Marcar entregado' })
          .tap();
        await entregada;
        await abrirLaLista();
        await expect(
          renglon(CARTA.limonada.nombre).locator('[data-estado-del-platillo]'),
        ).toHaveAttribute('data-estado-del-platillo', 'entregado', { timeout: 20_000 });
      });

      sinFallos();
    } finally {
      await equipo.cerrar();
    }
  });

  test('si otra sesión cancela o cobra la cuenta abierta, la mesera se entera y vuelve al mapa', async ({
    browser,
  }, info) => {
    test.setTimeout(8 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await resetearLaDemo(duena);
      const lupita = await equipo.pagina(info, 'mesero');
      await lupita.goto('/mesero');
      await expect(laMesa(lupita, MESA_QUE_SE_CANCELA)).toBeVisible({ timeout: 30_000 });
      const platillo = (await platilloDe(duena, 'Platos fuertes')).id;

      await test.step('otra persona CANCELA la cuenta: aviso y regreso al mapa', async () => {
        const { ordenId } = await abrirLaMesa(lupita, duena, MESA_QUE_SE_CANCELA, 2);
        await escribir(duena, '/api/restaurante/enviar-pedido', {
          ordenId,
          lineas: [{ productoId: platillo, cantidad: '1' }],
        });
        await escribir(duena, '/api/restaurante/cancelar-orden', {
          ordenId,
          motivo: 'La cancela otra persona (prueba)',
        });
        const aviso = lupita.locator('[data-aviso-de-cuenta-cerrada]');
        await expect(aviso).toContainText(
          `La cuenta de la mesa ${String(MESA_QUE_SE_CANCELA)} se canceló.`,
          { timeout: 30_000 },
        );
        await expect(lupita.getByRole('dialog')).toHaveCount(0);
        await expect(laMesa(lupita, MESA_QUE_SE_CANCELA)).toBeVisible();
        await aviso.getByRole('button', { name: 'Entendido' }).tap();
        await expect(aviso).toHaveCount(0);
      });

      await test.step('otra persona COBRA la cuenta: aviso y regreso al mapa', async () => {
        const { ordenId } = await abrirLaMesa(lupita, duena, MESA_QUE_SE_COBRA, 2);
        await escribir(duena, '/api/restaurante/enviar-pedido', {
          ordenId,
          lineas: [{ productoId: platillo, cantidad: '1' }],
        });
        const comandas = await comandasDe(duena, ordenId);
        for (const comanda of comandas) {
          for (const estado of ['en_preparacion', 'listo'] as const) {
            await escribir(duena, '/api/restaurante/transicionar-pedido', {
              comandaId: comanda.id,
              estado,
            });
          }
        }
        await escribir(duena, '/api/restaurante/entregar-pedidos', { ordenId });
        const cuenta = await escribir(duena, '/api/restaurante/solicitar-cuenta', {
          ordenId,
          propinaTipo: 'sin_propina',
        });
        const total = Number(cuenta.datos?.['totalCentavos']);
        await abrirCajaPorLaRuta(duena, 50_000);
        try {
          await escribir(duena, '/api/venta/cobrar', {
            ordenId,
            pagos: [{ metodo: 'efectivo', montoCentavos: total, recibidoCentavos: total }],
            totalEsperadoCentavos: total,
          });
          const aviso = lupita.locator('[data-aviso-de-cuenta-cerrada]');
          await expect(aviso).toContainText(
            `La cuenta de la mesa ${String(MESA_QUE_SE_COBRA)} ya se cobró.`,
            { timeout: 30_000 },
          );
          await expect(lupita.getByRole('dialog')).toHaveCount(0);
        } finally {
          await soltarLaCaja(duena);
        }
      });
    } finally {
      await equipo.cerrar();
    }
  });
});
