import { Equipo } from '../ayudantes/roles.ts';
import { abrirCajaPorLaRuta, exigirDemostracion } from '../ayudantes/sesion.ts';

import { navegadorDe, prepararContexto } from './arnes/ligero.ts';
import { expect, exigirServidor, test } from './arnes/prueba.ts';
import { revisarPantalla } from './arnes/revisiones.ts';
import type { ResultadoDeRevision } from './arnes/tipos.ts';
import { vigilarPagina } from './arnes/vigilancia.ts';

/**
 * EL HUMO REAL (DP-22): en CADA perfil, entrar al restaurante de prueba con su PIN, abrir «Mesas y
 * pedidos» y la Caja, y correr `revisarPantalla` en modo de barrido. Demuestra que los perfiles, los
 * motores viejos y el Chrome 156 funcionan de punta a punta contra la app de verdad.
 *
 * Lo que pasa o falla aquí es que el aparato LLEGUE (entra, pinta, se deja medir). Los hallazgos de
 * la app que salen de la revisión no hacen fallar la prueba: van al informe (`qa/qa-final/informes/`)
 * y a la salida, para quien los arregle. Para exigirlos, `modo: 'estricto'`.
 */

const SLUG = 'prueba-restaurante';

const PANTALLAS = [
  { nombre: 'mesas-y-pedidos', ruta: '/mesero' },
  { nombre: 'caja', ruta: '/caja' },
] as const;

function resumen(r: ResultadoDeRevision): string {
  const porTipo = new Map<string, number>();
  for (const h of r.hallazgos) porTipo.set(h.tipo, (porTipo.get(h.tipo) ?? 0) + 1);
  const lista = [...porTipo].map(([tipo, n]) => `${tipo}×${String(n)}`).join(' ');
  return `[humo] ${r.aparato} · ${r.pantalla} · ${r.motor} · ${String(r.hallazgos.length)} hallazgos${lista === '' ? '' : ` (${lista})`} · ${String(r.informativos.length)} informativos`;
}

test.describe('el humo en cada aparato', () => {
  test.use({ actionTimeout: 30_000, navigationTimeout: 60_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('entra, abre Mesas y pedidos y la Caja, y se deja revisar', async ({
    browser,
    aparato,
  }, info) => {
    test.setTimeout(8 * 60_000);
    const equipo = new Equipo(navegadorDe(browser, aparato), SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await prepararContexto(duena.context(), aparato);
      vigilarPagina(duena);
      for (const pantalla of PANTALLAS) {
        await duena.goto(pantalla.ruta, { waitUntil: 'domcontentloaded' });
        await expect(duena.locator('main')).toBeVisible();
        if (pantalla.nombre === 'caja') await abrirCajaPorLaRuta(duena, 100_000);
        await duena.goto(pantalla.ruta, { waitUntil: 'domcontentloaded' });
        await expect(duena.getByRole('heading', { level: 1 }).first()).toBeVisible();
        const resultado = await revisarPantalla(duena, info, {
          pantalla: pantalla.nombre,
          estado: 'inicial',
          modo: 'barrido',
        });
        process.stdout.write(`${resumen(resultado)}\n`);
        await info.attach(`humo-${pantalla.nombre}.json`, {
          body: JSON.stringify(resultado, null, 1),
          contentType: 'application/json',
        });
        for (const h of resultado.hallazgos.slice(0, 6)) {
          process.stdout.write(`    · ${h.tipo} · ${h.selector} «${h.texto}» · ${h.detalle}\n`);
        }
      }
    } finally {
      await equipo.cerrar();
    }
  });
});
