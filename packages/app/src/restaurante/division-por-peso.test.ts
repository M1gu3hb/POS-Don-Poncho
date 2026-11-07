import { esErrorDominio } from '@morphiqpos/contracts';
import { describe, expect, it } from 'vitest';

import { dividirCuentaComando } from './division.ts';
import { contextoFalso, crearBaseFalsa, type Fila } from './pruebas/base-falsa.ts';
import {
  ambitoDe,
  comandaItem,
  CUENTA,
  linea,
  mesa,
  ordenDeMesa,
  PREDETERMINADOS,
} from './pruebas/sala.ts';

/**
 * DP-14.5 · DIVIDIR LA CUENTA CON BARBACOA POR KILO.
 *
 * La división reparte UNIDADES enteras. Una línea por peso —0.5 kg a $795— tiene `cantidad` 0.5:
 * el comando la truncaba a 0 unidades, la línea no entraba en ninguna parte, se quedaba en la
 * madre y las partes sumaban menos que ella (el trigger de la 070 reventaba al confirmar:
 * «Algo falló de nuestro lado»). Una línea por peso es UNA pieza indivisible: se mueve COMPLETA
 * a una sola parte, con su cantidad, su importe y su vínculo con cocina intactos.
 */

const PRECIO_POR_KILO = 79_500n;
const PESO = 'aaaaaaaa-9999-4999-8999-aaaaaaaaaaa9';
const CERVEZA = 'aaaaaaaa-3333-4333-8333-aaaaaaaaaaa3';
const ITEM_PESO = 'eeeeeeee-0000-4eee-8eee-000000000009';
const EMPLEADO = '55555555-5555-4555-8555-555555555555';

/** Los pesos de la tabla de aceptación, con su importe exacto a $795/kg. */
const PESOS: readonly (readonly [number, bigint])[] = [
  [0.25, 19_875n],
  [0.5, 39_750n],
  [0.75, 59_625n],
  [1, 79_500n],
  [1.5, 119_250n],
];

function barbacoa(kilos: number, importe: bigint, cambios: Fila = {}): Fila {
  return linea({
    id: PESO,
    producto_nombre: 'Barbacoa de horno',
    cantidad: kilos.toFixed(4),
    unidad: 'kg',
    precio_unitario_centavos: PRECIO_POR_KILO,
    costo_unitario_centavos: 30_000n,
    subtotal_centavos: importe,
    total_centavos: importe,
    utilidad_centavos: importe / 2n,
    tipo_venta: 'variable_medida',
    cantidad_variable: kilos.toFixed(4),
    unidad_variable: 'kg',
    anulada_en: null,
    ...cambios,
  });
}

function cerveza(piezas: number): Fila {
  const total = 5_500n * BigInt(piezas);
  return linea({
    id: CERVEZA,
    producto_nombre: 'Cerveza clara 355 ml',
    cantidad: `${String(piezas)}.0000`,
    precio_unitario_centavos: 5_500n,
    costo_unitario_centavos: 2_200n,
    subtotal_centavos: total,
    total_centavos: total,
    utilidad_centavos: total - 2_200n * BigInt(piezas),
    anulada_en: null,
  });
}

/** Una mesa con una barbacoa de `kilos` y `piezas` cervezas, la cuenta ya pedida. */
function mesaConBarbacoa(kilos: number, importe: bigint, piezas: number, cambios: Fila = {}) {
  return crearBaseFalsa(
    {
      ordenes: [
        ordenDeMesa('cuenta_solicitada', {
          serie: 'A',
          total_centavos: importe + 5_500n * BigInt(piezas),
          empleado_atiende_id: EMPLEADO,
          orden_padre_id: null,
          division_indice: null,
          codigo_caja: 'M05-4821',
          propina_tipo: 'sin_propina',
        }),
      ],
      orden_lineas: [barbacoa(kilos, importe, cambios), cerveza(piezas)],
      comanda_items: [
        comandaItem('entregado', {
          id: ITEM_PESO,
          orden_linea_id: PESO,
          producto_nombre: 'Barbacoa de horno',
          cantidad: kilos.toFixed(4),
          tipo_venta: 'variable_medida',
          unidad_variable: 'kg',
          cantidad_variable: kilos.toFixed(4),
          cantidad_porciones: null,
        }),
      ],
      movimientos_cuenta: [],
      mesas: [mesa('cuenta_solicitada')],
      eventos_mesa: [],
    },
    { predeterminados: PREDETERMINADOS, filasCrudas: [{ siguiente: 1n }] },
  );
}

const sumaDe = (filas: readonly Fila[], columna: string): bigint =>
  filas.reduce((suma, f) => suma + (typeof f[columna] === 'bigint' ? f[columna] : 0n), 0n);

async function codigoDe(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return 'NO LANZÓ';
  } catch (error) {
    return esErrorDominio(error) ? error.codigo : `INESPERADO: ${String(error)}`;
  }
}

describe.each(PESOS)('DP-14.5 · dividir con %s kg de barbacoa', (kilos, importe) => {
  it('LA BARBACOA VA COMPLETA A UNA PARTE: ni truncada ni partida, y las partes suman la madre', async () => {
    const base = mesaConBarbacoa(kilos, importe, 2);
    const { ctx } = contextoFalso(base.tx, ambitoDe('cajero'));

    // La barbacoa es UNA pieza (cantidad 1); las dos cervezas se reparten una a cada cuenta.
    const salida = await dividirCuentaComando.ejecutar(ctx, {
      ordenId: CUENTA,
      particiones: [
        {
          tomas: [
            { lineaId: PESO, cantidad: 1 },
            { lineaId: CERVEZA, cantidad: 1 },
          ],
        },
        { tomas: [{ lineaId: CERVEZA, cantidad: 1 }] },
      ],
    });

    expect(salida.hijas.map((h) => h.totalCentavos)).toEqual([String(importe + 5_500n), '5500']);
    expect(salida.totalCentavos).toBe(String(importe + 11_000n));
    const suma = salida.hijas.reduce((s, h) => s + BigInt(h.totalCentavos), 0n);
    expect(suma).toBe(importe + 11_000n);

    const lineas = base.filas('orden_lineas');
    const barbacoaDespues = lineas.filter((l) => l['producto_nombre'] === 'Barbacoa de horno');
    expect(barbacoaDespues, 'la barbacoa no se parte en filas').toHaveLength(1);
    expect(barbacoaDespues[0]).toMatchObject({
      orden_id: salida.hijas[0]?.ordenId,
      cantidad: kilos.toFixed(4),
      cantidad_variable: kilos.toFixed(4),
      total_centavos: importe,
    });
    expect(lineas.filter((l) => l['orden_id'] === CUENTA)).toEqual([]);
    for (const hija of salida.hijas) {
      const suyas = lineas.filter((l) => l['orden_id'] === hija.ordenId);
      expect(sumaDe(suyas, 'total_centavos')).toBe(BigInt(hija.totalCentavos));
    }
  });

  it('la cocina sigue la línea: su item conserva el peso, no se parte ni se trunca', async () => {
    const base = mesaConBarbacoa(kilos, importe, 1);
    const { ctx } = contextoFalso(base.tx, ambitoDe('cajero'));

    await dividirCuentaComando.ejecutar(ctx, {
      ordenId: CUENTA,
      particiones: [
        { tomas: [{ lineaId: CERVEZA, cantidad: 1 }] },
        { tomas: [{ lineaId: PESO, cantidad: 1 }] },
      ],
    });

    const items = base.filas('comanda_items');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      orden_linea_id: PESO,
      cantidad: kilos.toFixed(4),
      cantidad_variable: kilos.toFixed(4),
    });
  });

  it('la bitácora anota la barbacoa con SU importe entero, en la parte que se la llevó', async () => {
    const base = mesaConBarbacoa(kilos, importe, 1);
    const { ctx } = contextoFalso(base.tx, ambitoDe('cajero'));

    await dividirCuentaComando.ejecutar(ctx, {
      ordenId: CUENTA,
      particiones: [
        { tomas: [{ lineaId: CERVEZA, cantidad: 1 }] },
        { tomas: [{ lineaId: PESO, cantidad: 1 }] },
      ],
    });

    const anotadas = JSON.parse(String(base.filas('movimientos_cuenta')[0]?.['lineas'])) as {
      linea_id: string;
      importe_centavos: string;
      parte: number;
    }[];
    expect(anotadas.find((l) => l.linea_id === PESO)).toMatchObject({
      importe_centavos: String(importe),
      parte: 2,
    });
  });
});

describe('DP-14.5 · lo que una línea por peso NO admite', () => {
  it('no se reparte entre dos cuentas: la misma barbacoa en dos partes se rechaza con una regla', async () => {
    const base = mesaConBarbacoa(0.5, 39_750n, 1);
    const { ctx } = contextoFalso(base.tx, ambitoDe('cajero'));

    const codigo = await codigoDe(() =>
      dividirCuentaComando.ejecutar(ctx, {
        ordenId: CUENTA,
        particiones: [
          {
            tomas: [
              { lineaId: PESO, cantidad: 1 },
              { lineaId: CERVEZA, cantidad: 1 },
            ],
          },
          { tomas: [{ lineaId: PESO, cantidad: 1 }] },
        ],
      }),
    );

    expect(codigo).toBe('DIVISION_NO_CUADRA');
  });

  it('1 kg o 2 kg ENTEROS tampoco se parten por unidades: la línea sigue siendo una sola pieza', async () => {
    const base = mesaConBarbacoa(2, 159_000n, 1);
    const { ctx } = contextoFalso(base.tx, ambitoDe('cajero'));

    const codigo = await codigoDe(() =>
      dividirCuentaComando.ejecutar(ctx, {
        ordenId: CUENTA,
        // «2 kg» = 2 unidades para un cliente viejo: partirían la carne en dos filas.
        particiones: [
          { tomas: [{ lineaId: PESO, cantidad: 1 }] },
          {
            tomas: [
              { lineaId: PESO, cantidad: 1 },
              { lineaId: CERVEZA, cantidad: 1 },
            ],
          },
        ],
      }),
    );

    expect(codigo).toBe('DIVISION_NO_CUADRA');
  });

  it('una parte puede llevarse SÓLO la barbacoa y la otra lo demás', async () => {
    const base = mesaConBarbacoa(2, 159_000n, 3);
    const { ctx } = contextoFalso(base.tx, ambitoDe('cajero'));

    const salida = await dividirCuentaComando.ejecutar(ctx, {
      ordenId: CUENTA,
      particiones: [
        { tomas: [{ lineaId: PESO, cantidad: 1 }] },
        { tomas: [{ lineaId: CERVEZA, cantidad: 3 }] },
      ],
    });

    expect(salida.hijas.map((h) => h.totalCentavos)).toEqual(['159000', '16500']);
  });
});

describe('DP-14.5 · una cantidad no entera, aunque no sea por peso', () => {
  it('una línea de precio fijo con 0.5 también va ENTERA a una parte (no se trunca a cero)', async () => {
    const base = mesaConBarbacoa(0.5, 79_500n, 1, {
      tipo_venta: 'precio_fijo',
      cantidad_variable: null,
    });
    const { ctx } = contextoFalso(base.tx, ambitoDe('cajero'));

    const salida = await dividirCuentaComando.ejecutar(ctx, {
      ordenId: CUENTA,
      particiones: [
        { tomas: [{ lineaId: PESO, cantidad: 1 }] },
        { tomas: [{ lineaId: CERVEZA, cantidad: 1 }] },
      ],
    });

    expect(salida.hijas.map((h) => h.totalCentavos)).toEqual(['79500', '5500']);
  });
});
