/**
 * HALLAZGO 17 · los interruptores de Configuración → Este aparato: nombre accesible y tamaño del
 * blanco (con el árbol de accesibilidad, no con `aria-label`). Sólo mira.
 */
import { leerEntorno } from '../entorno.ts';
import { ponerElDedo } from '../dedo.ts';
import { abrirNavegador, sesionDe } from '../sesion.ts';

const entorno = leerEntorno();
const navegador = await abrirNavegador();
try {
  const { pagina } = await sesionDe(navegador, entorno, 'Dueño Don Poncho', 'tableta-1024');
  ponerElDedo(pagina);
  await pagina.goto(`${entorno.appUrl}/configuracion?seccion=este-aparato`, {
    waitUntil: 'domcontentloaded',
  });
  await pagina.getByRole('switch').first().waitFor({ timeout: 60_000 });
  const total = await pagina.getByRole('switch').count();
  for (let i = 0; i < total; i += 1) {
    const s = pagina.getByRole('switch').nth(i);
    const caja = await s.boundingBox();
    const info = await s.evaluate((e) => ({
      aria: e.getAttribute('aria-label'),
      por: e.getAttribute('aria-labelledby'),
      texto: document.getElementById(e.getAttribute('aria-labelledby') ?? '')?.textContent ?? null,
    }));
    process.stdout.write(
      `switch ${String(i)} ${JSON.stringify(caja && { w: Math.round(caja.width), h: Math.round(caja.height) })} ${JSON.stringify(info)}\n`,
    );
  }
  for (const nombre of ['Modo espera en este aparato']) {
    process.stdout.write(
      `por nombre «${nombre}»: ${String(await pagina.getByRole('switch', { name: nombre }).count())}\n`,
    );
  }
} finally {
  await navegador.close();
}
