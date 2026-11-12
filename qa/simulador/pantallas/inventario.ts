/**
 * LAS PANTALLAS DE ALMACÉN que usan el día 0 (dueño) y el bot de almacén: Compras → «Registrar
 * compra» (insumo nuevo o existente), Inventario → «Ajustar» (merma, conteo, entrada, salida) y
 * la existencia que enseña la fila de cada insumo.
 */
import { expect, type Page } from '@playwright/test';

import { cerrado, dialogoCon, elegir, tocarYEsperar } from './comun.ts';

export interface CompraDeInsumo {
  readonly nombre: string;
  readonly cantidad: number;
  readonly unidadDeCompra: string;
  readonly costoTotalPesos: number;
  /** Sólo para un insumo NUEVO: g, ml o pieza. Si falta, la compra es de un insumo que ya existe. */
  readonly base?: 'g' | 'ml' | 'pieza';
  readonly pago?: 'Efectivo' | 'Tarjeta' | 'Transferencia';
}

const NOMBRE_DE_UNIDAD_BASE = { g: 'gramos (g)', ml: 'mililitros (ml)', pieza: 'pieza' } as const;

export async function irACompras(pagina: Page, appUrl: string): Promise<void> {
  await pagina.goto(`${appUrl}/compras`, { waitUntil: 'domcontentloaded' });
  await expect(pagina.getByRole('button', { name: /^Registrar compra/ })).toBeVisible();
}

export async function irAInventario(pagina: Page, appUrl: string): Promise<void> {
  await pagina.goto(`${appUrl}/inventario`, { waitUntil: 'domcontentloaded' });
  await expect(pagina.getByText('Ingredientes e insumos', { exact: true })).toBeVisible();
  // La lista llega después del encabezado: sin esperarla, «no hay insumos» sería un falso vacío.
  await expect(
    pagina.getByText('Aún no tienes inventario').or(pagina.getByTitle(/^Ajustar stock/).first()),
  ).toBeVisible({ timeout: 45_000 });
}

/** Registra UNA compra de un insumo (nuevo si trae `base`, existente si no). La respuesta debe ser 200. */
export async function registrarCompra(pagina: Page, c: CompraDeInsumo): Promise<void> {
  await pagina
    .getByRole('button', { name: /^Registrar compra/ })
    .first()
    .click();
  const dialogo = dialogoCon(pagina, 'Registrar compra');
  await expect(dialogo.getByText('Línea 1')).toBeVisible();
  if (c.pago !== undefined && c.pago !== 'Efectivo') await elegir(pagina, dialogo, 'Pago', c.pago);
  if (c.base === undefined) {
    await dialogo.getByPlaceholder('Buscar ingrediente...').fill(c.nombre);
    await dialogo
      .getByRole('button', { name: new RegExp(`^${c.nombre}`) })
      .first()
      .click();
  } else {
    await dialogo.getByRole('button', { name: 'Nuevo', exact: true }).click();
    await dialogo.getByPlaceholder('Ej: Café molido').fill(c.nombre);
    await elegir(pagina, dialogo, 'Unidad base (cómo se usa)', NOMBRE_DE_UNIDAD_BASE[c.base]);
  }
  await dialogo.getByPlaceholder('0', { exact: true }).first().fill(String(c.cantidad));
  await elegir(pagina, dialogo, 'Unidad de compra', c.unidadDeCompra);
  await dialogo.getByPlaceholder('$0').fill(String(c.costoTotalPesos));
  const r = await tocarYEsperar(
    pagina,
    dialogo.getByRole('button', { name: 'Guardar compra' }),
    '/api/compras/registrar',
  );
  expect(r.estado, `Guardar compra de ${c.nombre}: ${r.cuerpo.slice(0, 300)}`).toBe(200);
  await cerrado(dialogo);
}

export interface AjusteDeStock {
  readonly tipo:
    'Merma / producto perdido' | 'Corrección de conteo' | 'Entrada manual' | 'Salida manual';
  /** Con «diferencia» se resta o suma `cantidad`; con «final» se fija el stock real a `cantidad`. */
  readonly metodo: 'diferencia' | 'final';
  readonly signo?: 'restar' | 'sumar';
  readonly cantidad: number;
  readonly unidad: string;
  readonly motivo: string;
}

/** La fila de un insumo en Inventario: el bloque más chico con su botón «Ajustar stock…». */
function filaDelInsumo(pagina: Page, nombre: string) {
  return pagina
    .getByText(nombre, { exact: true })
    .locator('xpath=ancestor::div[.//button[starts-with(@title,"Ajustar stock")]][1]');
}

export async function ajustarStock(pagina: Page, nombre: string, a: AjusteDeStock): Promise<void> {
  const fila = filaDelInsumo(pagina, nombre).first();
  await fila.getByTitle(/^Ajustar stock/).click();
  const dialogo = dialogoCon(pagina, /Ajustar|stock/i).last();
  await elegir(pagina, dialogo, 'Tipo de ajuste *', a.tipo);
  await elegir(
    pagina,
    dialogo,
    'Método *',
    a.metodo === 'final' ? /^Definir stock final/ : /^Sumar \/ restar/,
  );
  if (a.metodo === 'diferencia')
    await elegir(
      pagina,
      dialogo,
      'Sumar o restar *',
      a.signo === 'sumar' ? /^Sumar \(\+\)/ : /^Restar/,
    );
  await dialogo.getByPlaceholder('0', { exact: true }).first().fill(String(a.cantidad));
  await elegir(pagina, dialogo, 'Unidad *', a.unidad);
  await dialogo.getByPlaceholder(/^Ej: conteo físico inicial/).fill(a.motivo);
  const r = await tocarYEsperar(
    pagina,
    dialogo.getByRole('button', { name: /Guardar ajuste/ }),
    '/api/inventario/ajustar',
  );
  expect(r.estado, `Guardar ajuste de ${nombre}: ${r.cuerpo.slice(0, 300)}`).toBe(200);
  await cerrado(dialogo);
}

/** ¿Existe ya una fila con ese insumo en Inventario? */
export async function existeElInsumo(pagina: Page, nombre: string): Promise<boolean> {
  return (await filaDelInsumo(pagina, nombre).count()) > 0;
}
