/**
 * LOS PASOS DE ALMACÉN DE LA PARTE 5 (DP-22): unidades de medida y proveedores (Configuración) y las
 * tres compras (con proveedor, pagada de la caja y por transferencia), contra el libro: lo que entra
 * al almacén y el costo promedio ponderado sobre el costo EXACTO (DP-D165), al gramo y al centavo.
 */
import type { Page } from '@playwright/test';

import { leerSql, ORGANIZACION } from '../arbitro/base.ts';
import { dialogoCon } from '../pantallas/comun.ts';
import { ahoraDeLaBase, captura } from './ayudas-p5.ts';
import { tenerLaCaja, type Contexto, type Puestos } from './pasos-extra.ts';

/** La existencia y el costo exacto (diezmilésimas de centavo por unidad base) de un insumo, de sólo lectura. */
export async function existenciaYCosto(
  c: Contexto,
  nombre: string,
): Promise<{ existencia: number; dmc: bigint }> {
  const [f] = await leerSql<{ e: string; d: string }>(
    c.entorno.baseUrl,
    `select coalesce(sum(e.cantidad),0)::text as e, max(i.costo_exacto_dmc)::text as d
       from insumos i left join existencias e on e.insumo_id = i.id
      where i.organizacion_id = ${ORGANIZACION} and i.nombre = $1`,
    [nombre],
  );
  return { existencia: Number(f?.e ?? 0), dmc: BigInt(f?.d ?? '0') };
}

/** El libro: promedio ponderado sobre el exacto, UNA división y UN redondeo; el negativo cuenta como cero. */
function promedioDelLibro(
  existencia: number,
  dmcAnterior: bigint,
  entrante: number,
  totalCentavos: number,
): bigint {
  const s = BigInt(Math.max(existencia, 0));
  const divisor = s + BigInt(entrante);
  const numerador = s * dmcAnterior + BigInt(totalCentavos) * 10_000n;
  return (numerador * 2n + divisor) / (divisor * 2n);
}

/** Lo que salió de la caja por compras y gastos desde `desde` (movimientos que no son venta, propina ni apertura). */
async function cajaMovida(c: Contexto, desde: string): Promise<number> {
  const [f] = await leerSql<{ m: string }>(
    c.entorno.baseUrl,
    `select coalesce(sum(monto_centavos),0)::text as m from movimientos_caja
      where organizacion_id = ${ORGANIZACION} and created_at >= $1::timestamptz
        and tipo not in ('venta','propina','apertura','devolucion')`,
    [desde],
  );
  return Number(f?.m ?? 0);
}

export async function pasoConfiguracion(c: Contexto, p: Puestos): Promise<void> {
  const q = p.dueno;
  await q.goto(`${c.entorno.appUrl}/configuracion?seccion=productos`, {
    waitUntil: 'domcontentloaded',
  });
  // Unidades de medida: se crea «caja» y se edita la lista agregando «paquete».
  const unidades = q.locator('textarea[placeholder^="kg, g, litro"]');
  await unidades.waitFor({ timeout: 60_000 });
  const actual = (await unidades.inputValue()).trim();
  const ya = actual
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .includes('caja');
  const conCaja = ya ? actual : `${actual === '' ? '' : `${actual}, `}caja`;
  await unidades.fill(conCaja);
  await q.getByRole('button', { name: 'Guardar unidades' }).click();
  await q
    .getByText(/Unidades guardadas/)
    .first()
    .waitFor({ timeout: 30_000 });
  await unidades.fill(`${conCaja}, paquete`);
  await q.getByRole('button', { name: 'Guardar unidades' }).click();
  await q
    .getByText(/Unidades guardadas/)
    .first()
    .waitFor({ timeout: 30_000 });
  c.informe.nota('configuracion', 'unidades «caja» y «paquete» guardadas; se usan en la compra');
  // Proveedores: se crea uno con su teléfono.
  await q.goto(`${c.entorno.appUrl}/configuracion?seccion=productos`, {
    waitUntil: 'domcontentloaded',
  });
  await q
    .getByRole('button', { name: /^Nuevo$/ })
    .last()
    .click();
  const nuevo = dialogoCon(q, 'Nuevo proveedor');
  await nuevo.getByPlaceholder(/^Ej: Carnicería/).fill('Carnicería La Barranca');
  await nuevo.getByPlaceholder('Opcional').nth(1).fill('5512340987');
  const guardado = q.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().includes('/api/') && r.ok(),
    { timeout: 30_000 },
  );
  await nuevo.getByRole('button', { name: 'Guardar' }).click();
  await guardado;
  const [fila] = await leerSql<{ nombre: string; telefono: string | null }>(
    c.entorno.baseUrl,
    `select nombre, telefono from proveedores
      where organizacion_id = ${ORGANIZACION} and nombre = 'Carnicería La Barranca'`,
  );
  c.informe.punto(
    'configuracion',
    'el proveedor creado por pantalla quedó con su nombre y su teléfono',
    { nombre: 'Carnicería La Barranca', telefono: '5512340987' },
    fila ?? null,
    await captura(q, c.salida, 'proveedor-creado'),
  );
}

interface CompraEnPantalla {
  readonly insumo: string;
  readonly cantidad: number;
  readonly unidad: string;
  /** Sólo si la unidad no es estándar: cuánto trae cada una, en la unidad base. */
  readonly equivalencia?: number;
  readonly totalPesos: number;
  readonly pago: 'Efectivo' | 'Tarjeta' | 'Transferencia';
  readonly proveedor?: string;
}

async function registrarCompraEnPantalla(c: Contexto, q: Page, k: CompraEnPantalla): Promise<void> {
  await q.goto(`${c.entorno.appUrl}/compras`, { waitUntil: 'domcontentloaded' });
  await q
    .getByRole('button', { name: /^Registrar compra/ })
    .first()
    .click({ timeout: 60_000 });
  const d = dialogoCon(q, 'Registrar compra');
  await d.getByText('Línea 1').waitFor();
  const elegirEn = async (indice: number, opcion: string): Promise<void> => {
    await d.getByRole('combobox').nth(indice).click();
    await q.getByRole('option', { name: opcion }).click();
  };
  if (k.pago !== 'Efectivo') await elegirEn(0, k.pago);
  if (k.proveedor !== undefined) await elegirEn(1, k.proveedor);
  await d.getByPlaceholder('Buscar ingrediente...').fill(k.insumo);
  await d
    .getByRole('button', { name: new RegExp(`^${k.insumo}`) })
    .first()
    .click();
  await d.getByPlaceholder('0', { exact: true }).first().fill(String(k.cantidad));
  await d
    .getByRole('combobox')
    .filter({ hasText: /^(kg|g|litro|ml|pieza|caja|paquete|bolsa|unidad)$/ })
    .first()
    .click();
  await q.getByRole('option', { name: k.unidad, exact: true }).click();
  if (k.equivalencia !== undefined)
    await d
      .locator('input[type=number], input[inputmode=decimal]')
      .last()
      .fill(String(k.equivalencia));
  await d.getByPlaceholder('$0').fill(String(k.totalPesos));
  const respuesta = q.waitForResponse(
    (x) => new URL(x.url()).pathname === '/api/compras/registrar',
    { timeout: 45_000 },
  );
  await d.getByRole('button', { name: 'Guardar compra' }).click();
  const r = await respuesta;
  if (r.status() !== 200)
    throw new Error(`Guardar compra de ${k.insumo}: ${(await r.text()).slice(0, 300)}`);
}

export async function pasoCompras(c: Contexto, p: Puestos): Promise<void> {
  const q = p.dueno;
  const desde = await ahoraDeLaBase(c.entorno.baseUrl);
  const i = c.informe;
  // 1 · Con proveedor, por transferencia: 10 kg de carne por $1,500 (15 ¢ el gramo).
  const carne0 = await existenciaYCosto(c, 'Carne de prueba');
  await registrarCompraEnPantalla(c, q, {
    insumo: 'Carne de prueba',
    cantidad: 10,
    unidad: 'kg',
    totalPesos: 1500,
    pago: 'Transferencia',
    proveedor: 'Carnicería La Barranca',
  });
  const carne1 = await existenciaYCosto(c, 'Carne de prueba');
  c.libro.comprar('Carne de prueba', 10_000, 150_000);
  i.punto(
    'compras',
    'con proveedor: la carne entra al almacén (+10 000 g)',
    carne0.existencia + 10_000,
    carne1.existencia,
    await captura(q, c.salida, 'compra-con-proveedor'),
  );
  i.punto(
    'compras',
    'con proveedor: el costo promedia sobre el exacto (diezmilésimas de ¢ por g)',
    String(promedioDelLibro(carne0.existencia, carne0.dmc, 10_000, 150_000)),
    String(carne1.dmc),
  );
  const [prov] = await leerSql<{ proveedor_nombre: string | null }>(
    c.entorno.baseUrl,
    `select proveedor_nombre from compras where organizacion_id = ${ORGANIZACION}
      and created_at >= $1::timestamptz and total_centavos = 150000 limit 1`,
    [desde],
  );
  i.punto(
    'compras',
    'la compra quedó a nombre del proveedor',
    'Carnicería La Barranca',
    prov?.proveedor_nombre ?? null,
  );
  // 2 · Pagada de la caja (efectivo): 2 cajas de 50 tortillas por $190. El dueño trae la caja a su aparato.
  await tenerLaCaja(c, q);
  const antes2 = await cajaMovida(c, desde);
  const tortilla0 = await existenciaYCosto(c, 'Tortilla de prueba');
  await registrarCompraEnPantalla(c, q, {
    insumo: 'Tortilla de prueba',
    cantidad: 2,
    unidad: 'caja',
    equivalencia: 50,
    totalPesos: 190,
    pago: 'Efectivo',
  });
  const tortilla1 = await existenciaYCosto(c, 'Tortilla de prueba');
  c.libro.comprar('Tortilla de prueba', 100, 19_000);
  i.punto(
    'compras',
    'en efectivo: 2 cajas de 50 son +100 tortillas',
    tortilla0.existencia + 100,
    tortilla1.existencia,
    await captura(q, c.salida, 'compra-efectivo'),
  );
  i.punto(
    'compras',
    'en efectivo: el costo promedia sobre el exacto (diezmilésimas de ¢ por pieza)',
    String(promedioDelLibro(tortilla0.existencia, tortilla0.dmc, 100, 19_000)),
    String(tortilla1.dmc),
  );
  i.punto(
    'compras',
    'en efectivo: sale del cajón lo pagado (movimiento de caja, centavos)',
    -19_000,
    (await cajaMovida(c, desde)) - antes2,
  );
  await tenerLaCaja(c, p.caja);
  // 3 · Por transferencia: 5 litros de leche por $135 (2.7 ¢ el ml); no toca el cajón.
  const antes3 = await cajaMovida(c, desde);
  const leche0 = await existenciaYCosto(c, 'Leche de prueba');
  await registrarCompraEnPantalla(c, q, {
    insumo: 'Leche de prueba',
    cantidad: 5,
    unidad: 'litro',
    totalPesos: 135,
    pago: 'Transferencia',
  });
  const leche1 = await existenciaYCosto(c, 'Leche de prueba');
  c.libro.comprar('Leche de prueba', 5_000, 13_500);
  i.punto(
    'compras',
    'por transferencia: la leche entra (+5 000 ml)',
    leche0.existencia + 5_000,
    leche1.existencia,
    await captura(q, c.salida, 'compra-transferencia'),
  );
  i.punto(
    'compras',
    'por transferencia: el costo promedia sobre el exacto (diezmilésimas de ¢ por ml)',
    String(promedioDelLibro(leche0.existencia, leche0.dmc, 5_000, 13_500)),
    String(leche1.dmc),
  );
  i.punto(
    'compras',
    'por transferencia: no sale nada del cajón (centavos)',
    0,
    (await cajaMovida(c, desde)) - antes3,
  );
}
