import { readFileSync } from 'node:fs';

import { CARTA, pesos } from '../ayudantes/mesas-heredadas.ts';
import { Equipo } from '../ayudantes/roles.ts';
import { exigirDemostracion } from '../ayudantes/sesion.ts';

import { navegadorDe, prepararContexto } from './arnes/ligero.ts';
import { expect, exigirServidor, test } from './arnes/prueba.ts';
import { toque } from './arnes/toque.ts';
import { vigilarPagina } from './arnes/vigilancia.ts';
import {
  SLUG,
  cajaAbierta,
  capturar,
  cobrarLaMesa,
  mandar,
  mesaConPedido,
  resetearLaDemo,
} from './parte7/comun.ts';

/**
 * PARTE 7 · punto 11 · EXPORTAR EL DÍA desde Registros, con el dedo: dos toques («Exportar», «CSV»),
 * el archivo lleva el día del NEGOCIO (México) y no el del navegador, abre como CSV y su suma es la
 * del resumen que se ve en pantalla.
 */

const HOY_DEL_NEGOCIO = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Mexico_City',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

/** Parte una línea de CSV respetando las comillas. */
function celdasDe(linea: string): string[] {
  const celdas: string[] = [];
  let actual = '';
  let entreComillas = false;
  for (let i = 0; i < linea.length; i += 1) {
    const c = linea[i] ?? '';
    if (c === '"') {
      if (entreComillas && linea[i + 1] === '"') {
        actual += '"';
        i += 1;
      } else entreComillas = !entreComillas;
    } else if (c === ',' && !entreComillas) {
      celdas.push(actual);
      actual = '';
    } else actual += c;
  }
  celdas.push(actual);
  return celdas;
}

test.describe('parte 7 · exportar el día', () => {
  test.use({ actionTimeout: 60_000, navigationTimeout: 120_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('11 · Registros exporta lo de hoy en dos toques, con el día del negocio, y el archivo suma lo que dice la pantalla', async ({
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
      await cajaAbierta(rosa);
      const lupita = await equipo.pagina(info, 'mesero');
      await prepararContexto(lupita.context(), aparato);

      // Dos cuentas cobradas hoy (efectivo y tarjeta).
      const a = await mesaConPedido(lupita, duena, 1, [{ nombre: CARTA.arrachera.nombre }]);
      await mandar(lupita, '/api/restaurante/solicitar-cuenta', {
        ordenId: a.ordenId,
        aunConPendientes: true,
        propinaTipo: 'sin_propina',
      });
      const cobroA = await cobrarLaMesa(rosa, 1, 'Efectivo');
      const b = await mesaConPedido(lupita, duena, 2, [
        { nombre: CARTA.guacamole.nombre, cantidad: '2' },
      ]);
      await mandar(lupita, '/api/restaurante/solicitar-cuenta', {
        ordenId: b.ordenId,
        aunConPendientes: true,
        propinaTipo: 'sin_propina',
      });
      const cobroB = await cobrarLaMesa(rosa, 2, 'Tarjeta');
      const total = cobroA.totalCentavos + cobroB.totalCentavos;

      vigilarPagina(duena);
      await duena.goto('/registros', { waitUntil: 'domcontentloaded' });
      await expect(
        duena.getByText(`$${pesos(total)}`).first(),
        'Registros no muestra el total de hoy.',
      ).toBeVisible({ timeout: 60_000 });
      await capturar(duena, 'exportar', aparato.id, 'registros-hoy');

      // La pestaña «Ventas» y después dos toques: «Exportar» y «CSV».
      await toque(duena, duena.getByRole('tab', { name: /^Ventas/ }));
      const [descarga] = await Promise.all([
        duena.waitForEvent('download'),
        (async () => {
          await toque(duena, duena.getByRole('button', { name: /^Exportar$/ }).first());
          await capturar(duena, 'exportar', aparato.id, 'menu');
          await toque(duena, duena.getByRole('menuitem', { name: /CSV/ }));
        })(),
      ]);
      const nombre = descarga.suggestedFilename();
      process.stdout.write(`ARCHIVO: ${nombre}\n`);
      expect(nombre, 'El archivo no lleva el día del NEGOCIO.').toContain(HOY_DEL_NEGOCIO);
      expect(nombre).toMatch(/\.csv$/);
      const ruta = await descarga.path();
      const texto = readFileSync(ruta, 'utf8');
      const sinMarca = texto.startsWith('\uFEFF') ? texto.slice(1) : texto;
      const lineas = sinMarca.split(/\r?\n/).filter((l) => l.trim() !== '');
      process.stdout.write(
        `CSV (${String(lineas.length)} líneas): ${lineas.slice(0, 4).join(' // ')}\n`,
      );
      expect(lineas.length - 1, 'El CSV no trae las dos ventas de hoy.').toBe(2);
      const encabezado = celdasDe(lineas[0] ?? '').map((c) => c.toLowerCase());
      const columnaDelTotal = encabezado.findIndex((c) => c.startsWith('total'));
      expect(
        columnaDelTotal,
        `Sin columna de total en ${JSON.stringify(encabezado)}`,
      ).toBeGreaterThanOrEqual(0);
      const suma = lineas
        .slice(1)
        .map((l) => Number((celdasDe(l)[columnaDelTotal] ?? '0').replace(/[^0-9.-]/g, '')))
        .reduce((s, n) => s + Math.round(n * 100), 0);
      expect(suma, 'El total del archivo no es el de la pantalla.').toBe(total);
    } finally {
      await equipo.cerrar();
    }
  });
});
