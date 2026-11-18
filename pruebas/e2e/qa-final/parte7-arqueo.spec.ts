import { sesionDeLaCaja } from '../ayudantes/conciliacion.ts';
import { CARTA, yaAbierto } from '../ayudantes/mesas-heredadas.ts';
import { Equipo } from '../ayudantes/roles.ts';
import { exigirDemostracion } from '../ayudantes/sesion.ts';

import { navegadorDe, prepararContexto } from './arnes/ligero.ts';
import { expect, exigirServidor, test } from './arnes/prueba.ts';
import { abrirTeclado } from './arnes/teclado.ts';
import { toque } from './arnes/toque.ts';
import { vigilarPagina } from './arnes/vigilancia.ts';
import {
  SLUG,
  buscarClave,
  cajaAbierta,
  capturar,
  cobrarLaMesa,
  mandar,
  mesaConPedido,
  resetearLaDemo,
  sqlLocal,
} from './parte7/comun.ts';

/**
 * PARTE 7 · punto 7 · EL ARQUEO POR DENOMINACIÓN al cerrar la caja, con el dedo y el teclado en
 * pantalla (Windows 1366×768 al 125 %).
 *
 * La cajera cuenta por billetes y monedas (con «+» y tecleando las piezas de $1), el total sale de
 * las piezas y es el efectivo contado, la diferencia contra lo esperado se lee en palabras («Falta
 * $4.00 en caja.»), el cierre manda el conteo, el servidor lo guarda y el papel del corte lo trae.
 */

const CONTADO = 182_500;

test.describe('parte 7 · el arqueo por billetes y monedas', () => {
  test.use({ actionTimeout: 60_000, navigationTimeout: 120_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('7 · se cuenta por billetes y monedas, la suma es lo contado, la diferencia se ve clara y el papel lo trae', async ({
    browser,
    aparato,
  }, info) => {
    test.setTimeout(10 * 60_000);
    const equipo = new Equipo(navegadorDe(browser, aparato), SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await prepararContexto(duena.context(), aparato);
      await resetearLaDemo(duena);
      const rosa = await equipo.pagina(info, 'cajero');
      await prepararContexto(rosa.context(), aparato);
      vigilarPagina(rosa);
      await cajaAbierta(rosa, 150_000);
      const lupita = await equipo.pagina(info, 'mesero');
      await prepararContexto(lupita.context(), aparato);
      const a = await mesaConPedido(lupita, duena, 1, [{ nombre: CARTA.arrachera.nombre }]);
      await mandar(lupita, '/api/restaurante/solicitar-cuenta', {
        ordenId: a.ordenId,
        propinaTipo: 'sin_propina',
      });
      await cobrarLaMesa(rosa, 1, 'Efectivo');
      const sesion = (await sesionDeLaCaja(rosa)) ?? '';
      // Esperado en el cajón: el fondo de $1,500 más lo cobrado en efectivo ($329).
      const esperado = 150_000 + CARTA.arrachera.centavos;

      await rosa.goto('/caja', { waitUntil: 'domcontentloaded' });
      await rosa.getByRole('tab', { name: /^Pendientes/ }).waitFor({ timeout: 90_000 });
      await toque(rosa, rosa.getByRole('button', { name: /Cierre diario/ }));
      const cierre = rosa.getByRole('dialog', { name: /Cierre de caja diario/ });
      await yaAbierto(cierre);
      await toque(rosa, cierre.getByRole('button', { name: 'Contar por billetes y monedas' }));
      const conteo = cierre.getByRole('group', { name: 'Conteo por billetes y monedas' });
      await expect(conteo).toBeVisible();

      // Con el dedo: $1,000 + $500 + $200 + $100 + $20 = $1,820.
      for (const etiqueta of ['$1,000', '$500', '$200', '$100', '$20']) {
        await toque(
          rosa,
          conteo.getByRole('button', { name: `Una pieza más de ${etiqueta}`, exact: true }),
        );
      }
      // Y tecleando con el teclado en pantalla: cinco monedas de $1.
      const monedasDeUno = conteo.locator('#piezas-100');
      await toque(rosa, monedasDeUno);
      const teclado = await abrirTeclado(rosa, aparato.teclado);
      try {
        await monedasDeUno.pressSequentially('5', { delay: 15 });
        await expect(monedasDeUno).toHaveValue('5');
        const caja = await monedasDeUno.boundingBox();
        expect(caja, 'El campo de piezas desapareció con el teclado.').not.toBeNull();
        expect((caja?.y ?? 0) + (caja?.height ?? 0)).toBeLessThanOrEqual(teclado.visible.abajo + 1);
      } finally {
        await teclado.cerrar();
      }
      await expect(
        conteo.locator('[data-total-del-conteo]'),
        'El total del conteo no suma las piezas.',
      ).toHaveAttribute('data-total-del-conteo', String(CONTADO));
      await expect(cierre.getByText('$1,825.00').first()).toBeVisible();
      // El efectivo contado ES la suma (el campo ya no se teclea).
      await expect(cierre.getByPlaceholder('0.00').first()).toHaveValue('1825');
      // La diferencia contra lo esperado, en palabras.
      const faltante = (esperado - CONTADO) / 100;
      await expect(
        cierre.getByText(`Falta $${faltante.toFixed(2)} en caja.`),
        'La diferencia contra lo esperado no se ve.',
      ).toBeVisible({ timeout: 30_000 });
      await capturar(rosa, 'arqueo', aparato.id, 'conteo-y-diferencia');

      // Cerrar: el conteo viaja.
      const [cerrada] = await Promise.all([
        rosa.waitForResponse((r) => new URL(r.url()).pathname === '/api/caja/cerrar'),
        toque(rosa, cierre.getByRole('button', { name: /^Cerrar (caja del día|esta caja)/ })),
      ]);
      const enviado = JSON.parse(cerrada.request().postData() ?? '{}') as {
        efectivoContadoCentavos?: number;
        denominaciones?: { denominacionCentavos: number; piezas: number }[];
      };
      expect(cerrada.status(), await cerrada.text()).toBe(200);
      expect(enviado.efectivoContadoCentavos).toBe(CONTADO);
      expect(enviado.denominaciones).toEqual([
        { denominacionCentavos: 100_000, piezas: 1 },
        { denominacionCentavos: 50_000, piezas: 1 },
        { denominacionCentavos: 20_000, piezas: 1 },
        { denominacionCentavos: 10_000, piezas: 1 },
        { denominacionCentavos: 2_000, piezas: 1 },
        { denominacionCentavos: 100, piezas: 5 },
      ]);

      // El servidor lo guardó y suma lo contado.
      const guardado = sqlLocal(
        `select string_agg(denominacion_centavos || 'x' || piezas, ',' order by denominacion_centavos desc), sum(denominacion_centavos * piezas) from conteos_denominacion where momento = 'cierre' and sesion_caja_id = '${sesion}'`,
      );
      expect(guardado).toBe(`100000x1,50000x1,20000x1,10000x1,2000x1,100x5|${String(CONTADO)}`);

      // El papel del corte lo trae: la hoja del servidor (la que se imprime y se guarda como PDF).
      const hoja = await mandar<unknown>(duena, '/api/caja/hoja-del-corte', {
        sesionCajaId: sesion,
      });
      const filas = buscarClave(hoja, 'conteo') as
        readonly { denominacionCentavos: string; piezas: number }[] | undefined;
      expect(
        filas?.map((f) => `${f.denominacionCentavos}x${String(f.piezas)}`),
        'La hoja del corte no trae el conteo por denominación.',
      ).toEqual(['100000x1', '50000x1', '20000x1', '10000x1', '2000x1', '100x5']);
      await capturar(rosa, 'arqueo', aparato.id, 'cierre-hecho');
    } finally {
      await equipo.cerrar();
    }
  });
});
