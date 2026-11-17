import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import type { Hallazgo } from './tipos.ts';

/**
 * ACCESIBILIDAD con axe-core: sin violaciones `serious` ni `critical`, y contraste AA (la regla
 * `color-contrast` va en las etiquetas `wcag2aa`). Una violación es un hallazgo por regla, con el
 * primer nodo afectado como selector y cuántos hay en las medidas.
 */

const ETIQUETAS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const IMPACTOS = new Set(['serious', 'critical']);

export async function medirAccesibilidad(page: Page): Promise<Hallazgo[]> {
  const resultado = await new AxeBuilder({ page }).withTags(ETIQUETAS).analyze();
  return resultado.violations
    .filter((v) => v.impact !== undefined && v.impact !== null && IMPACTOS.has(v.impact))
    .map((v): Hallazgo => {
      const primero = v.nodes[0];
      return {
        tipo: 'accesibilidad',
        selector: primero === undefined ? v.id : primero.target.join(' '),
        texto: v.help,
        medidas: { regla: v.id, impacto: v.impact ?? '', nodos: v.nodes.length },
        detalle: (primero?.failureSummary ?? v.description).replaceAll(/\s+/g, ' ').slice(0, 220),
      };
    });
}
