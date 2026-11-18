/**
 * HALLAZGO 17 y D · los interruptores de Configuración → Este aparato: nombre accesible y BLANCO TÁCTIL
 * (el pseudo-elemento de `blancos-tactiles.css` que crece el área de toque a 44 px sin cambiar lo que
 * se ve). Con el dedo de verdad: se toca a 20 px del centro, fuera de la caja visible de 32×18.
 */
import { ponerElDedo } from '../dedo.ts';
import { leerEntorno } from '../entorno.ts';
import { abrirNavegador, sesionDe } from '../sesion.ts';

const entorno = leerEntorno();
const navegador = await abrirNavegador();
try {
  const { pagina } = await sesionDe(navegador, entorno, 'Dueño Don Poncho', 'tableta-1024');
  ponerElDedo(pagina);
  await pagina.goto(`${entorno.appUrl}/configuracion?seccion=este-aparato`, {
    waitUntil: 'domcontentloaded',
  });
  await pagina
    .getByRole('switch', { name: 'Modo espera en este aparato' })
    .waitFor({ timeout: 60_000 });
  const marca = await pagina.evaluate(() =>
    document.documentElement.getAttribute('data-pos-tactil'),
  );
  const interruptor = pagina.getByRole('switch', { name: 'Modo espera en este aparato' });
  await interruptor.scrollIntoViewIfNeeded();
  const caja = await interruptor.boundingBox();
  const detalle = await interruptor.evaluate((e) => {
    const r = e.getBoundingClientRect();
    const despues = getComputedStyle(e, '::after');
    const aTocar = (dx: number, dy: number): boolean => {
      const x = r.x + r.width / 2 + dx;
      const y = r.y + r.height / 2 + dy;
      const el = document.elementFromPoint(x, y);
      return el === e || e.contains(el);
    };
    return {
      alto: Math.round(r.height),
      ancho: Math.round(r.width),
      despuesAncho: despues.width,
      despuesAlto: despues.height,
      tocaA20Arriba: aTocar(0, -20),
      tocaA20Costado: aTocar(-20, 0),
      tocaA30: aTocar(0, -30),
      posicion: getComputedStyle(e).position,
      overflow: getComputedStyle(e).overflow,
      enElPunto: (() => {
        const x = r.x + r.width / 2;
        const y = r.y + r.height / 2 - 20;
        const el = document.elementFromPoint(x, y);
        return el === null
          ? null
          : `${el.tagName}.${(el.getAttribute('class') ?? '').slice(0, 60)}`;
      })(),
      pseudo: {
        posicion: despues.position,
        contenido: despues.content,
        izq: despues.left,
        arriba: despues.top,
        transformacion: despues.transform,
        eventos: despues.pointerEvents,
      },
    };
  });
  process.stdout.write(
    `data-pos-tactil=${String(marca)} caja=${JSON.stringify(caja)}\n${JSON.stringify(detalle)}\n`,
  );
} finally {
  await navegador.close();
}
