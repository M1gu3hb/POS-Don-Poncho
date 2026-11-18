/** Sonda: imprime lo que trae una pantalla (botones, campos, textos) para escribir su paso. Sólo mira. */
import { join } from 'node:path';

import { ponerElDedo } from '../dedo.ts';
import { leerEntorno } from '../entorno.ts';
import { dialogoCon } from '../pantallas/comun.ts';
import { abrirNavegador, sesionDe } from '../sesion.ts';

const entorno = leerEntorno();
const arg = (n: string): string => {
  const i = process.argv.indexOf(`--${n}`);
  return i === -1 ? '' : (process.argv[i + 1] ?? '');
};
const navegador = await abrirNavegador();
try {
  const { pagina } = await sesionDe(
    navegador,
    entorno,
    arg('quien') || 'Dueño Don Poncho',
    'tableta-1024',
  );
  ponerElDedo(pagina);
  await pagina.goto(`${entorno.appUrl}${arg('ruta')}`, { waitUntil: 'domcontentloaded' });
  await pagina.waitForTimeout(Number(arg('espera') || '8000'));
  for (const nombre of arg('tocar')
    .split('|')
    .filter((x) => x !== '')) {
    await pagina
      .getByRole('button', { name: new RegExp(nombre) })
      .or(pagina.getByRole('tab', { name: new RegExp(nombre) }))
      .first()
      .click({ timeout: 30_000 });
    await pagina.waitForTimeout(2500);
  }
  if (arg('combo') !== '') {
    await pagina
      .getByRole('dialog')
      .getByRole('combobox')
      .nth(Number(arg('combo')))
      .click();
    process.stdout
      .write(`OPCIONES: ${(await pagina.getByRole('option').allInnerTexts()).join(' | ')}
`);
    if (arg('elegir') !== '')
      await pagina.getByRole('option', { name: new RegExp(arg('elegir')) }).click();
    await pagina.waitForTimeout(1000);
  }
  const zona = arg('dialogo') === '' ? pagina.locator('body') : dialogoCon(pagina, arg('dialogo'));
  const texto = (await zona.innerText()).replace(/\s+/g, ' ').slice(0, 1500);
  process.stdout.write(`TEXTO: ${texto}\n`);
  const cosas = await zona
    .locator('button, input, textarea, select, [role=combobox], [role=switch], [role=tab]')
    .evaluateAll((els) =>
      els.slice(0, 80).map((e) => {
        const el = e as HTMLInputElement;
        return `${el.tagName.toLowerCase()}${el.getAttribute('role') === null ? '' : `[${el.getAttribute('role') ?? ''}]`} «${(el.getAttribute('aria-label') ?? el.innerText).trim().replace(/\s+/g, ' ').slice(0, 50)}» ph=${el.getAttribute('placeholder') ?? ''} id=${el.id}`;
      }),
    );
  process.stdout.write(`${cosas.join('\n')}\n`);
  await pagina.screenshot({ path: join(entorno.salida, `sonda-${arg('nombre') || 'x'}.png`) });
} finally {
  await navegador.close();
}
