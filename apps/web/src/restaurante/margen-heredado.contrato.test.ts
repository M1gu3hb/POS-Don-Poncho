import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-13.2 · EL MARGEN «SIN RECETA» EN LAS PANTALLAS HEREDADAS: la regla del servidor, no la suya.
 *
 * Caja, su Resumen del día, el diálogo del Cierre, la página del corte, el ticket del corte y el CSV
 * de Registros sumaban la foto del cobro (`costo_total_snapshot || 0`) y dividían la utilidad
 * entre TODO lo vendido: una cuenta sin receta (o con receta incompleta) contaba costo cero y el
 * margen salía inflado o del 100 %. Ahora cada una pasa por `economiaDelPeriodo`/`economiaDeLaVenta`
 * (`margen-de-las-ventas.ts`), que obedecen el `estado_costo` que manda el servidor
 * (`caja/corte/costo-conocido.ts`), y dicen «sin receta» en vez de un número. Son JavaScript
 * heredado que un test de componentes no alcanza: el contrato lee su texto, y se valida mutando
 * el código real.
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

const CAJA = 'heredado/pages/Caja.jsx';
const CORTE_CAJA = 'heredado/pages/CorteCaja.jsx';
const RESUMEN = 'heredado/components/caja/ResumenDelDia.jsx';
const CIERRE = 'heredado/components/caja/CierreDiarioDialog.jsx';
const TICKET = 'heredado/components/tickets/CorteTicket.jsx';
const CSV = 'heredado/lib/exportColumns.js';

describe('nadie suma la foto del cobro como costo, ni divide entre todo lo vendido', () => {
  it.each([CAJA, CORTE_CAJA, TICKET])('%s saca la economía del periodo de la regla', (archivo) => {
    const codigo = leer(archivo);
    expect(codigo).toMatch(/economiaDelPeriodo\(/);
    expect(codigo).not.toMatch(/costo_total_snapshot \|\| 0/);
    expect(codigo).not.toMatch(/utilidad_bruta_snapshot \|\| 0/);
  });

  it.each([CAJA, CORTE_CAJA, RESUMEN, CIERRE, TICKET])(
    '%s no calcula su propio margen sobre todo lo vendido',
    (archivo) => {
      const codigo = leer(archivo);
      expect(codigo).not.toMatch(/utilidadBruta\s*\/\s*(resumen\.)?totalGeneral/);
      expect(codigo).not.toMatch(/utilidad_bruta_total\s*\/\s*corte\.total_general/);
    },
  );

  it.each([CORTE_CAJA, RESUMEN, CIERRE, TICKET])(
    '%s dice «sin receta» (o lo que quedó fuera) en vez de un número',
    (archivo) => {
      expect(leer(archivo)).toMatch(/subtituloDelMargen\(|SIN_RECETA/);
    },
  );
});

describe('a quien no ve márgenes, ni costo, ni utilidad, ni «sin receta»', () => {
  it.each([CORTE_CAJA, CIERRE, TICKET])(
    '%s oculta el margen cuando el puesto no lo ve (las ventas llegan `oculto`)',
    (archivo) => {
      const codigo = leer(archivo);
      expect(codigo).toMatch(/seVeElMargen\(/);
      // Cada importe del margen se pinta bajo la guarda (`seVe &&` / `conMargen &&`), no suelto.
      const importes = [
        ...codigo.matchAll(
          /(label|title)="(Costo de ventas|Utilidad bruta|Margen prom[^"]*|Utilidad neta[^"]*)"|>(Utilidad bruta|Margen prom\.)</g,
        ),
      ];
      expect(importes.length, 'no encontré los importes del margen').toBeGreaterThan(1);
      for (const importe of importes) {
        const antes = codigo.slice(Math.max(0, (importe.index ?? 0) - 160), importe.index);
        expect(antes, `${importe[0]} se pinta sin la guarda`).toMatch(/(seVe|conMargen) && [(<]/);
      }
    },
  );
});

describe('el CSV de Registros', () => {
  it('el costo, la utilidad y el margen de cada venta pasan por la regla de la venta', () => {
    const codigo = leer(CSV);
    expect(codigo).toMatch(/economiaDeLaVenta\(/);
    for (const clave of ['costo_total_snapshot', 'utilidad_bruta_snapshot', 'margen_snapshot']) {
      const columna = new RegExp(`key: '${clave}'[^}]*format: fmtNum`);
      expect(codigo, `${clave} sigue saliendo como número aunque no tenga receta`).not.toMatch(
        columna,
      );
    }
  });
});
