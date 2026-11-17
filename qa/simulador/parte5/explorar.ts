/**
 * EXPLORAR UNA PANTALLA (DP-22 · Parte 5): entra con una persona de la copia, abre una ruta con el
 * aparato pedido (con el dedo si es táctil), la captura y lista lo que se puede tocar. Sólo mira.
 *
 *   node --conditions=react-server qa/simulador/parte5/explorar.ts --app … --base … --pines … --reloj …
 *     --salida … --aparato tableta-1024 --quien "Dueño Don Poncho" --ruta /inventario --nombre inventario
 */
import { join } from 'node:path';

import { ponerElDedo, aparatoPedido } from '../dedo.ts';
import { leerEntorno } from '../entorno.ts';
import { abrirNavegador, sesionDe } from '../sesion.ts';

function arg(nombre: string, porOmision: string): string {
  const i = process.argv.indexOf(`--${nombre}`);
  return (i === -1 ? undefined : process.argv[i + 1]) ?? porOmision;
}

const entorno = leerEntorno();
const navegador = await abrirNavegador();
try {
  const aparato = aparatoPedido();
  const { pagina } = await sesionDe(navegador, entorno, arg('quien', 'Dueño Don Poncho'), aparato);
  if (aparato !== 'pc-1920') ponerElDedo(pagina);
  await pagina.goto(`${entorno.appUrl}${arg('ruta', '/')}`, { waitUntil: 'domcontentloaded' });
  await pagina.waitForTimeout(Number(arg('espera', '6000')));
  for (const nombreDelBoton of arg('tocar', '')
    .split('|')
    .filter((x) => x !== '')) {
    await pagina
      .getByRole('button', { name: new RegExp(nombreDelBoton) })
      .first()
      .click();
    await pagina.waitForTimeout(2500);
  }
  const nombre = arg('nombre', 'pantalla');
  await pagina.screenshot({ path: join(entorno.salida, `explorar-${nombre}.png`), fullPage: true });
  const cosas = await pagina
    .locator('button, [role=switch], [role=tab], a[href], input, select, [role=combobox]')
    .evaluateAll((els) =>
      els.slice(0, 150).map((e) => {
        const el = e as HTMLElement;
        const r = el.getBoundingClientRect();
        const rol = el.getAttribute('role');
        const nombre = el.getAttribute('aria-label') ?? el.innerText;
        return `${el.tagName.toLowerCase()}${rol === null ? '' : `[${rol}]`} «${nombre.trim().replace(/\s+/g, ' ').slice(0, 60)}» ${String(Math.round(r.width))}x${String(Math.round(r.height))}`;
      }),
    );
  process.stdout.write(`${pagina.url()}\n${cosas.join('\n')}\n`);
} finally {
  await navegador.close();
}
