/**
 * DÍA 0 · LA COMPU DEL DUEÑO: se apaga el modo espera de SU aparato (Configuración → Este aparato)
 * para que el salvapantallas no le cierre los diálogos mientras da de alta el negocio. Es una
 * preferencia del aparato (no del negocio): las cajas y la cocina conservan la suya.
 */
import { expect } from '@playwright/test';

import { irAConfiguracion, type Dia0 } from './contexto.ts';

export async function apagarLaEspera(d: Dia0): Promise<void> {
  await irAConfiguracion(d, 'Este aparato');
  // DP-22 · En la tableta el interruptor no trae nombre accesible (hallazgo): se busca por su tarjeta.
  await expect(d.pagina.getByRole('switch').first()).toBeVisible({ timeout: 45_000 });
  const conNombre = d.pagina.getByRole('switch', { name: 'Modo espera en este aparato' });
  const interruptor =
    (await conNombre.count()) > 0 ? conNombre : d.pagina.getByRole('switch').first();
  await expect(interruptor).toBeVisible();
  if ((await interruptor.getAttribute('aria-checked')) === 'true') {
    await interruptor.click();
    await expect(interruptor).toHaveAttribute('aria-checked', 'false');
    d.nota('aparato', 'modo espera apagado en el aparato del dueño');
  }
}
