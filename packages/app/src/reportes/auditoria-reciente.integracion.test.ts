import { conTransaccion } from '@morphiqpos/data';
import { describe, expect, it } from 'vitest';

import { nombrarTerminal } from '../caja/terminales.ts';
import { comando } from '../produccion.ts';
import {
  ambitoDe,
  clave,
  exigirOk,
  sembrarNegocio,
  sembrarSucursal,
  type NegocioReal,
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
        entrada: {},
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

/** Un renglón de auditoría con su instante exacto (UTC), como lo habría dejado el envoltorio. */
async function sembrarRenglon(
  negocio: NegocioReal,
  accion: string,
  cuando: string,
  marca: string,
): Promise<void> {
  await conTransaccion(async (tx) => {
    await tx
      .insertInto('auditoria')
      .values({
        organizacion_id: negocio.organizacionId,
        identidad_id: negocio.identidadId,
        accion,
        entidad: 'prueba',
        payload: JSON.stringify({ marca }),
        created_at: new Date(cuando),
      })
      .execute();
  });
}

const marcaDe = (r: { readonly payload: unknown }): string =>
  (r.payload as { marca: string }).marca;

describe('DP-15.1 · la auditoría filtra y pagina en el servidor', () => {
  async function negocioConHistoria() {
    const negocio = await sembrarNegocio({
      nombre: 'Fonda con historia',
      rol: 'dueno',
      giro: 'restaurante',
      paquete: 'restaurante',
    });
    const sucursal = await sembrarSucursal(negocio, { terminales: ['Caja'] });
    const ambito = ambitoDe(negocio, sucursal.sucursalId, sucursal.terminales[0] ?? null);
    return { negocio, ambito };
  }

  const leer = async (ambito: ReturnType<typeof ambitoDe>, entrada: Record<string, unknown>) =>
    comando(auditoriaReciente, { ambito, entrada, idempotencyKey: clave() });

  it('encuentra el cambio de PIN de la mañana aunque la noche haya dejado cientos de renglones', async () => {
    const { negocio, ambito } = await negocioConHistoria();
    // 09:00 de CDMX (15:00 UTC) del 10 de noviembre: el cambio de PIN.
    await sembrarRenglon(
      negocio,
      'identidad.establecer_pin',
      '2026-11-10T15:00:00.000Z',
      'pin-manana',
    );
    // Esa misma noche, 320 cobros-ruido más recientes: el cambio de PIN ya no cabe en «las últimas N».
    for (let i = 0; i < 320; i += 1) {
      await sembrarRenglon(
        negocio,
        'venta.cobrar',
        `2026-11-11T03:${String(i % 60).padStart(2, '0')}:00.000Z`,
        `ruido-${String(i)}`,
      );
    }
    const r = exigirOk(await leer(ambito, { grupo: 'pin_y_usuarios' }), 'leer los PIN');
    expect(r.renglones.map(marcaDe)).toEqual(['pin-manana']);
    expect(r.hayMas).toBe(false);
  });

  it('el día es el del negocio (CDMX): 23:30 de CDMX es de ese día aunque en UTC ya sea el siguiente', async () => {
    const { negocio, ambito } = await negocioConHistoria();
    await sembrarRenglon(
      negocio,
      'caja.nombrar_terminal',
      '2026-11-10T05:59:00.000Z',
      'antes-de-medianoche',
    ); // 23:59 del 9
    await sembrarRenglon(
      negocio,
      'caja.nombrar_terminal',
      '2026-11-10T06:00:00.000Z',
      'abre-el-10',
    ); // 00:00 del 10
    await sembrarRenglon(
      negocio,
      'caja.nombrar_terminal',
      '2026-11-11T05:30:00.000Z',
      'cierra-el-10',
    ); // 23:30 del 10
    await sembrarRenglon(
      negocio,
      'caja.nombrar_terminal',
      '2026-11-11T06:00:00.000Z',
      'abre-el-11',
    ); // 00:00 del 11
    const r = exigirOk(await leer(ambito, { fecha: '2026-11-10' }), 'leer el 10');
    expect(r.renglones.map(marcaDe)).toEqual(['cierra-el-10', 'abre-el-10']);
  });

  it('sólo devuelve el grupo y el día pedidos, y no mezcla los de otros grupos', async () => {
    const { negocio, ambito } = await negocioConHistoria();
    await sembrarRenglon(
      negocio,
      'catalogo.marcar_agotado',
      '2026-11-10T16:00:00.000Z',
      'agotado-10',
    );
    await sembrarRenglon(
      negocio,
      'catalogo.marcar_agotado',
      '2026-11-11T16:00:00.000Z',
      'agotado-11',
    );
    await sembrarRenglon(negocio, 'identidad.establecer_pin', '2026-11-10T17:00:00.000Z', 'pin-10');
    await sembrarRenglon(negocio, 'venta.cobrar', '2026-11-10T18:00:00.000Z', 'cobro-10');
    const r = exigirOk(await leer(ambito, { grupo: 'agotado', fecha: '2026-11-10' }), 'leer');
    expect(r.renglones.map(marcaDe)).toEqual(['agotado-10']);
    const sinGrupo = exigirOk(await leer(ambito, { fecha: '2026-11-10' }), 'leer el día');
    expect(sinGrupo.renglones.map(marcaDe)).toEqual(['cobro-10', 'pin-10', 'agotado-10']);
  });

  it('pagina de 50 en 50 sin repetir ni saltar, con desempate estable cuando coincide el instante', async () => {
    const { negocio, ambito } = await negocioConHistoria();
    const esperadas: string[] = [];
    for (let i = 0; i < 120; i += 1) {
      // De dos en dos comparten el instante exacto: el orden sólo lo decide el id.
      await sembrarRenglon(
        negocio,
        'caja.movimiento',
        `2026-11-10T16:${String(Math.floor(i / 2)).padStart(2, '0')}:00.000Z`,
        `m-${String(i)}`,
      );
      esperadas.push(`m-${String(i)}`);
    }
    const vistas: string[] = [];
    const tamanos: number[] = [];
    const hayMas: boolean[] = [];
    for (let pagina = 0; pagina < 3; pagina += 1) {
      const r = exigirOk(
        await leer(ambito, { grupo: 'efectivo', fecha: '2026-11-10', pagina }),
        `página ${String(pagina)}`,
      );
      expect(r.pagina).toBe(pagina);
      tamanos.push(r.renglones.length);
      hayMas.push(r.hayMas);
      vistas.push(...r.renglones.map(marcaDe));
    }
    expect(tamanos).toEqual([50, 50, 20]);
    expect(hayMas).toEqual([true, true, false]);
    expect(new Set(vistas).size).toBe(120);
    expect([...vistas].sort()).toEqual([...esperadas].sort());
    // Más reciente primero: el índice de siembra baja de 119 a 0 (a igual instante, el id mayor primero).
    expect(vistas).toEqual([...esperadas].reverse());
    const mas = exigirOk(
      await leer(ambito, { grupo: 'efectivo', fecha: '2026-11-10', pagina: 3 }),
      'página 3',
    );
    expect(mas.renglones).toEqual([]);
    expect(mas.hayMas).toBe(false);
  });

  it('justo 50 renglones caben en una página y no hay una siguiente', async () => {
    const { negocio, ambito } = await negocioConHistoria();
    for (let i = 0; i < 50; i += 1) {
      await sembrarRenglon(
        negocio,
        'caja.movimiento',
        `2026-11-10T16:${String(i).padStart(2, '0')}:00.000Z`,
        `m-${String(i)}`,
      );
    }
    const r = exigirOk(await leer(ambito, { grupo: 'efectivo' }), 'leer 50');
    expect(r.renglones).toHaveLength(50);
    expect(r.hayMas).toBe(false);
    await sembrarRenglon(negocio, 'caja.movimiento', '2026-11-10T17:00:00.000Z', 'm-50');
    const con51 = exigirOk(await leer(ambito, { grupo: 'efectivo' }), 'leer 51');
    expect(con51.renglones).toHaveLength(50);
    expect(con51.hayMas).toBe(true);
  });

  it('una entrada fuera de la lista cerrada se rechaza antes de tocar la base', async () => {
    const { ambito } = await negocioConHistoria();
    for (const entrada of [
      { grupo: 'todo' },
      { fecha: '10/11/2026' },
      { fecha: '2026-02-31' },
      { pagina: -1 },
      { pagina: 1.5 },
      { pagina: 100_000 },
      { limite: 10 },
    ]) {
      const r = await leer(ambito, entrada);
      expect(r.ok ? null : r.error.codigo, JSON.stringify(entrada)).toBe('ENTRADA_INVALIDA');
    }
  });
});
