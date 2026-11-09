import { describe, expect, it } from 'vitest';

import { nombrarTerminal } from '../caja/terminales.ts';
import { comando } from '../produccion.ts';
import {
  ambitoDe,
  clave,
  exigirOk,
  sembrarNegocio,
  sembrarSucursal,
} from '../pruebas/negocio-real.ts';
import { auditoriaReciente } from './auditoria-reciente.ts';

/**
 * DP-15 · La auditoría en Registros, contra Postgres real: el renombre de una caja aparece con
 * quién lo hizo; sólo la ve quien manda; nunca la de otro negocio.
 */

describe('DP-15 · la auditoría reciente', () => {
  it('el renombre de una caja aparece, con quién, lo más nuevo primero', async () => {
    const negocio = await sembrarNegocio({
      nombre: 'Fonda de la auditoría',
      rol: 'dueno',
      giro: 'restaurante',
      paquete: 'restaurante',
    });
    const sucursal = await sembrarSucursal(negocio, { terminales: ['Caja'] });
    const terminal = sucursal.terminales[0] ?? null;
    const ambito = ambitoDe(negocio, sucursal.sucursalId, terminal);
    exigirOk(
      await comando(nombrarTerminal, {
        ambito,
        entrada: { terminal: terminal ?? '', nombre: 'Barra' },
        idempotencyKey: clave(),
      }),
      'nombrar la terminal',
    );
    exigirOk(
      await comando(nombrarTerminal, {
        ambito,
        entrada: { terminal: terminal ?? '', nombre: 'Salón' },
        idempotencyKey: clave(),
      }),
      'renombrar otra vez',
    );
    const { renglones } = exigirOk(
      await comando(auditoriaReciente, {
        ambito,
        entrada: { limite: 10 },
        idempotencyKey: clave(),
      }),
      'leer la auditoría',
    );
    const renombres = renglones.filter((r) => r.accion === 'caja.nombrar_terminal');
    expect(renombres.map((r) => (r.payload as { despues?: string }).despues)).toEqual([
      'Salón',
      'Barra',
    ]);
    const renombre = renombres[0];
    expect(renombre).toBeDefined();
    expect(renombre?.payload).toMatchObject({ antes: 'Barra', despues: 'Salón' });
    expect(renombre?.quien).toBeTruthy();
    expect(renglones[0]?.cuando).toBe(
      renglones
        .map((r) => r.cuando)
        .sort()
        .reverse()[0],
    );
  });

  it('la cajera y la gerente no la leen; otro negocio no ve la ajena', async () => {
    const negocio = await sembrarNegocio({
      nombre: 'Fonda A',
      rol: 'dueno',
      giro: 'restaurante',
      paquete: 'restaurante',
    });
    const sucursal = await sembrarSucursal(negocio, { terminales: ['Caja'] });
    const terminal = sucursal.terminales[0] ?? null;
    const ambito = ambitoDe(negocio, sucursal.sucursalId, terminal);
    exigirOk(
      await comando(nombrarTerminal, {
        ambito,
        entrada: { terminal: terminal ?? '', nombre: 'Barra' },
        idempotencyKey: clave(),
      }),
      'nombrar',
    );
    for (const rol of ['cajero', 'gerente', 'mesero'] as const) {
      const r = await comando(auditoriaReciente, {
        ambito: { ...ambito, rol },
        entrada: {},
        idempotencyKey: clave(),
      });
      expect(r.ok, rol).toBe(false);
    }
    const otro = await sembrarNegocio({
      nombre: 'Fonda B',
      rol: 'dueno',
      giro: 'restaurante',
      paquete: 'restaurante',
    });
    const suya = await sembrarSucursal(otro, { terminales: [] });
    const { renglones } = exigirOk(
      await comando(auditoriaReciente, {
        ambito: ambitoDe(otro, suya.sucursalId, null),
        entrada: {},
        idempotencyKey: clave(),
      }),
      'leer la del otro negocio',
    );
    expect(renglones.some((r) => r.accion === 'caja.nombrar_terminal')).toBe(false);
  });
});
