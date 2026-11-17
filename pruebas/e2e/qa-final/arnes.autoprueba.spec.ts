import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { CASOS } from './arnes/calibracion/casos.ts';
import { pagina, servirCalibracion, urlDe, type Variante } from './arnes/calibracion/pagina.ts';
import { RAIZ_DEL_QA } from './arnes/informe.ts';
import { revisarPantalla } from './arnes/revisiones.ts';
import { describir, type Hallazgo } from './arnes/tipos.ts';
import { expect, test } from './arnes/prueba.ts';
import { vigilarPagina } from './arnes/vigilancia.ts';

/**
 * LA AUTOPRUEBA DEL ARNÉS (DP-22): una revisión que no puede fallar no prueba nada.
 *
 * Cada caso de `arnes/calibracion/casos.ts` es una página con UN defecto sembrado. La prueba pasa
 * sólo si el arnés lo detecta (el tipo de hallazgo que dice `esperado` sale en la variante sucia) y
 * la variante limpia de la misma página da 0 hallazgos. Corre en cada aparato: un Windows táctil
 * (Chrome 156), el iMin con Chromium 99, un teléfono…
 */

const PAGINAS = new Map<string, string>(
  CASOS.flatMap((caso) =>
    (['sucia', 'limpia'] as const).map((v): [string, string] => [
      `/caso/${caso.id}/${v}`,
      caso.html[v],
    ]),
  ),
);

interface Fila {
  readonly caso: string;
  readonly defecto: string;
  readonly detectado: boolean;
  readonly limpiaSinHallazgos: boolean;
  readonly tiposVistos: readonly string[];
}
const filas: Fila[] = [];

test.afterAll(({ browser }, info) => {
  const aparato = String(info.project.metadata['aparatoId']);
  const detectados = filas.filter((f) => f.detectado && f.limpiaSinHallazgos).length;
  const lineas = filas.map(
    (f) =>
      `  ${f.detectado && f.limpiaSinHallazgos ? 'OK ' : 'MAL'} ${f.caso.padEnd(32)} sucia: ${f.tiposVistos.join(', ') || '(nada)'}${f.limpiaSinHallazgos ? '' : '  · LIMPIA CON HALLAZGOS'}`,
  );
  process.stdout.write(
    `\n[autoprueba] ${aparato} (Chromium ${browser.version()}): ${String(detectados)}/${String(CASOS.length)} defectos sembrados detectados\n${lineas.join('\n')}\n`,
  );
  mkdirSync(join(RAIZ_DEL_QA, 'informes'), { recursive: true });
  writeFileSync(
    join(RAIZ_DEL_QA, 'informes', `autoprueba-${aparato}.json`),
    JSON.stringify({ aparato, sembrados: CASOS.length, detectados, filas }, null, 1),
  );
});

for (const caso of CASOS) {
  test(`${caso.id}: el arnés detecta «${caso.defecto}» y no se queja de la variante limpia`, async ({
    page,
    aparato,
  }, info) => {
    vigilarPagina(page);
    await servirCalibracion(page, PAGINAS);
    const medir = async (variante: Variante): Promise<readonly Hallazgo[]> => {
      await page.goto(urlDe(caso.id, variante));
      await page.waitForLoadState('networkidle');
      const resultado = await revisarPantalla(page, info, {
        pantalla: `autoprueba-${caso.id}`,
        estado: variante,
        modo: 'barrido',
        extras: caso.extras?.(page, aparato) ?? [],
      });
      return resultado.hallazgos;
    };
    const sucia = await medir('sucia');
    const limpia = await medir('limpia');
    const tiposVistos = [...new Set(sucia.map((h) => h.tipo))];
    filas.push({
      caso: caso.id,
      defecto: caso.defecto,
      detectado: tiposVistos.includes(caso.esperado),
      limpiaSinHallazgos: limpia.length === 0,
      tiposVistos,
    });
    expect(tiposVistos, `la variante sucia tiene que dar «${caso.esperado}»`).toContain(
      caso.esperado,
    );
    expect(limpia.map(describir), 'la variante limpia no puede tener hallazgos').toEqual([]);
  });
}

test('la elipsis intencional no es una falla: se informa aparte', async ({
  page,
  aparato,
}, info) => {
  const html = pagina({
    cuerpo: `<div id="e" style="width:120px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;border:1px solid #333">Un nombre de platillo larguísimo que no cabe</div>`,
  });
  await servirCalibracion(page, new Map([['/caso/elipsis/limpia', html]]));
  await page.goto(urlDe('elipsis', 'limpia'));
  const resultado = await revisarPantalla(page, info, {
    pantalla: 'autoprueba-elipsis',
    estado: aparato.id,
    modo: 'barrido',
  });
  expect(resultado.hallazgos.map(describir)).toEqual([]);
  expect(resultado.informativos.map((i) => i.tipo)).toContain('elipsis-intencional');
});

test('en modo estricto la revisión LANZA con la lista de hallazgos', async ({ page }, info) => {
  const sucia = CASOS.find((c) => c.id === 'desborde')?.html.sucia ?? '';
  await servirCalibracion(page, new Map([['/caso/estricto/sucia', sucia]]));
  await page.goto(urlDe('estricto', 'sucia'));
  await expect(
    revisarPantalla(page, info, { pantalla: 'autoprueba-estricto', estado: 'sucia' }),
  ).rejects.toThrow(/desborde/);
});
