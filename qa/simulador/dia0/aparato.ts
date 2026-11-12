/**
 * DÍA 0 · LA COMPU DEL DUEÑO: se apaga el modo espera de SU aparato (Configuración → Este aparato)
 * para que el salvapantallas no le cierre los diálogos mientras da de alta el negocio. Es una
 * preferencia del aparato (no del negocio): las cajas y la cocina conservan la suya.
 */
import { expect } from '@playwright/test';

import { irAConfiguracion, type Dia0 } from './contexto.ts';

export async function apagarLaEspera(d: Dia0): Promise<void> {
  await irAConfiguracion(d, 'Este aparato');
  const interruptor = d.pagina.getByRole('switch', { name: 'Modo espera en este aparato' });
  await expect(interruptor).toBeVisible();
  if ((await interruptor.getAttribute('aria-checked')) === 'true') {
    await interruptor.click();
    await expect(interruptor).toHaveAttribute('aria-checked', 'false');
    d.nota('aparato', 'modo espera apagado en el aparato del dueño');
  }
}
