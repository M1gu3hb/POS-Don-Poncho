/**
 * LOS PASOS DE CUENTAS DE LA PARTE 5 (DP-22): el costo de la receta y el margen del platillo
 * (Recetas) y el valor de inventario, el kardex y los reportes (Inventario y Registros), cada uno
 * contra el libro, al gramo y al centavo, después de todo lo anterior.
 */
import type { Page } from '@playwright/test';

import { leerSql, ORGANIZACION } from '../arbitro/base.ts';
import { PRODUCTOS_DE_PRUEBA } from '../dia0/datos.ts';
import { captura } from './ayudas-p5.ts';
import type { Contexto, Puestos } from './pasos-extra.ts';

/** «$1,234.50» → 123450 (centavos). */
const centavosDe = (texto: string | undefined): number | null =>
  texto === undefined ? null : Math.round(Number(texto.replaceAll(',', '')) * 100);

const normal = async (p: Page): Promise<string> =>
  (await p.locator('body').innerText()).replace(/\s+/g, ' ');

export interface Kpi {
  readonly ingresos: number | null;
  readonly compras: number | null;
  readonly utilidad: number | null;
  readonly margen: string | null;
}

/** Lo que dice Registros (periodo «Hoy») en sus tarjetas de arriba. */
export async function leerRegistros(c: Contexto, q: Page): Promise<Kpi> {
  await q.goto(`${c.entorno.appUrl}/registros`, { waitUntil: 'domcontentloaded' });
  await q
    .getByText(/Utilidad bruta/)
    .first()
    .waitFor({ timeout: 60_000 });
  await q.waitForTimeout(2_000);
  const t = await normal(q);
  return {
    ingresos: centavosDe(/Ingresos \$([\d,]+\.\d\d)/.exec(t)?.[1]),
    compras: centavosDe(/Compras \$([\d,]+\.\d\d)/.exec(t)?.[1]),
    utilidad: centavosDe(/Utilidad bruta \$([\d,]+\.\d\d)/.exec(t)?.[1]),
    margen: /Utilidad bruta \$[\d,]+\.\d\d ([\d.]+)% margen/.exec(t)?.[1] ?? null,
  };
}

export async function pasoCostos(c: Contexto, p: Puestos): Promise<void> {
  const q = p.dueno;
  await q.goto(`${c.entorno.appUrl}/recetas`, { waitUntil: 'domcontentloaded' });
  await q.getByText('Taco de prueba').first().waitFor({ timeout: 60_000 });
  await q.waitForTimeout(2_000);
  const t = await normal(q);
  const foto = await captura(q, c.salida, 'costos-recetas');
  for (const nombre of [
    'Taco de prueba',
    'Hamburguesa de prueba',
    'Pozole de prueba',
    'Flan de prueba',
  ]) {
    const producto = PRODUCTOS_DE_PRUEBA.find((x) => x.nombre === nombre);
    if (producto?.receta === undefined) continue;
    const m = new RegExp(
      `${nombre} .*?PRECIO \\$([\\d,]+\\.\\d\\d) COSTO \\$([\\d,]+\\.\\d\\d) UTILIDAD \\$([\\d,]+\\.\\d\\d) MARGEN ([\\d.]+)%`,
    ).exec(t);
    const precio = producto.precioPesos * 100;
    const costo = c.libro.costoDeReceta(producto.receta);
    const utilidad = precio - costo;
    const margen = ((utilidad / precio) * 100).toFixed(1);
    c.informe.punto(
      'costos',
      `${nombre}: costo de la receta, utilidad y margen (libro: costo exacto, un solo redondeo)`,
      { costo, utilidad, margen },
      {
        costo: centavosDe(m?.[2]),
        utilidad: centavosDe(m?.[3]),
        margen: m?.[4] === undefined ? null : Number(m[4]).toFixed(1),
      },
      foto,
    );
  }
}

export async function pasoReportes(
  c: Contexto,
  p: Puestos,
  antes: Kpi,
  cobrado: number,
  devuelto: number,
): Promise<void> {
  const q = p.dueno;
  // 1 · «Valor de inventario» de Inventario contra el libro (lo negativo vale cero).
  await q.goto(`${c.entorno.appUrl}/inventario`, { waitUntil: 'domcontentloaded' });
  await q.getByText('Ingredientes e insumos', { exact: true }).waitFor({ timeout: 60_000 });
  await q.waitForTimeout(4_000);
  const t = await normal(q);
  const valor = centavosDe(/Valor de(?:l)? inventario[^$]*\$([\d,]+\.\d\d)/i.exec(t)?.[1]);
  c.informe.punto(
    'reportes',
    'Inventario · «Valor de inventario» (centavos) contra el libro',
    c.libro.valorTotal(),
    valor,
    await captura(q, c.salida, 'reportes-inventario'),
  );
  // 2 · El kardex: el saldo de cada insumo es la existencia del libro, al gramo.
  const saldos = await leerSql<{ nombre: string; saldo: string }>(
    c.entorno.baseUrl,
    `select distinct on (i.nombre) i.nombre, k.saldo::text as saldo
       from kardex k join insumos i on i.id = k.insumo_id
      where i.organizacion_id = ${ORGANIZACION} and i.nombre = any($1::text[])
      order by i.nombre, k.created_at desc, k.movimiento_id desc`,
    [c.libro.nombres()],
  );
  for (const s of saldos)
    c.informe.punto(
      'reportes',
      `kardex · saldo de ${s.nombre} contra el libro`,
      c.libro.existencia(s.nombre),
      Number(s.saldo),
    );
  // 3 · Registros: lo que cambió desde que empezó la corrida.
  const despues = await leerRegistros(c, q);
  const foto = await captura(q, c.salida, 'reportes-registros');
  c.informe.punto(
    'reportes',
    'Registros · compras del periodo (+ lo comprado en la corrida, centavos)',
    182_500,
    (despues.compras ?? 0) - (antes.compras ?? 0),
    foto,
  );
  c.informe.punto(
    'reportes',
    'Registros · ingresos del periodo = lo cobrado (la devolución se dice aparte en «Lo más vendido», centavos)',
    cobrado,
    (despues.ingresos ?? 0) - (antes.ingresos ?? 0),
    foto,
  );
  c.informe.nota(
    'reportes',
    `Registros antes ${JSON.stringify(antes)} · después ${JSON.stringify(despues)} · cobrado ${String(cobrado)} · devuelto ${String(devuelto)}`,
  );
}
