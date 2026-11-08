import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-15 · LA CAJERA REGISTRA LO QUE ENTRA Y SALE DEL CAJÓN (bloqueante de la auditoría 1).
 *
 * Los retiros, el corte de turno y (para quien administra) el gasto y la devolución vivían sólo en la
 * pestaña «Movimientos» de `/restaurante/caja`, y la cajera entra a `/caja` (la heredada): un retiro
 * del sábado habría salido como faltante en el arqueo. La entrada de cambio no tenía pantalla. Ahora
 * `/caja` tiene «Movimientos» con los mismos formularios, y la entrada de cambio está entre ellos.
 */

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const sinEspacios = (ruta: string) =>
  readFileSync(join(RAIZ_WEB, ruta), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+/g, '');

describe('DP-15 · «Movimientos» en la caja de la cajera', () => {
  it('`/caja` tiene la pestaña con los formularios de siempre', () => {
    const c = sinEspacios('heredado/pages/Caja.jsx');
    expect(c).toContain(
      '<TabsTriggervalue="movimientos"className="shrink-0">Movimientos</TabsTrigger>',
    );
    expect(c).toContain(
      '<TabsContentvalue="movimientos"><MovimientosDeCajapuedeAdministrar={PUEDEN_ADMINISTRAR_LA_CAJA.includes(miPuesto)}',
    );
    expect(c).toContain("constPUEDEN_ADMINISTRAR_LA_CAJA=['dueno','administrador','gerente'];");
  });

  it('entre los movimientos está la entrada de cambio, para todos los de la caja', () => {
    const c = sinEspacios('src/restaurante/MovimientosDeCaja.tsx');
    expect(c).toContain(
      '<RetiroDeCajaalRetirar={alMover}/><EntradaDeCambioalRegistrar={alMover}/>',
    );
    expect(sinEspacios('src/venta/EntradaDeCambio.tsx')).toContain(
      "constRUTA='/api/caja/entrada-cambio';",
    );
  });
});
