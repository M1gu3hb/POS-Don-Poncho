#!/usr/bin/env node
/**
 * LAS CAPTURAS Y EL VIDEO DE LOS PILOTOS (DP-11.4), para que Miguel decida.
 *
 *   node scripts/capturar-pilotos.mjs --url http://localhost:3400 --secretos <demo.json> \
 *        --salida <carpeta> [--estilos morphiq,don-poncho,retro] [--aparatos escritorio,tablet,telefono]
 *        [--video]
 *
 * Corre contra la demo local (`scripts/demo-local.mjs`, con sus PIN de DEMO): se niega con un
 * servidor que no sea de esta máquina. Por aparato y modo (claro u oscuro del sistema, con el
 * aparato en «Automático»), entra como el dueño, la mesera y la caja una vez, y por cada estilo
 * retrata: el Tablero, el mapa de Mesero, la mesa abierta, la Caja y el diálogo de cobro.
 *
 * El estilo se pone en los atributos del `<html>` (como `/sistema` y la galería): las capturas no
 * cambian la apariencia guardada del negocio. `--video` graba en tableta el recorrido de servicio
 * (abrir una mesa, agregar, enviar a cocina, cobrar con el teclado) con el estilo de la casa.
 */
/* global document -- lo que corre dentro de la página (page.evaluate) */
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { chromium, devices } from '@playwright/test';

import {
  crearEntrada,
  dialogoDeLaMesa,
  laMesa,
  prepararLaMesa,
} from './lib/demo-en-el-navegador.mjs';

const argumento = (nombre, porOmision) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? porOmision : (process.argv[i + 1] ?? porOmision);
};
const URL_BASE = argumento('url', 'http://localhost:3400').replace(/\/$/, '');
const SECRETOS = argumento('secretos', '');
const SALIDA = argumento('salida', '');
const ESTILOS = argumento('estilos', 'morphiq,don-poncho,retro').split(',');
const APARATOS = argumento('aparatos', 'escritorio,tablet,telefono').split(',');
const CON_VIDEO = process.argv.includes('--video');

if (!['localhost', '127.0.0.1'].includes(new URL(URL_BASE).hostname) || !SECRETOS || !SALIDA) {
  console.error(
    'Uso: capturar-pilotos.mjs --url http://localhost:<puerto> --secretos <demo.json> --salida <carpeta>',
  );
  process.exit(2);
}

const { pinDelDueno, pines } = JSON.parse(readFileSync(SECRETOS, 'utf8'));
const DUENO = 'Miguel · Morphiq';
const entrar = crearEntrada(URL_BASE, { [DUENO]: pinDelDueno, ...pines });
const EMULACION = {
  escritorio: { viewport: { width: 1440, height: 900 } },
  tablet: devices['Galaxy Tab S4 landscape'],
  telefono: devices['Pixel 7'],
};
/** Las perillas de fábrica de cada estilo (las de `packages/ui/src/tokens/estilos.ts`). */
const PERILLAS = {
  morphiq: { densidad: 'normal', redondeo: 'media', elevacion: 'capas', movimiento: 'normal' },
  'don-poncho': { densidad: 'comoda', redondeo: 'sutil', elevacion: 'capas', movimiento: 'sutil' },
  retro: { densidad: 'normal', redondeo: 'sutil', elevacion: 'aero', movimiento: 'normal' },
};

async function ponerEstilo(page, estilo) {
  await page.evaluate(
    ({ estilo, perillas }) => {
      const raiz = document.documentElement;
      raiz.setAttribute('data-estilo', estilo);
      for (const [perilla, valor] of Object.entries(perillas))
        raiz.setAttribute(`data-${perilla}`, valor);
    },
    { estilo, perillas: PERILLAS[estilo] },
  );
  // Lo que se acomoda al cambiar de estilo (densidad, radios) y las transiciones de la perilla.
  await page.waitForTimeout(400);
}

async function retratar(page, carpeta, nombre) {
  await page.screenshot({ path: join(carpeta, `${nombre}.jpg`), type: 'jpeg', quality: 82 });
}

/** La caja abierta EN ESTA terminal, para que el diálogo de cobro se pueda abrir. */
async function cajaAbierta(page) {
  // Si quedó abierta en otra terminal (otra corrida, otro aparato), se usa aquí.
  const usarAqui = page.getByRole('button', { name: 'Usar esta caja aquí' });
  if (await usarAqui.isVisible()) {
    await usarAqui.click();
    await usarAqui.waitFor({ state: 'hidden', timeout: 30_000 });
  }
  const abrir = page.getByRole('button', { name: 'Abrir caja' }).first();
  if (!(await abrir.isVisible()) || !(await abrir.isEnabled())) return;
  await abrir.click();
  const apertura = page.getByRole('dialog').filter({ hasText: 'Efectivo inicial contado' });
  await apertura.getByPlaceholder('0.00').fill('500.00');
  await apertura.getByRole('button', { name: 'Abrir caja' }).click();
  await page.getByText('Caja abierta. Ya puedes cobrar.').first().waitFor({ timeout: 30_000 });
}

/** La cuenta pendiente de la mesa 1, hasta su diálogo de cobro (la caja pregunta antes la propina). */
async function abrirElCobro(page) {
  await page.getByRole('tab', { name: /^Pendientes/ }).click();
  const cuenta = page.getByRole('button', { name: /^Mesa 1 Cuenta/ }).first();
  if (!(await cuenta.isVisible())) return null;
  await cuenta.click();
  const cobro = page.getByRole('dialog').filter({ hasText: 'Cobrar — Mesa 1' });
  const sinPropina = page.getByText('Sin propina', { exact: true });
  await sinPropina.or(cobro).first().waitFor({ timeout: 30_000 });
  if (await sinPropina.isVisible()) await sinPropina.click();
  await cobro.waitFor({ timeout: 30_000 });
  return cobro;
}

/** La mesera pide la cuenta de la mesa 1 (sin propina), para que la caja la tenga pendiente. */
async function pedirLaCuenta(page) {
  await laMesa(page, 1).click();
  const mesa = dialogoDeLaMesa(page, 1);
  await mesa.waitFor();
  const pedir = mesa.getByRole('button', { name: 'Solicitar cuenta', exact: true });
  if (!(await pedir.isVisible())) {
    await page.keyboard.press('Escape');
    return;
  }
  await pedir.click();
  // La pregunta de la propina sólo sale si el negocio la tiene encendida.
  const pregunta = page.getByRole('dialog').filter({ hasText: '¿Desean agregar propina?' });
  const precuenta = page.getByText('PRE-CUENTA').first();
  await pregunta.or(precuenta).first().waitFor({ timeout: 30_000 });
  if (await pregunta.isVisible())
    await pregunta.getByRole('button', { name: 'Sin propina' }).click();
  await precuenta.waitFor({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Cerrar', exact: true }).first().click();
}

async function capturas(navegador) {
  for (const aparato of APARATOS) {
    for (const modo of ['claro', 'oscuro']) {
      const contexto = await navegador.newContext({
        ...EMULACION[aparato],
        colorScheme: modo === 'oscuro' ? 'dark' : 'light',
      });
      const page = await contexto.newPage();
      const carpeta = join(SALIDA, aparato, modo);
      mkdirSync(carpeta, { recursive: true });

      await entrar(page, 'Mesero 1');
      await prepararLaMesa(page, URL_BASE);
      await page.goto(`${URL_BASE}/mesero`);
      await laMesa(page, 1).waitFor();
      await pedirLaCuenta(page);
      for (const estilo of ESTILOS) {
        await ponerEstilo(page, estilo);
        await retratar(page, carpeta, `mesero-${estilo}`);
        await laMesa(page, 1).click();
        await dialogoDeLaMesa(page, 1).waitFor();
        await page.waitForTimeout(600);
        await retratar(page, carpeta, `mesa-${estilo}`);
        await page.keyboard.press('Escape');
      }

      await entrar(page, DUENO);
      await page.getByRole('heading', { level: 1 }).first().waitFor();
      for (const estilo of ESTILOS) {
        await ponerEstilo(page, estilo);
        await retratar(page, carpeta, `tablero-${estilo}`);
      }

      await entrar(page, 'Caja');
      await page.getByRole('heading', { name: 'Caja', level: 1 }).waitFor();
      await cajaAbierta(page);
      for (const estilo of ESTILOS) {
        await ponerEstilo(page, estilo);
        await retratar(page, carpeta, `caja-${estilo}`);
        const cobro = await abrirElCobro(page);
        if (cobro !== null) {
          await page.waitForTimeout(600);
          await retratar(page, carpeta, `cobro-${estilo}`);
          await page.keyboard.press('Escape');
        }
      }
      await contexto.close();
      console.log(`  ${aparato} · ${modo}: listo`);
    }
  }
}

/** En tableta, con el estilo de la casa: abrir la mesa 2, agregar, enviar y cobrar la 1. */
async function video(navegador) {
  const contexto = await navegador.newContext({
    ...EMULACION.tablet,
    recordVideo: { dir: SALIDA, size: { width: 1138, height: 712 } },
  });
  const page = await contexto.newPage();
  await entrar(page, 'Mesero 1');
  await page.goto(`${URL_BASE}/mesero`);
  await laMesa(page, 2).waitFor();
  await page.waitForTimeout(800);
  await laMesa(page, 2).click();
  const apertura = page.getByRole('dialog', { name: 'Abrir mesa 2' });
  if (await apertura.isVisible()) {
    await apertura.getByRole('spinbutton').first().fill('2');
    await page.waitForTimeout(500);
    await apertura.getByRole('button', { name: 'Abrir mesa' }).click();
  }
  const mesa = dialogoDeLaMesa(page, 2);
  await mesa.waitFor();
  await page.waitForTimeout(800);
  const platillos = mesa.getByRole('button', { name: / \$\d/ });
  for (const i of [0, 1, 1, 4]) {
    await platillos.nth(i).click();
    await page.waitForTimeout(450);
  }
  await mesa.getByRole('button', { name: 'Enviar a Cocina', exact: true }).click();
  await page.getByText('¡Pedido enviado a cocina!').first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1200);
  await page.keyboard.press('Escape');

  await entrar(page, 'Caja');
  await page.getByRole('heading', { name: 'Caja', level: 1 }).waitFor();
  await cajaAbierta(page);
  await page.waitForTimeout(800);
  const cobro = await abrirElCobro(page);
  if (cobro === null) throw new Error('La mesa 1 no tiene cuenta pendiente en la caja.');
  await page.waitForTimeout(800);
  await cobro.getByRole('button', { name: 'Efectivo', exact: true }).click();
  await page.waitForTimeout(400);
  for (const tecla of ['5', '0', '0']) {
    await cobro.getByRole('button', { name: tecla, exact: true }).click();
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(800);
  await cobro.getByRole('button', { name: /^Cobrar \$/ }).click();
  await page.getByText('TICKET DE PAGO').first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(2000);
  const grabado = page.video();
  await contexto.close();
  console.log(`  video: ${grabado ? await grabado.path() : '(sin video)'}`);
}

mkdirSync(SALIDA, { recursive: true });
const navegador = await chromium.launch();
try {
  await capturas(navegador);
  if (CON_VIDEO) await video(navegador);
} finally {
  await navegador.close();
}
