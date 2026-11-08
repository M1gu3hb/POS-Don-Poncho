import { esErrorDominio } from '@morphiqpos/contracts';
import { describe, expect, it } from 'vitest';

import {
  contextoFalso,
  crearBaseFalsa,
  type TablasFalsas,
} from '../restaurante/pruebas/base-falsa.ts';
import { ambitoDe, ORG, SESION_CAJA, SUCURSAL, TERMINAL } from '../restaurante/pruebas/sala.ts';
import { registrarEntradaDeCambio } from './entrada-cambio.ts';

/**
 * Meter cambio a la caja a media mañana.
 *
 * ── Lo que estas pruebas defienden ───────────────────────────────────────
 * Que el FONDO ESPERADO suba. Si no subiera, el corte de la noche diría que
 * sobran $600 todos los días que alguien metió cambio — y un corte que sobra por
 * diseño deja de servir para detectar el faltante, que es para lo que existe.
 *
 * Que el movimiento NO sea un depósito de venta. Registrarlo como venta infla el
 * día; no registrarlo hace que el arqueo encuentre $600 de más y que el cajero
 * pase veinte minutos buscando una venta que no existe.
 *
 * Y que el desglose se conserve. «Entraron $600» no dice si se puede dar cambio;
 * «$600 en monedas de diez» sí, y ésa es la pregunta de las once.
 *
 * DP-15: lo que toca la base (el fondo que sube, el tipo, el origen y el desglose de la apertura
 * intacto) se prueba contra Postgres real en `entrada-cambio.integracion.test.ts`: esta base falsa
 * no aplicaba las restricciones de la real y escondió que la entrada nunca se podía guardar.
 */

const AHORA = new Date('2026-09-16T11:00:00.000Z');

function baseDe(extra: Partial<TablasFalsas> = {}) {
  return crearBaseFalsa(
    {
      sesiones_caja: [
        {
          id: SESION_CAJA,
          organizacion_id: ORG,
          sucursal_id: SUCURSAL,
          terminal_id: TERMINAL,
          estado: 'abierta',
          fondo_esperado_centavos: 150_000n,
          fondo_monedas_centavos: 20_000n,
          fondo_chicos_centavos: 30_000n,
        },
      ],
      movimientos_caja: [],
      ...extra,
    },
    {
      predeterminados: {
        movimientos_caja: { referencia_tipo: null, referencia_id: null, motivo: null },
      },
    },
  );
}

async function codigoDe(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return 'NO LANZÓ';
  } catch (error) {
    return esErrorDominio(error) ? error.codigo : `INESPERADO: ${String(error)}`;
  }
}

describe('la entrada de cambio', () => {
  it('un movimiento de CERO se rechaza', async () => {
    // Es una línea en el corte que hay que leer y que no dice nada.
    const base = baseDe();
    const { ctx } = contextoFalso(base.tx, ambitoDe('cajero'), AHORA);

    const codigo = await codigoDe(() =>
      registrarEntradaDeCambio.ejecutar(ctx, {
        monedasCentavos: 0,
        chicosCentavos: 0,
        origen: 'banco',
        motivo: null,
      }),
    );

    expect(codigo).toBe('CANTIDAD_INVALIDA');
    expect(base.filas('movimientos_caja')).toHaveLength(0);
  });

  it('sin caja abierta no entra nada', async () => {
    const base = baseDe({ sesiones_caja: [] });
    const { ctx } = contextoFalso(base.tx, ambitoDe('cajero'), AHORA);

    const codigo = await codigoDe(() =>
      registrarEntradaDeCambio.ejecutar(ctx, {
        monedasCentavos: 10_000,
        chicosCentavos: 0,
        origen: 'banco',
        motivo: null,
      }),
    );

    expect(codigo).toBe('CAJA_CERRADA');
  });
});
