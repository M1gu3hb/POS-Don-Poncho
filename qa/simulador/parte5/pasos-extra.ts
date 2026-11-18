/**
 * LOS PASOS DE LA SEGUNDA TANDA DE LA PARTE 5 (DP-22): portal del cliente, devolución, existencia en
 * negativo. Mismo método que `correr.ts`: por pantallas, con el dedo, contra el libro independiente.
 */
import type { Browser, Page } from '@playwright/test';

import { leerSql, ORGANIZACION } from '../arbitro/base.ts';
import { abrirElQr, agregarAlPortal, llamarParaConfirmar } from '../bots/comensal-ui.ts';
import { confirmarPedidoDelPortal, pedirLaCuenta } from '../bots/mesero-cuenta.ts';
import {
  abrirMesa,
  agregarLinea,
  alMapa,
  enviarACocina,
  mesasEnPantalla,
} from '../bots/mesero-ui.ts';
import type { Entorno } from '../entorno.ts';
import { ponerElDedo } from '../dedo.ts';
import type { ProductoConocido, MesaConocida } from '../mundo.ts';
import type { LibroDeInventario } from './libro-de-inventario.ts';
import {
  cobrar,
  decidirLaPropina,
  estadoDeLaCaja,
  irACaja,
  traerLaCaja,
} from '../pantallas/caja.ts';
import { dialogoCon } from '../pantallas/comun.ts';
import { ajustarStock, irAInventario } from '../pantallas/inventario.ts';
import { irAMovimientos } from '../pantallas/movimientos.ts';
import { contextoDe } from '../sesion.ts';
import {
  ahoraDeLaBase,
  cambio,
  captura,
  fotoDeExistencias,
  esperadoPorVentas,
  importeDelKardex,
  lineaDe,
  type Informe,
} from './ayudas-p5.ts';

export interface Puestos {
  readonly mesero: Page;
  readonly caja: Page;
  readonly cocina: Page;
  readonly dueno: Page;
}

export interface Contexto {
  readonly entorno: Entorno;
  readonly salida: string;
  readonly informe: Informe;
  readonly catalogo: readonly ProductoConocido[];
  readonly mesas: readonly MesaConocida[];
  readonly navegador: Browser;
  readonly libro: LibroDeInventario;
  /** El dinero del libro: lo cobrado y lo devuelto en la corrida (centavos). */
  readonly dinero: { cobrado: number; devuelto: number };
  readonly compararConsumo: (
    paso: string,
    punto: string,
    movido: ReturnType<typeof cambio>,
    lineas: readonly { producto: string; cantidad: number }[],
    pagina: Page,
  ) => Promise<void>;
}

export async function mesaLibre(p: Puestos): Promise<number> {
  const libre = (await mesasEnPantalla(p.mesero)).find((m) => m.estado === 'Libre');
  if (libre === undefined) throw new Error('No hay una mesa libre.');
  return libre.numero;
}

/** Cobra en la Caja la cuenta pendiente de una mesa (efectivo, sin propina); devuelve folio y total. */
export async function cobrarLaMesa(
  c: Contexto,
  p: Puestos,
  mesa: number,
  total: number,
): Promise<{ folio: string; total: number }> {
  await irACaja(p.caja, c.entorno.appUrl);
  await p.caja.getByRole('tab', { name: /^Pendientes/ }).click();
  await p.caja
    .getByText(`Mesa ${String(mesa)}`, { exact: true })
    .first()
    .click();
  const cobro = dialogoCon(p.caja, `Cobrar — Mesa ${String(mesa)}`);
  await decidirLaPropina(p.caja, cobro, 'Sin propina');
  const r = await cobrar(p.caja, cobro, { metodo: 'Efectivo', recibidoCentavos: total + 10_000 });
  c.dinero.cobrado += r.totalCentavos;
  return { folio: r.folio, total: r.totalCentavos };
}

/** Abre una mesa, pide las líneas, las envía y pide la cuenta (sin cobrar). */
export async function pedirEnMesa(
  p: Puestos,
  lineas: readonly ReturnType<typeof lineaDe>[],
): Promise<number> {
  const mesa = await mesaLibre(p);
  await abrirMesa(p.mesero, mesa, 2, { celebracion: false, alergia: '' });
  for (const l of lineas) await agregarLinea(p.mesero, mesa, l);
  await enviarACocina(p.mesero, '');
  await pedirLaCuenta(p.mesero, mesa, 'sin');
  await alMapa(p.mesero);
  return mesa;
}

export async function pasoPortal(c: Contexto, p: Puestos): Promise<void> {
  const mesa = await mesaLibre(p);
  const token = c.mesas.find((m) => m.numero === mesa)?.qrToken;
  if (token === undefined) throw new Error(`La mesa ${String(mesa)} no tiene QR en el catálogo.`);
  const lineas = [
    lineaDe(c.catalogo, 'Taco de prueba', 2),
    lineaDe(c.catalogo, 'Flan de prueba', 1),
  ];
  const antes = await fotoDeExistencias(c.entorno.baseUrl);
  const { pagina: telefono, contexto } = await contextoDe(c.navegador, c.entorno, 'android-360');
  ponerElDedo(telefono);
  await abrirElQr(telefono, c.entorno.appUrl, token);
  for (const l of lineas) await agregarAlPortal(telefono, l);
  const foto = await captura(telefono, c.salida, 'portal-pedido-armado');
  c.informe.punto(
    'portal',
    'el teléfono llamó al mesero a confirmar (HTTP)',
    200,
    await llamarParaConfirmar(telefono),
    foto,
  );
  await confirmarPedidoDelPortal(p.mesero, mesa, 2);
  await contexto.close();
  c.informe.punto(
    'portal',
    'al confirmar y enviar a cocina el almacén no se mueve',
    {},
    Object.fromEntries(cambio(antes, await fotoDeExistencias(c.entorno.baseUrl))),
  );
  // El mapa del mesero tarda en enterarse de la mesa que abrió el portal: se recarga como lo haría él.
  await p.mesero.reload({ waitUntil: 'domcontentloaded' });
  await p.mesero.getByText(/mesa/i).first().waitFor({ timeout: 60_000 });
  await pedirLaCuenta(p.mesero, mesa, 'sin');
  await alMapa(p.mesero);
  const total = lineas.reduce((s, l) => s + l.importeCentavos, 0);
  const cobrado = await cobrarLaMesa(c, p, mesa, total);
  c.informe.punto(
    'portal',
    'total cobrado de la cuenta del portal (centavos)',
    total,
    cobrado.total,
  );
  await c.compararConsumo(
    'portal',
    'tras cobrar: lo que bajó cada insumo',
    cambio(antes, await fotoDeExistencias(c.entorno.baseUrl)),
    lineas.map((l) => ({ producto: l.producto.nombre, cantidad: l.cantidad })),
    p.caja,
  );
}

async function devueltoDe(c: Contexto, desde: string): Promise<number> {
  const [f] = await leerSql<{ m: string }>(
    c.entorno.baseUrl,
    `select coalesce(sum(monto_centavos),0)::text as m from devoluciones
      where organizacion_id = ${ORGANIZACION} and created_at >= $1::timestamptz`,
    [desde],
  );
  return Number(f?.m ?? 0);
}

async function cajaDe(c: Contexto, tipo: string, desde: string): Promise<number> {
  const [f] = await leerSql<{ m: string }>(
    c.entorno.baseUrl,
    `select coalesce(sum(monto_centavos),0)::text as m from movimientos_caja
      where organizacion_id = ${ORGANIZACION} and tipo = $1 and created_at >= $2::timestamptz`,
    [tipo, desde],
  );
  return Number(f?.m ?? 0);
}

/** Deja la caja abierta en ESTE aparato: si está en otro, se traslada (la regla de la caja de un solo aparato). */
export async function tenerLaCaja(c: Contexto, pagina: Page): Promise<void> {
  await irACaja(pagina, c.entorno.appUrl);
  if ((await estadoDeLaCaja(pagina)) === 'en-otro-aparato') await traerLaCaja(pagina);
}

export async function pasoDevolver(c: Contexto, p: Puestos): Promise<void> {
  const lineas = [lineaDe(c.catalogo, 'Taco de prueba', 2)];
  const mesa = await pedirEnMesa(p, lineas);
  const total = lineas[0]?.importeCentavos ?? 0;
  const cobrado = await cobrarLaMesa(c, p, mesa, total);
  for (const [insumo, delta] of esperadoPorVentas([{ producto: 'Taco de prueba', cantidad: 2 }]))
    c.libro.mover(insumo, delta);
  const desde = await ahoraDeLaBase(c.entorno.baseUrl);
  const antes = await fotoDeExistencias(c.entorno.baseUrl);
  // Devolver es de la gerencia: lo hace el dueño (Caja → Movimientos → «Devolver una venta»).
  const q = p.dueno;
  // Devolver efectivo sale del cajón de quien devuelve: el dueño trae la caja a su aparato.
  await tenerLaCaja(c, q);
  await irAMovimientos(q);
  await q.getByLabel('Folio del ticket').fill(cobrado.folio.replace(/\D+/g, ''));
  await q.getByRole('button', { name: 'Buscar la venta' }).click();
  await q.getByRole('button', { name: 'Devolver todo lo que queda' }).click();
  await q.getByRole('button', { name: /^Efectivo/ }).click();
  await q.getByLabel('Por qué se devuelve').fill('Parte 5: no le gustó');
  const foto1 = await captura(q, c.salida, 'devolver-antes-de-confirmar');
  const respuesta = q.waitForResponse(
    (x) => new URL(x.url()).pathname === '/api/venta/devolver-venta',
    { timeout: 45_000 },
  );
  await q.getByRole('button', { name: 'Devolver', exact: true }).click();
  const hecha = await respuesta;
  c.informe.punto('devolver', 'la devolución se aceptó (HTTP)', 200, hecha.status(), foto1);
  c.informe.nota('devolver', `respuesta del servidor: ${(await hecha.text()).slice(0, 240)}`);
  const foto2 = await captura(q, c.salida, 'devolver-hecha');
  c.dinero.devuelto += total;
  c.informe.punto(
    'devolver',
    'la devolución quedó guardada por lo cobrado (centavos)',
    total,
    await devueltoDe(c, desde),
    foto2,
  );
  c.informe.punto(
    'devolver',
    'el dinero: sale del cajón lo devuelto (movimiento de caja, centavos, con signo de salida)',
    -total,
    await cajaDe(c, 'devolucion', desde),
  );
  await tenerLaCaja(c, p.caja);
  // Lo preparado no regresa: el almacén no se mueve y el kardex no trae `devolucion` de estos insumos.
  c.informe.punto(
    'devolver',
    'el inventario no se mueve (lo preparado no regresa)',
    {},
    Object.fromEntries(cambio(antes, await fotoDeExistencias(c.entorno.baseUrl))),
  );
  c.informe.punto(
    'devolver',
    'el kardex no trae movimientos «devolucion» de estos insumos (centavos)',
    0,
    Math.abs(await importeDelKardex(c.entorno.baseUrl, 'devolucion', desde)),
  );
}

export async function pasoNegativo(c: Contexto, p: Puestos): Promise<void> {
  const desde = await ahoraDeLaBase(c.entorno.baseUrl);
  const pan = async (): Promise<number | undefined> =>
    (await fotoDeExistencias(c.entorno.baseUrl)).get('Pan de prueba');
  await irAInventario(p.dueno, c.entorno.appUrl);
  await ajustarStock(p.dueno, 'Pan de prueba', {
    tipo: 'Corrección de conteo',
    metodo: 'final',
    cantidad: 1,
    unidad: 'pieza',
    motivo: 'Parte 5: queda un pan',
  });
  c.informe.punto('negativo', 'el conteo deja el pan en 1', 1, await pan());
  c.libro.contar('Pan de prueba', 1);
  // Tres hamburguesas se venden aunque el almacén sólo tenga un pan (DP-D116): queda en negativo.
  const lineas = [
    lineaDe(c.catalogo, 'Hamburguesa de prueba', 3, [{ grupo: 'Extras', opcion: 'Queso' }]),
  ];
  const mesa = await pedirEnMesa(p, lineas);
  await cobrarLaMesa(c, p, mesa, lineas[0]?.importeCentavos ?? 0);
  for (const [insumo, delta] of esperadoPorVentas([
    { producto: 'Hamburguesa de prueba', cantidad: 3 },
  ]))
    c.libro.mover(insumo, delta);
  c.informe.punto(
    'negativo',
    'el cobro de 3 con un solo pan deja el pan en −2, sin error',
    -2,
    await pan(),
    await captura(p.caja, c.salida, 'negativo-cobrado'),
  );
  // Merma de 1 pan con la existencia ya en negativo: se registra, baja a −3 y vale 600 ¢ (1 pan a $6).
  await irAInventario(p.dueno, c.entorno.appUrl);
  await ajustarStock(p.dueno, 'Pan de prueba', {
    tipo: 'Merma / producto perdido',
    metodo: 'diferencia',
    signo: 'restar',
    cantidad: 1,
    unidad: 'pieza',
    motivo: 'Parte 5: merma con existencia negativa',
  });
  c.informe.punto(
    'negativo',
    'la merma sobre existencia negativa baja el pan a −3',
    -3,
    await pan(),
    await captura(p.dueno, c.salida, 'negativo-merma'),
  );
  c.libro.mover('Pan de prueba', -1);
  c.informe.punto(
    'negativo',
    'esa merma está en el kardex como MERMA y vale 600 ¢',
    600,
    Math.abs(await importeDelKardex(c.entorno.baseUrl, 'merma', desde)),
  );
  // Conteo físico desde el negativo: 10.
  await irAInventario(p.dueno, c.entorno.appUrl);
  await ajustarStock(p.dueno, 'Pan de prueba', {
    tipo: 'Corrección de conteo',
    metodo: 'final',
    cantidad: 10,
    unidad: 'pieza',
    motivo: 'Parte 5: conteo desde negativo',
  });
  c.libro.contar('Pan de prueba', 10);
  c.informe.punto(
    'negativo',
    'el conteo desde el negativo deja 10',
    10,
    await pan(),
    await captura(p.dueno, c.salida, 'negativo-conteo'),
  );
}
