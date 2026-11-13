/**
 * PARA LLEVAR en la caja: la cajera arma el pedido tocando platillos, lo cobra directo (el cobro
 * es el de siempre) y cuando la cocina lo deja listo lo marca «Entregado».
 */
import { expect, type Locator, type Page } from '@playwright/test';

import { dialogoCon, esperarPost } from './comun.ts';

export interface RenglonLlevar {
  readonly producto: string;
  readonly veces: number;
}

/** Lo que dice «Cobrar $…» del pedido para llevar (0 si el pedido está vacío). */
async function totalDelBoton(pedido: Locator): Promise<number> {
  const boton = pedido.getByRole('button', { name: /^Cobrar \$/ }).first();
  if ((await boton.count()) === 0) return 0;
  const texto = await boton.innerText();
  const m = /\$\s*([\d,]+(?:\.\d\d)?)/.exec(texto);
  return m?.[1] === undefined ? 0 : Math.round(Number(m[1].replaceAll(',', '')) * 100);
}

/** Cuánto borrador sobrante (centavos) se descartó en esta página: quien arma lo lee y lo registra. */
const borradoresSobrantes = new WeakMap<Page, number>();
export function tomarBorradorSobrante(pagina: Page): number {
  const n = borradoresSobrantes.get(pagina) ?? 0;
  borradoresSobrantes.delete(pagina);
  return n;
}

/** Arma el pedido (sólo platillos sin opciones ni peso) y toca «Cobrar $…»; devuelve el diálogo del cobro. */
export async function armarParaLlevar(
  pagina: Page,
  nombre: string,
  renglones: readonly RenglonLlevar[],
): Promise<{ cobro: Locator; ordenId: string }> {
  await pagina
    .getByRole('button', { name: /^Para llevar/ })
    .first()
    .click();
  let pedido = dialogoCon(pagina, 'Pedido para llevar');
  await expect(pedido.getByLabel('Nombre')).toBeVisible();
  // El borrador del pedido vive en el aparato y la app sólo lo borra si ve terminar el cobro en la
  // misma página: tras una recarga a media venta sobrevive y el pedido nuevo se armaba encima.
  // Se avisa (lo registra quien llama) y se descarta como lo hace la app al cobrar.
  const sobrante = await totalDelBoton(pedido);
  if (sobrante > 0) {
    await pagina.evaluate(() => {
      for (const llave of Object.keys(window.localStorage))
        if (llave.endsWith('.para-llevar')) window.localStorage.removeItem(llave);
    });
    await pagina.reload({ waitUntil: 'domcontentloaded' });
    await pagina
      .getByRole('button', { name: /^Para llevar/ })
      .first()
      .click();
    pedido = dialogoCon(pagina, 'Pedido para llevar');
    await expect(pedido.getByLabel('Nombre')).toBeVisible();
    borradoresSobrantes.set(pagina, (borradoresSobrantes.get(pagina) ?? 0) + sobrante);
  }
  if (nombre !== '') await pedido.getByLabel('Nombre').fill(nombre);
  for (const r of renglones) {
    const loseta = pedido
      .getByRole('button', { name: new RegExp(`^${r.producto}\\s+\\$`) })
      .first();
    for (let i = 0; i < r.veces; i += 1) await loseta.click();
  }
  const armado = esperarPost(pagina, '/api/restaurante/armar-para-llevar');
  await pedido
    .getByRole('button', { name: /^Cobrar \$/ })
    .first()
    .click();
  const respuesta = await armado;
  expect(respuesta.status(), `armar para llevar: ${(await respuesta.text()).slice(0, 200)}`).toBe(
    200,
  );
  const cuerpo = (await respuesta.json()) as { datos?: { ordenId?: string } };
  return {
    cobro: dialogoCon(pagina, 'Cobrar — Para llevar'),
    ordenId: cuerpo.datos?.ordenId ?? '',
  };
}

/** Marca «Entregado» el pedido que la cocina dejó listo (si ya hay alguno). Devuelve cuántos entregó. */
export async function entregarLoListo(pagina: Page): Promise<number> {
  const entregar = pagina.getByRole('button', { name: 'Entregado', exact: true });
  let entregados = 0;
  while (entregados < 10) {
    const antes = await entregar.count();
    // La lista se refresca sola: si el botón ya se fue, otra persona lo entregó.
    if (antes === 0 || !(await entregar.first().isVisible())) break;
    // La espera de la respuesta empieza ANTES del clic (si no, la respuesta rápida se escapa).
    const respuesta = esperarPost(pagina, '/api/restaurante/entregar-para-llevar');
    // 15 s: si el modo espera tapa la lista, el despertador necesita su tiempo para quitarlo. Si el
    // botón se fue entre verlo y tocarlo, la OTRA caja lo entregó (día 1, repetición 3): no es falla.
    const toco = await entregar
      .first()
      .click({ timeout: 15_000 })
      .then(
        () => true,
        async (error: unknown) => {
          if ((await entregar.count()) < antes) return false;
          throw error;
        },
      );
    if (!toco) break;
    expect((await respuesta).status()).toBe(200);
    entregados += 1;
    // La tarjeta entregada tarda en irse: sin esperarla, la vuelta siguiente tocaba un botón que ya
    // se estaba yendo.
    await expect.poll(() => entregar.count(), { timeout: 15_000 }).toBeLessThan(antes);
  }
  return entregados;
}

/** Cuántos pedidos para llevar de hoy faltan por entregar: los que siguen en cocina y los listos. */
export async function pendientesParaLlevar(pagina: Page): Promise<number> {
  const lista = pagina.getByRole('region', { name: 'Pedidos para llevar de hoy' });
  // La lista llega unos segundos después de la pantalla: sin esperarla, «no se ve» parecía «no hay».
  const aparecio = await lista.waitFor({ state: 'visible', timeout: 15_000 }).then(
    () => true,
    () => false,
  );
  if (!aparecio) return 0;
  const enCocina = await lista
    .getByRole('list', { name: 'En cocina' })
    .getByRole('listitem')
    .count();
  const listos = await lista.getByRole('button', { name: 'Entregado', exact: true }).count();
  return enCocina + listos;
}
