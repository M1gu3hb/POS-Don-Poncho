#!/usr/bin/env node
/**
 * LAS PÁGINAS DEL MENÚ PERSONALIZADO DEL PORTAL QR, desde los datos del menú (DP-5).
 *
 *   node scripts/generar-menu-qr.mjs
 *
 * Lee `docs/cliente/menu-don-poncho.json` (platillos y precios) y las páginas de
 * `docs/cliente/negocio-don-poncho.json` (`portal.paginas`), arma cada una con el aspecto del
 * letrero —papel crema, marco dorado, letra negra, el logo y «Del horno a tu mesa…»— y la deja
 * en `apps/web/public/menu-qr/<archivo>.webp`. Se corre otra vez cuando cambia el menú.
 *
 * Las categorías de cada página son las que nombra su TÍTULO, separadas por «·»: la misma regla
 * con la que el portal pone debajo de la página los platillos para pedir (`paginas-del-menu.ts`).
 * Usa el Chromium de Playwright y `sharp`, que ya son del repositorio.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));
const requerir = createRequire(join(RAIZ, 'apps', 'web', 'package.json'));
const { chromium } = requerir('@playwright/test');
const sharp = requerir('sharp');

const leer = (ruta) => JSON.parse(readFileSync(join(RAIZ, ruta), 'utf8'));
const menu = leer('docs/cliente/menu-don-poncho.json');
const { paginas } = leer('docs/cliente/negocio-don-poncho.json').portal;
const SALIDA = join(RAIZ, 'apps', 'web', 'public', 'menu-qr');
const LOGO = `data:image/svg+xml;base64,${readFileSync(join(RAIZ, 'apps', 'web', 'public', 'marca', 'don-poncho.svg')).toString('base64')}`;

const categoria = (nombre) => {
  const c = menu.categorias.find((x) => x.nombre === nombre);
  if (c === undefined)
    throw new Error(`La página nombra «${nombre}», que no es una categoría del menú.`);
  return c;
};
const grupo = (clave) => menu.modificadores.find((g) => g.clave === clave);
const pesos = (c) => (c % 100 === 0 ? `$${String(c / 100)}` : `$${(c / 100).toFixed(2)}`);
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');

function renglon(p) {
  const precio = p.porPeso ? `${pesos(p.precio)} <small>/ kg</small>` : pesos(p.precio);
  const detalle = p.detalle ? `<div class="detalle">${esc(p.detalle)}</div>` : '';
  return `<div class="item"><div class="linea"><span class="nombre">${esc(p.nombre)}</span><span class="puntos"></span><span class="precio">${precio}</span></div>${detalle}</div>`;
}

function bloque(nombre, conTitulo) {
  const c = categoria(nombre);
  const normales = c.productos.filter((p) => !p.nombre.endsWith('(extra)'));
  const extras = c.productos.filter((p) => p.nombre.endsWith('(extra)'));
  const tarros =
    extras.length === 0
      ? ''
      : `<div class="tarros"><b>Prepárala:</b> ${extras.map((p) => `${esc(p.nombre.replace(' (extra)', ''))} +${pesos(p.precio)}`).join(' · ')}</div>`;
  return `<section>${conTitulo ? `<h2>${esc(nombre)}</h2>` : ''}${normales.map(renglon).join('')}${tarros}</section>`;
}

function pulques() {
  const ps = categoria('Pulques').productos;
  const precio = (n) => ps.find((p) => p.nombre === n)?.precio;
  const fila = (titulo, base, clave, detalle) => {
    const medio = precio(`${base} · medio litro`);
    const sabores = clave
      ? grupo(clave)
          .opciones.map((o) => esc(o[0]) + (o[2] ? '*' : ''))
          .join(', ')
      : esc(detalle ?? '');
    return `<div class="item"><div class="linea"><span class="nombre">${titulo}</span><span class="puntos"></span><span class="precio">${pesos(precio(`${base} · litro`))}${medio ? ` <small>· ½ ${pesos(medio)}</small>` : ''}</span></div><div class="detalle">${sabores}</div></div>`;
  };
  return `<section><div class="cabeza">litro · ½ litro</div>
    ${fila('Básico', 'Pulque básico', 'sabor-pulque-basico')}
    ${fila('Especial', 'Pulque especial', 'sabor-pulque-especial')}
    ${fila('Exótico', 'Pulque exótico', 'sabor-pulque-exotico')}
    ${fila('Premium', 'Pulque premium', 'sabor-pulque-premium')}
    ${fila('Premium con licor', 'Pulque premium con licor', 'sabor-pulque-premium-licor')}
    ${fila('De piñón', 'Pulque de piñón', null, 'Premium')}
    <div class="item"><div class="linea"><span class="nombre">Natural</span><span class="puntos"></span><span class="precio">${pesos(precio('Pulque natural · litro'))} <small>/ litro</small></span></div></div>
    <p class="nota">* De temporada.</p></section>`;
}

const ESTILO = `* { box-sizing: border-box; margin: 0; }
  body { width: 540px; background: #161614; padding: 14px; font-family: 'Segoe UI', system-ui, sans-serif; color: #161614; }
  .hoja { background: #f7f5d8; border: 7px double #ac8a5f; border-radius: 6px; padding: 22px 26px 18px; }
  header { text-align: center; } header.portada img { width: 260px; } header.chica img { width: 120px; }
  .lema { font-family: Georgia, serif; font-style: italic; color: #83653f; font-size: 19px; margin-top: 4px; }
  h1 { font-family: Georgia, serif; font-size: 30px; text-align: center; margin: 14px 0 6px; }
  .orla { text-align: center; color: #ac8a5f; font-size: 16px; letter-spacing: 6px; }
  section { margin-top: 14px; }
  h2 { font-family: Georgia, serif; font-size: 21px; color: #83653f; border-bottom: 2px solid #ac8a5f; padding-bottom: 3px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1.5px; }
  .item { margin: 7px 0; } .linea { display: flex; align-items: baseline; gap: 6px; font-size: 16.5px; }
  .nombre { font-weight: 600; } .puntos { flex: 1; border-bottom: 2px dotted #ac8a5f; transform: translateY(-4px); min-width: 20px; }
  .precio { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .precio small, .cabeza { font-weight: 400; color: #5b4a33; font-size: 13px; } .cabeza { text-align: right; }
  .detalle { font-size: 13px; font-style: italic; color: #5b4a33; margin-top: 1px; line-height: 1.35; }
  .tarros { margin-top: 8px; font-size: 13.5px; background: #ece7b6; border-radius: 4px; padding: 6px 9px; }
  .nota { font-size: 13px; color: #5b4a33; text-align: center; margin-top: 12px; font-style: italic; }
  footer { margin-top: 16px; text-align: center; font-size: 11.5px; color: #5b4a33; border-top: 1px solid #ac8a5f; padding-top: 7px; }`;

function html(pagina) {
  const nombres = pagina.titulo.split('·').map((n) => n.trim());
  const cuerpo = pagina.pulques
    ? pulques()
    : nombres.map((n) => bloque(n, nombres.length > 1)).join('');
  const cabeza = pagina.portada
    ? `<header class="portada"><img src="${LOGO}" alt=""><p class="lema">Del horno a tu mesa…</p></header>`
    : `<header class="chica"><img src="${LOGO}" alt=""></header>`;
  return `<!doctype html><html lang="es-MX"><meta charset="utf-8"><style>${ESTILO}</style><body><div class="hoja">${cabeza}<h1>${esc(pagina.titulo)}</h1><div class="orla">✦ ✦ ✦</div>${cuerpo}${pagina.nota ? `<p class="nota">${esc(pagina.nota)}</p>` : ''}<footer>La Tradicional Barbacoa de Don Poncho · Precios en pesos, IVA incluido</footer></div></body></html>`;
}

mkdirSync(SALIDA, { recursive: true });
const navegador = await chromium.launch();
try {
  const hoja = await navegador.newPage({
    viewport: { width: 540, height: 800 },
    deviceScaleFactor: 2,
  });
  for (const pagina of paginas) {
    await hoja.setContent(html(pagina), { waitUntil: 'load' });
    const png = await hoja.screenshot({ fullPage: true });
    await sharp(png)
      .webp({ quality: 84 })
      .toFile(join(SALIDA, `${pagina.archivo}.webp`));
    console.log(`✓ ${pagina.archivo}.webp · ${pagina.titulo}`);
  }
} finally {
  await navegador.close();
}
