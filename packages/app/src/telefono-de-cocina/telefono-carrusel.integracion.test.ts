import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { ambitoDe, clave, exigirOk } from '../pruebas/negocio-real.ts';
import { transicionarPedido } from '../restaurante/preparacion.ts';
import { conectarTelefonoDeCocina } from './conectar.ts';
import { pantallaDelTelefono, TOPE_DE_COMANDAS } from './consulta.ts';
import { cocinaDePrueba, PIMIENTA, type CocinaDePrueba } from './pruebas.ts';
import { firmarTokenDeEstacion } from './token-de-estacion.ts';

/**
 * DP-16 · 2.3 · EL TELÉFONO NUEVO, contra Postgres real.
 *
 * `comandas` trae TODAS las activas de la estación, de la más vieja a la más nueva y con tope;
 * `mesas` es la tira con nuevo, en preparación y listo sin entregar; cada platillo trae sus
 * opciones aparte de la nota, sin precio; y la `comanda` de siempre sigue ahí para el teléfono
 * con la versión vieja abierta.
 */

let cocina: CocinaDePrueba;
let token = '';

beforeAll(async () => {
  cocina = await cocinaDePrueba('Fonda del carrusel');
  const conectado = exigirOk(
    await comando(conectarTelefonoDeCocina, {
      entrada: { estacionId: cocina.estacionCocina },
      ambito: { ...ambitoDe(cocina.negocio, cocina.sucursalId, null), rol: 'gerente' },
      idempotencyKey: clave(),
    }),
    'restaurante.conectar_telefono_de_cocina',
  );
  token = firmarTokenDeEstacion(
    {
      organizacionId: conectado.organizacionId,
      estacionId: conectado.estacionId,
      dia: conectado.dia,
      version: conectado.version,
    },
    PIMIENTA,
  );
});

const leer = () =>
  pantallaDelTelefono({ token, organizacionId: cocina.negocio.organizacionId, pimienta: PIMIENTA });

const ESPERA_ENTRE_COMANDAS_MS = 5;
const pausa = () => new Promise((r) => setTimeout(r, ESPERA_ENTRE_COMANDAS_MS));

describe('las comandas activas, con su desglose', () => {
  it('trae todas las de su estación, la más vieja primero, y la tira con su estado', async () => {
    await cocina.pedir(1, [{ producto: 'taco', cantidad: '2' }]);
    await pausa();
    await cocina.pedir(2, [
      { producto: 'taco', cantidad: '1' },
      { producto: 'agua', cantidad: '1' },
    ]);
    await pausa();
    await cocina.pedir(3, [{ producto: 'taco', cantidad: '3' }]);

    const pantalla = await leer();
    expect(pantalla.comandas.map((c) => c.mesaNumero)).toEqual([1, 2, 3]);
    expect(
      pantalla.comandas.every((c) => c.platillos.every((p) => p.nombre.includes('Taco'))),
    ).toBe(true);
    // La `comanda` de siempre sigue siendo la más reciente, y `pendientes` el total.
    expect(pantalla.comanda?.mesaNumero).toBe(3);
    expect(pantalla.pendientes).toBe(3);
    expect(pantalla.mesas.map((m) => [m.mesaNumero, m.estado])).toEqual([
      [1, 'nuevo'],
      [2, 'nuevo'],
      [3, 'nuevo'],
    ]);
  });

  it('las opciones vienen aparte de la nota, con grupo y nombres y SIN precio', async () => {
    const linea = await obtenerDb()
      .selectFrom('orden_lineas as l')
      .innerJoin('ordenes as o', 'o.id', 'l.orden_id')
      .innerJoin('mesas as m', 'm.id', 'o.mesa_id')
      .select('l.id')
      .where('l.organizacion_id', '=', cocina.negocio.organizacionId)
      .where('m.numero', '=', 3)
      .executeTakeFirstOrThrow();
    await obtenerDb()
      .updateTable('orden_lineas')
      .set({
        opciones: JSON.stringify([
          {
            grupo: 'Salsa',
            opciones: [
              { nombre: 'verde', precioCentavos: 500 },
              { nombre: 'roja', precioCentavos: 0 },
            ],
          },
          { grupo: 'Vacío', opciones: [] },
        ]),
      })
      .where('id', '=', linea.id)
      .execute();

    const mesa3 = (await leer()).comandas.find((c) => c.mesaNumero === 3);
    expect(mesa3?.platillos[0]?.opciones).toEqual([{ grupo: 'Salsa', nombres: ['verde', 'roja'] }]);
    expect(mesa3?.platillos[0]?.notas).toBeNull();
    expect(JSON.stringify(await leer()), 'El teléfono recibe importes.').not.toMatch(
      /precio|total|costo|centavos/i,
    );
  });

  it('una en preparación sigue activa; una lista sale del carrusel pero se queda en la tira', async () => {
    const [primera, segunda] = (await leer()).comandas;
    const ambito = { ...ambitoDe(cocina.negocio, cocina.sucursalId, null), rol: 'cocina' as const };
    exigirOk(
      await comando(transicionarPedido, {
        entrada: { comandaId: primera?.id ?? '', estado: 'en_preparacion' },
        ambito,
        idempotencyKey: clave(),
      }),
      'restaurante.transicionar_pedido',
    );
    exigirOk(
      await comando(transicionarPedido, {
        entrada: { comandaId: segunda?.id ?? '', estado: 'listo' },
        ambito,
        idempotencyKey: clave(),
      }),
      'restaurante.transicionar_pedido',
    );
    const pantalla = await leer();
    expect(pantalla.comandas.map((c) => [c.mesaNumero, c.estado])).toEqual([
      [1, 'en_preparacion'],
      [3, 'nuevo'],
    ]);
    expect(pantalla.pendientes).toBe(2);
    expect(pantalla.mesas.map((m) => [m.mesaNumero, m.estado])).toEqual([
      [1, 'en_preparacion'],
      [2, 'listo'],
      [3, 'nuevo'],
    ]);
  });

  it('el tope: nunca más de TOPE_DE_COMANDAS en el carrusel, y `pendientes` dice el total', async () => {
    const mas = TOPE_DE_COMANDAS + 3;
    for (let i = 0; i < mas; i += 1) {
      await cocina.pedir(4, [{ producto: 'taco', cantidad: '1' }]);
    }
    const pantalla = await leer();
    expect(pantalla.comandas).toHaveLength(TOPE_DE_COMANDAS);
    expect(pantalla.pendientes).toBe(2 + mas);
    // Las más viejas primero: la de la mesa 1 sigue en la cabeza.
    expect(pantalla.comandas[0]?.mesaNumero).toBe(1);
  }, 120_000);
});
