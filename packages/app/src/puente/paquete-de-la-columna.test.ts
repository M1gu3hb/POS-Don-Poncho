import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const FUENTE_CONFIGURACION_PUENTE =
  process.env['MORPHIQPOS_PUENTE_CONFIGURACION_SOURCE_PATH'] ??
  fileURLToPath(new URL('./configuracion.ts', import.meta.url));

/**
 * B-2 · EL PAQUETE QUE VE EL FRONTEND HEREDADO SALE DE LA COLUMNA, NORMALIZADO.
 *
 * Venía en `presentacion.test.ts` junto con el cambio de plantilla del maestro; el cambio se
 * fue con el selector de modelos (DP-2) y la lectura se queda: el frontend heredado decide su
 * menú con `paquete_modo`. Leerla del documento JSON, o en crudo de la columna, le entregaba
 * un nombre que no reconoce, y ése cae en su plantilla por omisión. Lo vigilan dos mutaciones
 * de `verify:mutaciones-backend`.
 */
describe('B-2 · paquete efectivo de la organización', () => {
  it('se sirve de organizaciones.paquete, normalizado por su giro', () => {
    const configuracion = readFileSync(FUENTE_CONFIGURACION_PUENTE, 'utf8');
    expect(configuracion).toContain(
      'paquete_modo: plantillaDeOrganizacion(fila.giro, fila.paquete)',
    );
    expect(configuracion).not.toMatch(/paquete_modo:\s*guardados\['paquete_modo'\]/);
    expect(configuracion).not.toMatch(/paquete_modo:\s*fila\.paquete\b/);
  });
});
