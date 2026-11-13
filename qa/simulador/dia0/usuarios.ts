/**
 * DÍA 0 · USUARIOS POS: los meseros, cajeras y cocineros que faltan, con un PIN de prueba que genera
 * `pines.ts` y se guarda FUERA del repositorio. Configuración → Usuarios POS → «Nuevo usuario».
 */
import { expect } from '@playwright/test';

import { USUARIOS, type UsuarioDeAlta } from './datos.ts';
import { irAConfiguracion, type Dia0 } from './contexto.ts';
import { asegurarPin } from './pines.ts';

async function crear(d: Dia0, u: UsuarioDeAlta): Promise<void> {
  const { pagina } = d;
  const { pin } = asegurarPin(d.entorno.archivoPines, u.nombre);
  await pagina.getByRole('button', { name: 'Nuevo usuario' }).click();
  const dialogo = pagina.getByRole('dialog').filter({ hasText: 'Nuevo usuario POS' });
  await dialogo.getByPlaceholder('Nombre del usuario').fill(u.nombre);
  await dialogo.getByRole('combobox', { name: 'Puesto' }).click();
  await pagina.getByRole('option', { name: u.puesto, exact: true }).click();
  if (u.estacion !== undefined) {
    // El segundo combobox del diálogo es la estación (sólo aparece con el puesto Cocina).
    await dialogo.getByRole('combobox').nth(1).click();
    await pagina.getByRole('option', { name: new RegExp(`^${u.estacion}`) }).click();
  }
  const campos = dialogo.getByPlaceholder('••••');
  await campos.nth(0).fill(pin);
  await campos.nth(1).fill(pin);
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialogo).toBeHidden({ timeout: 30_000 });
}

export async function pasoUsuarios(d: Dia0): Promise<void> {
  const { pagina } = d;
  await irAConfiguracion(d, 'Usuarios POS');
  await expect(pagina.getByRole('button', { name: 'Nuevo usuario' })).toBeVisible();
  await expect(pagina.getByRole('button', { name: /^Editar a / }).first()).toBeVisible();
  for (const u of USUARIOS) {
    if (
      (await pagina.getByRole('button', { name: `Editar a ${u.nombre}`, exact: true }).count()) > 0
    ) {
      d.nota('usuarios', `${u.nombre} ya estaba`);
      continue;
    }
    await crear(d, u);
    await expect(
      pagina.getByRole('button', { name: `Editar a ${u.nombre}`, exact: true }),
    ).toBeVisible();
    d.nota('usuarios', `creado ${u.nombre} (${u.puesto})`);
  }
  await d.foto('usuarios');
}
