import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { consultarPuente, cabecerasDeEscrituraDePrueba } from '../../ayudantes/sesion.ts';
import { sesionDeLaCaja } from '../../ayudantes/conciliacion.ts';
import { abrirLaCaja, mesaEnElServidor, yaAbierto } from '../../ayudantes/mesas-heredadas.ts';
import { expect } from '../arnes/prueba.ts';
import { toque } from '../arnes/toque.ts';

import type { Page } from '@playwright/test';

/**
 * LO QUE COMPARTEN LAS PRUEBAS DE LA PARTE 7 («¿aquí debería poder…?» en la app, DP-D177 a D174).
 *
 * La PREPARACIÓN (abrir una mesa, mandar un pedido) va por la API, como lo hace `pasar-la-mesa`;
 * lo que se PRUEBA —cada punto de la tabla— se hace con el dedo del arnés (`toque`).
 */

export const SLUG = 'prueba-restaurante';

export function rutaDeCaptura(tema: string, aparato: string, nombre: string): string {
  return join('qa', 'qa-final', 'capturas', 'parte7', tema, aparato, `${nombre}.png`);
}

export async function capturar(
  page: Page,
  tema: string,
  aparato: string,
  nombre: string,
): Promise<void> {
  await page.screenshot({ path: rutaDeCaptura(tema, aparato, nombre) });
}

export async function mandar<T>(page: Page, ruta: string, cuerpo: unknown): Promise<T> {
  const respuesta = await page.request.post(ruta, {
    headers: cabecerasDeEscrituraDePrueba(),
    data: cuerpo,
  });
  const texto = await respuesta.text();
  expect(respuesta.status(), `${ruta} → ${texto.slice(0, 300)}`).toBe(200);
  return (JSON.parse(texto) as { datos?: T }).datos as T;
}

export async function resetearLaDemo(duena: Page): Promise<void> {
  const reseteo = await duena.request.post('/api/pruebas/resetear', {
    headers: cabecerasDeEscrituraDePrueba(),
    data: { confirmacion: 'RESETEAR' },
  });
  expect(reseteo.status(), await reseteo.text()).toBe(200);
}

export async function idDelPlatillo(lector: Page, nombre: string): Promise<string> {
  const carta = await consultarPuente<{ id?: string; nombre?: string }>(
    lector,
    'ProductoTerminado',
    { filtro: { activo: true }, limite: 200 },
  );
  const id = carta.find((p) => p.nombre === nombre)?.id;
  expect(id, `La carta de la demo no trae «${nombre}».`).toBeTruthy();
  return id ?? '';
}

/** Abre la mesa y manda a cocina los platillos (por la API: es preparación, no lo probado). */
export async function mesaConPedido(
  quien: Page,
  lector: Page,
  numero: number,
  platillos: readonly { nombre: string; cantidad?: string; notas?: string }[],
  personas = 2,
): Promise<{ mesaId: string; ordenId: string }> {
  const { mesaId } = await mesaEnElServidor(lector, numero);
  const abierta = await mandar<{ ordenId: string }>(quien, '/api/restaurante/abrir-mesa', {
    mesaId,
    personas,
  });
  const lineas = [];
  for (const p of platillos) {
    lineas.push({
      productoId: await idDelPlatillo(lector, p.nombre),
      cantidad: p.cantidad ?? '1',
      ...(p.notas === undefined ? {} : { notas: p.notas }),
    });
  }
  await mandar(quien, '/api/restaurante/enviar-pedido', { ordenId: abierta.ordenId, lineas });
  return { mesaId, ordenId: abierta.ordenId };
}

/** Corre una orden SQL en la base DESECHABLE de la prueba (nunca otra: la URL sale de `DATABASE_URL`). */
export function sqlLocal(orden: string): string {
  const url = process.env['DATABASE_URL'] ?? '';
  if (!/^postgres:\/\/[^@]*@(localhost|127\.0\.0\.1):\d+\//.test(url)) {
    throw new Error('sqlLocal sólo corre contra una base local desechable.');
  }
  const psql = process.env['MORPHIQPOS_PSQL'] ?? 'C:/Program Files/PostgreSQL/18/bin/psql.exe';
  const resultado = spawnSync(psql, [url, '-v', 'ON_ERROR_STOP=1', '-At', '-c', orden], {
    encoding: 'utf8',
  });
  if (resultado.status !== 0) throw new Error(`psql falló: ${resultado.stderr}`);
  return resultado.stdout.trim();
}

function exigirUuid(id: string): string {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('Id inválido.');
  return id;
}

/** Hace «vieja» una cuenta: así el tiempo de una mesa se mide con relojes reales. */
export function retrasarLaCuenta(ordenId: string, minutos: number): void {
  sqlLocal(
    `update ordenes set created_at = now() - interval '${String(Math.trunc(minutos))} minutes' where id = '${exigirUuid(ordenId)}'`,
  );
}

/** Cuántas veces el servidor contó que salió la precuenta de la cuenta. */
export function precuentasImpresas(ordenId: string): number {
  return Number(
    sqlLocal(`select precuentas_impresas from ordenes where id = '${exigirUuid(ordenId)}'`),
  );
}

/** La caja de Rosa abierta con su fondo (preparación: sin caja abierta no se pide ninguna cuenta). */
export async function cajaAbierta(rosa: Page, fondoCentavos = 150_000): Promise<void> {
  await rosa.goto('/caja', { waitUntil: 'domcontentloaded' });
  await rosa.getByRole('tab', { name: /^Pendientes/ }).waitFor({ timeout: 90_000 });
  if ((await sesionDeLaCaja(rosa)) === null) await abrirLaCaja(rosa, fondoCentavos);
}

/** Busca una clave en cualquier parte de un JSON (la hoja del corte anida sus secciones). */
export function buscarClave(valor: unknown, clave: string): unknown {
  if (valor === null || typeof valor !== 'object') return undefined;
  const objeto = valor as Record<string, unknown>;
  if (clave in objeto) return objeto[clave];
  for (const hijo of Object.values(objeto)) {
    const hallado = buscarClave(hijo, clave);
    if (hallado !== undefined) return hallado;
  }
  return undefined;
}

/** Cobra la cuenta de la mesa en la Caja con el dedo. Devuelve lo que el servidor cobró (centavos). */
export async function cobrarLaMesa(
  rosa: Page,
  mesa: number,
  metodo: 'Efectivo' | 'Tarjeta',
): Promise<{ totalCentavos: number; propinaCentavos: number }> {
  await rosa.goto('/caja', { waitUntil: 'domcontentloaded' });
  await toque(rosa, rosa.getByRole('tab', { name: /^Pendientes/ }));
  await toque(rosa, rosa.getByRole('button', { name: new RegExp(`^Mesa ${String(mesa)} Cuenta`) }));
  const cobro = rosa.getByRole('dialog').filter({ hasText: `Cobrar — Mesa ${String(mesa)}` });
  await yaAbierto(cobro);
  await toque(rosa, cobro.getByRole('button', { name: metodo, exact: true }));
  if (metodo === 'Efectivo') await cobro.getByPlaceholder('0.00').fill('2000.00');
  const [respuesta] = await Promise.all([
    rosa.waitForResponse((r) => new URL(r.url()).pathname === '/api/venta/cobrar'),
    toque(rosa, cobro.getByRole('button', { name: /^Cobrar \$/ })),
  ]);
  const cuerpo = (await respuesta.json()) as {
    datos?: { totalCentavos?: string; propinaCentavos?: string };
  };
  expect(respuesta.status(), JSON.stringify(cuerpo)).toBe(200);
  const ticket = rosa.getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' });
  await yaAbierto(ticket);
  await toque(rosa, ticket.getByRole('button', { name: 'Cerrar' }).first());
  return {
    totalCentavos: Number(cuerpo.datos?.totalCentavos ?? 0),
    propinaCentavos: Number(cuerpo.datos?.propinaCentavos ?? 0),
  };
}
