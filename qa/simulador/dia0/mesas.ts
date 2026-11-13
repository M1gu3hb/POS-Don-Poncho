/**
 * DÍA 0 · MESAS: una zona nueva (Terraza) con 10 mesas más (20 en total) y el QR de cada una.
 * Configuración → Mesas (Zonas, Nueva mesa) y Portal QR → Mesas QR → «Generar tokens faltantes».
 */
import { expect } from '@playwright/test';

import { consultar } from '../api-app.ts';
import { irAConfiguracion, ir, type Dia0 } from './contexto.ts';
import { MESAS_EN_TOTAL, MESAS_NUEVAS, ZONA_NUEVA } from './datos.ts';

async function asegurarZona(d: Dia0): Promise<void> {
  const { pagina } = d;
  await pagina.getByRole('button', { name: 'Zonas', exact: true }).click();
  const dialogo = pagina.getByRole('dialog').filter({ hasText: 'Zonas del salón' });
  if ((await dialogo.getByLabel(`Nombre de la zona ${ZONA_NUEVA}`).count()) === 0) {
    await dialogo.getByLabel('Nombre de la zona nueva').fill(ZONA_NUEVA);
    await dialogo.getByRole('button', { name: 'Agregar', exact: true }).click();
    await expect(dialogo.getByLabel(`Nombre de la zona ${ZONA_NUEVA}`)).toBeVisible();
    d.nota('mesas', `creada la zona ${ZONA_NUEVA}`);
  } else {
    d.nota('mesas', `la zona ${ZONA_NUEVA} ya estaba`);
  }
  await pagina.keyboard.press('Escape');
  await expect(dialogo).toBeHidden();
}

async function crearMesa(d: Dia0, numero: number, lugar: number): Promise<void> {
  const { pagina } = d;
  await pagina.getByRole('button', { name: 'Nueva mesa' }).click();
  const dialogo = pagina.getByRole('dialog').filter({ hasText: 'Nombre visible' });
  const numeros = dialogo.getByRole('spinbutton');
  await numeros.nth(0).fill(String(numero));
  await dialogo.getByRole('combobox').first().click();
  await pagina.getByRole('option', { name: ZONA_NUEVA, exact: true }).click();
  await numeros.nth(1).fill('4');
  // Las 10 de la terraza en una cuadrícula propia, para que el mapa no las amontone.
  await numeros.nth(2).fill(String(60 + (lugar % 5) * 150));
  await numeros.nth(3).fill(String(60 + Math.floor(lugar / 5) * 150));
  await dialogo.getByRole('button', { name: 'Crear mesa' }).click();
  await expect(dialogo).toBeHidden({ timeout: 30_000 });
}

async function generarLosQr(d: Dia0): Promise<void> {
  const { pagina } = d;
  await ir(d, '/portal-qr');
  await pagina.getByRole('tab', { name: 'Mesas QR' }).click();
  pagina.once('dialog', (aviso) => void aviso.accept());
  await pagina.getByRole('button', { name: 'Generar tokens faltantes' }).click();
  await expect(pagina.getByText('QR activo', { exact: true })).toHaveCount(MESAS_EN_TOTAL, {
    timeout: 30_000,
  });
}

/** Repartir las 20 mesas entre los 6 meseros (4, 4, 3, 3, 3 y 3) con «Repartir mesas». */
const REPARTO: readonly { readonly mesero: string; readonly mesas: readonly number[] }[] = [
  { mesero: 'Mesero 1', mesas: [1, 2, 3, 4] },
  { mesero: 'Mesero 2', mesas: [5, 6, 7, 8] },
  { mesero: 'Mesero 3', mesas: [9, 10, 11] },
  { mesero: 'Mesero 4', mesas: [12, 13, 14] },
  { mesero: 'Mesero 5', mesas: [15, 16, 17] },
  { mesero: 'Mesero 6', mesas: [18, 19, 20] },
];

async function repartirLasMesas(d: Dia0): Promise<void> {
  const { pagina } = d;
  for (const { mesero, mesas } of REPARTO) {
    await pagina.getByRole('button', { name: 'Repartir mesas' }).click();
    const dialogo = pagina
      .getByRole('dialog')
      .filter({ hasText: 'Elige al mesero y marca las mesas' });
    await dialogo.getByRole('radio', { name: mesero }).click();
    await dialogo.getByRole('button', { name: 'Ninguna' }).click();
    for (const m of mesas)
      await dialogo.getByRole('checkbox', { name: `Mesa ${String(m)}`, exact: true }).click();
    await dialogo.getByRole('button', { name: 'Repartir', exact: true }).click();
    await expect(dialogo).toBeHidden({ timeout: 30_000 });
    d.nota('mesas', `${mesero}: mesas ${mesas.join(', ')}`);
  }
}

export async function pasoMesas(d: Dia0): Promise<void> {
  const { pagina } = d;
  await irAConfiguracion(d, 'Mesas');
  await expect(pagina.getByRole('button', { name: 'Nueva mesa' })).toBeVisible();
  await asegurarZona(d);
  const hay = new Set((await consultar<{ numero: number }>(pagina, 'Mesa')).map((m) => m.numero));
  let lugar = 0;
  for (const numero of MESAS_NUEVAS) {
    if (hay.has(numero)) {
      d.nota('mesas', `la mesa ${String(numero)} ya estaba`);
    } else {
      await crearMesa(d, numero, lugar);
      d.nota('mesas', `creada la mesa ${String(numero)} en ${ZONA_NUEVA}`);
    }
    lugar += 1;
  }
  await repartirLasMesas(d);
  await generarLosQr(d);
  // La pantalla ya dijo «QR activo» en las 20; el token se guarda un instante después: se espera a verlo.
  const conTokens = async () =>
    (await consultar<{ qr_token?: string | null }>(pagina, 'Mesa')).filter(
      (m) => (m.qr_token ?? '') !== '',
    ).length;
  await expect.poll(conTokens, { timeout: 30_000 }).toBe(MESAS_EN_TOTAL);
  const mesas = await consultar<{ numero: number; qr_token?: string | null }>(pagina, 'Mesa');
  const conQr = mesas.filter((m) => (m.qr_token ?? '') !== '').length;
  d.nota('mesas', `${String(mesas.length)} mesas, ${String(conQr)} con QR`);
  if (mesas.length < MESAS_EN_TOTAL || conQr < MESAS_EN_TOTAL)
    throw new Error('Faltan mesas o QR después del día 0.');
  await d.foto('mesas-qr');
}
