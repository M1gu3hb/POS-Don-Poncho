import { Equipo, type RolDePrueba } from '../ayudantes/roles.ts';
import { exigirDemostracion } from '../ayudantes/sesion.ts';

import { navegadorDe, prepararContexto } from './arnes/ligero.ts';
import { expect, exigirServidor, test } from './arnes/prueba.ts';
import { revisarPantalla } from './arnes/revisiones.ts';
import { vigilarPagina } from './arnes/vigilancia.ts';

/**
 * LA SEMILLA PARA GENERAR PRUEBAS (DP-22). Cada prueba entra como un puesto del restaurante de
 * prueba, con el perfil táctil del proyecto, y deja la pantalla principal de ese puesto LISTA y
 * revisada. Quien (o lo que) genere pruebas nuevas parte de aquí: la entrada con PIN, el perfil, la
 * vigilancia de consola y de red y la revisión ya están resueltas.
 *
 * Para agregar una pantalla: una fila en `PUESTOS` (rol, ruta, nombre) y, si necesita un estado
 * previo (una mesa abierta, un diálogo), prepararlo antes de `revisarPantalla` con un `estado`
 * propio. Corre en modo de barrido: lo que la app tenga mal va al informe, no tumba la semilla.
 */

const SLUG = 'prueba-restaurante';

interface Puesto {
  readonly rol: RolDePrueba;
  readonly ruta: string;
  readonly pantalla: string;
}

const PUESTOS: readonly Puesto[] = [
  { rol: 'dueno', ruta: '/', pantalla: 'tablero-del-dueno' },
  { rol: 'gerente', ruta: '/', pantalla: 'tablero-del-gerente' },
  { rol: 'cajero', ruta: '/caja', pantalla: 'caja-de-la-cajera' },
  { rol: 'mesero', ruta: '/mesero', pantalla: 'mesas-del-mesero' },
  { rol: 'cocina', ruta: '/cocina', pantalla: 'cocina' },
  { rol: 'almacen', ruta: '/inventario', pantalla: 'inventario-del-almacen' },
];

test.describe('la semilla: cada puesto en su pantalla principal', () => {
  test.use({ actionTimeout: 30_000, navigationTimeout: 60_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  for (const puesto of PUESTOS) {
    test(`${puesto.rol} entra y deja «${puesto.pantalla}» lista`, async ({
      browser,
      aparato,
    }, info) => {
      test.setTimeout(4 * 60_000);
      const equipo = new Equipo(navegadorDe(browser, aparato), SLUG);
      try {
        const pagina = await equipo.pagina(info, puesto.rol);
        await prepararContexto(pagina.context(), aparato);
        vigilarPagina(pagina);
        await pagina.goto(puesto.ruta, { waitUntil: 'domcontentloaded' });
        await expect(pagina.locator('main')).toBeVisible();
        await expect(pagina.getByRole('heading', { level: 1 }).first()).toBeVisible();
        const resultado = await revisarPantalla(pagina, info, {
          pantalla: puesto.pantalla,
          estado: 'inicial',
          modo: 'barrido',
        });
        process.stdout.write(
          `[semilla] ${aparato.id} · ${puesto.pantalla}: ${String(resultado.hallazgos.length)} hallazgos\n`,
        );
      } finally {
        await equipo.cerrar();
      }
    });
  }
});
