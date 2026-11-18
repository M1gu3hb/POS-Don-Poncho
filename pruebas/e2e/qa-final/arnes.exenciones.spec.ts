import { pagina, servirCalibracion, urlDe } from './arnes/calibracion/pagina.ts';
import { revisarPantalla } from './arnes/revisiones.ts';
import { describir } from './arnes/tipos.ts';
import { expect, test } from './arnes/prueba.ts';

/**
 * LAS EXENCIONES DE LOS TOCABLES, PROBADAS CONTRA SÍ MISMAS (DP-22 · barrido de servicio).
 *
 * El barrido dejó de contar tres cosas que NO son defectos de quien queda debajo: un aviso
 * transitorio (`[data-sonner-toast]`), una barra flotante (`position: fixed`) sobre una lista con
 * desplazamiento, y una tarjeta que el desplazamiento deja ver a medias. Una exención sin su
 * contraparte afloja el arnés sin que nadie lo note: cada caso trae su versión que SÍ es defecto,
 * y esa tiene que seguir saliendo.
 */

const LISTA = `
  <div id="lista" style="height:160px;overflow-y:auto;border:1px solid #333">
    <button style="display:block;margin:8px">Uno</button>
    <button style="display:block;margin:8px">Dos</button>
    <button style="display:block;margin:8px">Tres</button>
    <button style="display:block;margin:8px">Cuatro</button>
  </div>`;

async function hallazgosDe(
  page: Parameters<typeof servirCalibracion>[0],
  info: Parameters<typeof revisarPantalla>[1],
  id: string,
  html: string,
): Promise<readonly string[]> {
  await servirCalibracion(page, new Map([[`/caso/${id}/limpia`, html]]));
  await page.goto(urlDe(id, 'limpia'));
  const r = await revisarPantalla(page, info, {
    pantalla: `autoprueba-${id}`,
    estado: 'exencion',
    modo: 'barrido',
    omitir: ['accesibilidad', 'captura'],
  });
  return r.hallazgos
    .filter((h) => h.tipo === 'encimado' || h.tipo === 'inalcanzable' || h.tipo === 'blanco-chico')
    .map(describir);
}

const BARRA = (extra: string): string =>
  `<div style="position:fixed;left:0;right:0;top:80px;height:140px;background:#ddd;${extra}"><button style="height:48px">Barra</button></div>`;
const AVISO = `<div data-sonner-toast style="position:fixed;left:0;right:0;top:80px;height:140px;background:#ddd"><button style="height:48px">Aviso</button></div>`;

test('una barra flotante sobre una lista con desplazamiento no es un defecto', async ({
  page,
}, info) => {
  const hallazgos = await hallazgosDe(
    page,
    info,
    'barra-sobre-lista',
    pagina({ cuerpo: LISTA + BARRA('') }),
  );
  expect(hallazgos).toEqual([]);
});

test('una barra flotante sobre un botón que NO está en una lista sí es un defecto', async ({
  page,
}, info) => {
  const suelto = `<button id="suelto" style="position:absolute;left:8px;top:90px">Suelto</button>`;
  const hallazgos = await hallazgosDe(
    page,
    info,
    'barra-sobre-suelto',
    pagina({ cuerpo: suelto + BARRA('') }),
  );
  expect(hallazgos.join('\n')).toMatch(/encimado|inalcanzable/);
});

test('un aviso transitorio sobre un botón no es un defecto', async ({ page }, info) => {
  const suelto = `<button style="position:absolute;left:8px;top:90px">Suelto</button>`;
  const hallazgos = await hallazgosDe(
    page,
    info,
    'aviso-sobre-boton',
    pagina({ cuerpo: suelto + AVISO }),
  );
  expect(hallazgos).toEqual([]);
});

test('una tarjeta que el desplazamiento deja ver a medias no es un blanco chico; un botón de 30 px entero sí', async ({
  page,
}, info) => {
  const medias = `<div style="height:90px;overflow-y:auto;border:1px solid #333"><div style="height:60px"></div><button style="display:block;height:40px;min-height:40px;width:200px;margin:0">A medias</button></div>`;
  const entero = `<button id="chico" style="height:30px;width:200px;min-height:30px;display:block;margin-top:16px">Chico</button>`;
  expect(await hallazgosDe(page, info, 'a-medias', pagina({ cuerpo: medias }))).toEqual([]);
  const sucio = await hallazgosDe(page, info, 'chico-entero', pagina({ cuerpo: entero }));
  expect(sucio.join('\n')).toMatch(/blanco-chico/);
});
