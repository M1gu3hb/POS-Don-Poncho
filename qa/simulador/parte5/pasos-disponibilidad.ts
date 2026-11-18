/**
 * OCULTAR DEL PORTAL Y «NO DISPONIBLE» (DP-22, Parte 5): un platillo oculto («Visible en POS» apagado
 * en Recetas) no sale en el portal ni en ninguna caja; uno agotado («Agotados» de la cocina) no se
 * puede pedir en ningún canal; y los dos se vuelven a poner. Todo por pantallas y con el dedo.
 */
import type { Page } from '@playwright/test';

import { abrirElQr } from '../bots/comensal-ui.ts';
import { abrirMesa, alMapa, mesasEnPantalla } from '../bots/mesero-ui.ts';
import { ponerElDedo } from '../dedo.ts';
import { irACaja } from '../pantallas/caja.ts';
import { dialogoCon } from '../pantallas/comun.ts';
import { contextoDe } from '../sesion.ts';
import { captura } from './ayudas-p5.ts';
import type { Contexto, Puestos } from './pasos-extra.ts';

/** «Visible en POS» de un platillo, por Recetas → Editar receta (con el dedo). */
async function ponerVisible(c: Contexto, q: Page, nombre: string, visible: boolean): Promise<void> {
  await q.goto(`${c.entorno.appUrl}/recetas`, { waitUntil: 'domcontentloaded' });
  await q
    .getByRole('button', { name: new RegExp(nombre) })
    .first()
    .click({ timeout: 60_000 });
  await q.getByRole('button', { name: 'Editar receta' }).first().click();
  const d = dialogoCon(q, 'Editar receta');
  const interruptor = d.getByRole('switch').nth(1);
  const marcado = (await interruptor.getAttribute('aria-checked')) === 'true';
  if (marcado !== visible) await interruptor.click();
  const guardado = q.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().includes('/api/') && r.ok(),
    { timeout: 45_000 },
  );
  await d.getByRole('button', { name: 'Guardar cambios' }).click();
  await guardado;
  await d.waitFor({ state: 'hidden', timeout: 30_000 });
}

/** Cómo se ve un platillo en el portal de una mesa: cuántas fichas y qué dicen. */
async function enElPortal(
  c: Contexto,
  token: string,
  nombre: string,
): Promise<{ fichas: number; texto: string }> {
  const { pagina, contexto } = await contextoDe(c.navegador, c.entorno, 'android-360');
  ponerElDedo(pagina);
  try {
    await abrirElQr(pagina, c.entorno.appUrl, token);
    await pagina.waitForTimeout(2_500);
    const fichas = pagina.getByRole('button', { name: new RegExp(`^${nombre}[ ,]`) });
    const texto = (
      await fichas
        .first()
        .innerText()
        .catch(() => '')
    ).replace(/\s+/g, ' ');
    return { fichas: await fichas.count(), texto };
  } finally {
    await contexto.close();
  }
}

/** Cómo se ve un platillo en el «Para llevar» de la caja. */
async function enParaLlevar(
  c: Contexto,
  caja: Page,
  nombre: string,
): Promise<{ fichas: number; deshabilitadas: number }> {
  await irACaja(caja, c.entorno.appUrl);
  await caja
    .getByRole('button', { name: /^Para llevar/ })
    .first()
    .click();
  const pedido = dialogoCon(caja, 'Pedido para llevar');
  await pedido.getByLabel('Nombre').waitFor({ timeout: 30_000 });
  const fichas = pedido.getByRole('button', { name: new RegExp(`^${nombre}\\s+\\$`) });
  const n = await fichas.count();
  let off = 0;
  for (let i = 0; i < n; i += 1) if (await fichas.nth(i).isDisabled()) off += 1;
  await caja.keyboard.press('Escape');
  return { fichas: n, deshabilitadas: off };
}

/** «Agotado hoy» de un platillo, por la cocina (Agotados → su interruptor). */
async function agotar(cocina: Page, c: Contexto, nombre: string, agotado: boolean): Promise<void> {
  await cocina.goto(`${c.entorno.appUrl}/cocina`, { waitUntil: 'domcontentloaded' });
  await cocina.getByRole('button', { name: 'Agotados', exact: true }).click({ timeout: 60_000 });
  const d = cocina.getByRole('dialog').last();
  const interruptor = d.getByRole('switch', { name: `${nombre}: agotado hoy` });
  await interruptor.waitFor({ timeout: 45_000 });
  if ((await interruptor.getAttribute('aria-checked')) !== String(agotado)) {
    const guardado = cocina.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().includes('/api/') && r.ok(),
      { timeout: 45_000 },
    );
    await interruptor.click();
    await guardado;
  }
  await cocina.keyboard.press('Escape');
}

/** La ficha del platillo en la mesa del mesero (con una mesa abierta): cuántas hay y si están apagadas. */
async function enLaMesa(
  p: Puestos,
  mesa: number,
  nombre: string,
): Promise<{ fichas: number; deshabilitadas: number }> {
  const dialogo = p.mesero.getByRole('dialog', { name: new RegExp(`^Mesa ${String(mesa)} `) });
  const fichas = dialogo.getByRole('button', { name: new RegExp(`^${nombre} \\$`) });
  const n = await fichas.count();
  let off = 0;
  for (let i = 0; i < n; i += 1) if (await fichas.nth(i).isDisabled()) off += 1;
  return { fichas: n, deshabilitadas: off };
}

export async function pasoDisponibilidad(c: Contexto, p: Puestos): Promise<void> {
  const i = c.informe;
  const libre = (await mesasEnPantalla(p.mesero)).find((m) => m.estado === 'Libre');
  if (libre === undefined) throw new Error('No hay una mesa libre.');
  const token = c.mesas.find((m) => m.numero === libre.numero)?.qrToken;
  if (token === undefined) throw new Error('La mesa no tiene QR.');
  // La mesa abierta (sin pedir nada) es donde se mira la ficha del mesero.
  await abrirMesa(p.mesero, libre.numero, 2, { celebracion: false, alergia: '' });

  // 1 · OCULTAR: «Flan de prueba» deja de verse en el portal y en el para llevar, y vuelve.
  const antes = await enElPortal(c, token, 'Flan de prueba');
  i.punto('disponibilidad', 'el Flan (visible) sale en el portal: fichas', 1, antes.fichas);
  await ponerVisible(c, p.dueno, 'Flan de prueba', false);
  const oculto = await enElPortal(c, token, 'Flan de prueba');
  i.punto(
    'disponibilidad',
    'el Flan OCULTO no sale en el portal: fichas',
    0,
    oculto.fichas,
    await captura(p.mesero, c.salida, 'oculto-mesero'),
  );
  const llevarOculto = await enParaLlevar(c, p.caja, 'Flan de prueba');
  i.punto(
    'disponibilidad',
    'el Flan OCULTO no sale en el para llevar: fichas',
    0,
    llevarOculto.fichas,
  );
  const mesaOculto = await enLaMesa(p, libre.numero, 'Flan de prueba');
  i.punto(
    'disponibilidad',
    'el Flan OCULTO no sale en la mesa del mesero: fichas',
    0,
    mesaOculto.fichas,
  );
  await ponerVisible(c, p.dueno, 'Flan de prueba', true);
  const vuelto = await enElPortal(c, token, 'Flan de prueba');
  i.punto(
    'disponibilidad',
    'el Flan que se vuelve a mostrar sale otra vez en el portal: fichas',
    1,
    vuelto.fichas,
  );

  // 2 · NO DISPONIBLE: el Taco, agotado desde la cocina, no se puede pedir en ningún canal, y vuelve.
  await agotar(p.cocina, c, 'Taco de prueba', true);
  await p.mesero.reload({ waitUntil: 'domcontentloaded' });
  await p.mesero.getByText(/mesa/i).first().waitFor({ timeout: 60_000 });
  const portal = await enElPortal(c, token, 'Taco de prueba');
  const noSePuedePedir = (f: { fichas: number; deshabilitadas?: number }, texto = ''): boolean =>
    f.fichas === 0 || (f.deshabilitadas ?? 0) === f.fichas || /agotad/i.test(texto);
  i.punto(
    'disponibilidad',
    'el Taco AGOTADO no se puede pedir en el portal (sin ficha o marcada «agotado»)',
    true,
    noSePuedePedir(portal, portal.texto),
    undefined,
  );
  i.nota('disponibilidad', `portal con el Taco agotado: ${JSON.stringify(portal)}`);
  const llevar = await enParaLlevar(c, p.caja, 'Taco de prueba');
  i.punto(
    'disponibilidad',
    'el Taco AGOTADO no se puede pedir en el para llevar',
    true,
    noSePuedePedir(llevar),
  );
  i.nota('disponibilidad', `para llevar con el Taco agotado: ${JSON.stringify(llevar)}`);
  await p.mesero
    .getByRole('button', { name: new RegExp(`^${String(libre.numero)}\\b`) })
    .first()
    .click()
    .catch(() => undefined);
  const mesa = await enLaMesa(p, libre.numero, 'Taco de prueba');
  i.punto(
    'disponibilidad',
    'el Taco AGOTADO no se puede pedir en la mesa del mesero',
    true,
    noSePuedePedir(mesa),
    await captura(p.mesero, c.salida, 'agotado-mesero'),
  );
  i.nota('disponibilidad', `mesa con el Taco agotado: ${JSON.stringify(mesa)}`);
  await agotar(p.cocina, c, 'Taco de prueba', false);
  const otra = await enElPortal(c, token, 'Taco de prueba');
  i.punto(
    'disponibilidad',
    'el Taco que se vuelve a poner sale en el portal sin marca de agotado',
    true,
    otra.fichas === 1 && !/agotad/i.test(otra.texto),
  );
  await alMapa(p.mesero);
}
