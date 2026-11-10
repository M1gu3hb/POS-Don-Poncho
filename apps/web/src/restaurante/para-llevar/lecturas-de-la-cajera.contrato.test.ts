import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-16 · LA CAJERA TOMA PEDIDOS PARA LLEVAR: lee lo mismo que el mesero para armarlos.
 *
 * La prueba en el navegador lo encontró: la quesadilla (opción obligatoria) no se podía agregar
 * porque `opciones-de-los-platillos` le contestaba 403 a la cajera. Esa ruta no es un comando (no
 * la cubre la matriz de permisos), así que su lista de puestos se comprueba aquí.
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');

describe('lo que la cajera necesita leer para tomar un pedido para llevar', () => {
  it('las opciones de los platillos', () => {
    const ruta = readFileSync(
      join(RAIZ, 'app/api/restaurante/opciones-de-los-platillos/route.ts'),
      'utf8',
    );
    const roles = /roles:\s*\[([^\]]*)\]/.exec(ruta)?.[1] ?? '';
    expect(roles).toContain("'cajero'");
    expect(roles).toContain("'mesero'");
  });
});
