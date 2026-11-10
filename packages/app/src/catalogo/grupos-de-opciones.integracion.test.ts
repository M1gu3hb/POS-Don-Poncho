import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';
import type { z } from 'zod';

import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { enviarPedidoDesdeQR } from '../portal/pedido.ts';
import { lineasDeLaCuenta, mesaConPortal } from '../portal/pruebas/mesa-con-portal.ts';
import { opcionesDeLosPlatillos } from '../restaurante/opciones-de-los-platillos.ts';
import {
  asignarGruposAlProducto,
  entradaAsignarGrupos,
  entradaGuardarGrupo,
  guardarGrupoDeOpciones,
} from './grupos-de-opciones.ts';
import { gruposDeOpciones } from './grupos-de-opciones-lectura.ts';
import { guardarModificadores } from './modificadores-guardar.ts';

/**
 * DP-16 · LA BIBLIOTECA DE GRUPOS DE OPCIONES, contra Postgres.
 *
 * Un grupo con precios que suman y restan, reusado en dos productos; editarlo cambia los dos y
 * conserva las opciones que ya existían; el comensal que pide desde su teléfono paga lo que dice el
 * catálogo; y el editor viejo, por producto, ya no le vacía el grupo a los demás.
 */

type Caso = Awaited<ReturnType<typeof mesaConPortal>>;
let caso: Caso;
let grupoId = '';

const guardar = async (entrada: z.input<typeof entradaGuardarGrupo>) =>
  exigirOk(
    await comando(guardarGrupoDeOpciones, {
      entrada,
      ambito: caso.ambito,
      idempotencyKey: clave(),
    }),
    'catalogo.guardar_grupo_de_opciones',
  );
const asignar = async (entrada: z.input<typeof entradaAsignarGrupos>) =>
  exigirOk(
    await comando(asignarGruposAlProducto, {
      entrada,
      ambito: caso.ambito,
      idempotencyKey: clave(),
    }),
    'catalogo.asignar_grupos_de_opciones',
  );
async function biblioteca() {
  return exigirOk(
    await comando(gruposDeOpciones, { entrada: {}, ambito: caso.ambito, idempotencyKey: clave() }),
    'catalogo.grupos_de_opciones',
  ).grupos;
}

beforeAll(async () => {
  caso = await mesaConPortal();
});

describe('DP-16 · los grupos de opciones se arman una vez y se reusan', () => {
  it('guarda un grupo con precios que suman y restan, y lo reusa en dos productos', async () => {
    grupoId = (
      await guardar({
        nombre: 'Salsa',
        tipo: 'unica',
        obligatorio: false,
        opciones: [
          { nombre: 'Verde', precio: '0' },
          { nombre: 'Roja', precio: '5' },
          { nombre: 'Sin salsa', precio: '-2.50' },
        ],
      })
    ).grupoId;
    await asignar({ productoId: caso.taco, grupoIds: [grupoId] });
    await asignar({ productoId: caso.agua, grupoIds: [grupoId] });

    const [salsa] = await biblioteca();
    expect(salsa?.opciones.map((o) => [o.nombre, o.precioCentavos])).toEqual([
      ['Verde', '0'],
      ['Roja', '500'],
      ['Sin salsa', '-250'],
    ]);
    expect([...(salsa?.productoIds ?? [])].sort()).toEqual([caso.taco, caso.agua].sort());
    const delMenu = await opcionesDeLosPlatillos(caso.ambito);
    expect(delMenu[caso.agua]?.[0]?.opciones.map((o) => o.precioCentavos)).toEqual([
      '0',
      '500',
      '-250',
    ]);
  });

  it('el comensal que pide desde su teléfono paga la opción como dice el catálogo', async () => {
    await caso.abrir(2);
    exigirOk(
      await caso.publico(enviarPedidoDesdeQR, {
        items: [{ productoId: caso.taco, cantidad: '2', notas: 'Salsa: Roja' }],
      }),
      'portal.enviar_pedido',
    );
    const base = await obtenerDb()
      .selectFrom('productos')
      .select('precio_venta_centavos')
      .where('id', '=', caso.taco)
      .executeTakeFirstOrThrow();
    const [linea] = await lineasDeLaCuenta(caso.mesaId);
    expect(linea?.precio_unitario_centavos).toBe(base.precio_venta_centavos + 500n);
    expect(linea?.subtotal_centavos).toBe((base.precio_venta_centavos + 500n) * 2n);
  });

  it('editarlo cambia los dos productos y conserva las opciones que ya existían', async () => {
    const [antes] = await biblioteca();
    const roja = antes?.opciones.find((o) => o.nombre === 'Roja');
    const verde = antes?.opciones.find((o) => o.nombre === 'Verde');
    await guardar({
      grupoId,
      nombre: 'Salsa de la casa',
      tipo: 'multiple',
      obligatorio: false,
      minimo: 1,
      maximo: 2,
      opciones: [
        { id: verde?.id, nombre: 'Verde', precio: '0' },
        { id: roja?.id, nombre: 'Roja', precio: '7' },
        { nombre: 'Habanero', precio: '3' },
      ],
    });
    const [despues] = await biblioteca();
    expect(despues).toMatchObject({
      nombre: 'Salsa de la casa',
      tipo: 'multiple',
      minimo: 1,
      maximo: 2,
    });
    expect(despues?.opciones.find((o) => o.nombre === 'Roja')).toMatchObject({
      id: roja?.id,
      precioCentavos: '700',
    });
    expect(despues?.opciones.map((o) => o.nombre)).toEqual(['Verde', 'Roja', 'Habanero']);
    const delMenu = await opcionesDeLosPlatillos(caso.ambito);
    expect(delMenu[caso.agua]?.[0]).toMatchObject({
      nombre: 'Salsa de la casa',
      minimo: 1,
      maximo: 2,
    });
  });

  it('no deja un mínimo mayor que las opciones activas, ni mínimo y máximo en un grupo de una', async () => {
    const r = await comando(guardarGrupoDeOpciones, {
      entrada: {
        nombre: 'Imposible',
        tipo: 'multiple',
        obligatorio: true,
        minimo: 3,
        opciones: [{ nombre: 'A' }, { nombre: 'B' }],
      },
      ambito: caso.ambito,
      idempotencyKey: clave(),
    });
    expect(r.ok).toBe(false);
    const unica = await comando(guardarGrupoDeOpciones, {
      entrada: {
        nombre: 'Una',
        tipo: 'unica',
        obligatorio: false,
        maximo: 2,
        opciones: [{ nombre: 'A' }],
      },
      ambito: caso.ambito,
      idempotencyKey: clave(),
    });
    expect(unica.ok).toBe(false);
  });

  it('el editor viejo por producto ya no le vacía el grupo compartido al otro producto', async () => {
    // El taco tiene, además del compartido, uno sólo suyo: ése sí se va con el editor viejo.
    const propio = await guardar({
      nombre: 'Sólo del taco',
      tipo: 'unica',
      obligatorio: false,
      opciones: [{ nombre: 'Doble tortilla', precio: '2' }],
    });
    await asignar({
      productoId: caso.taco,
      grupoIds: [grupoId, propio.grupoId],
    });
    exigirOk(
      await comando(guardarModificadores, {
        entrada: {
          productoId: caso.taco,
          grupos: [
            {
              nombre: 'Tortilla',
              obligatorio: false,
              tipo: 'unica',
              activo: true,
              opciones: [{ nombre: 'Maíz', precioExtra: '0', activa: true }],
            },
          ],
        },
        ambito: caso.ambito,
        idempotencyKey: clave(),
      }),
      'catalogo.guardar_modificadores',
    );
    const delMenu = await opcionesDeLosPlatillos(caso.ambito);
    expect(delMenu[caso.agua]?.[0]?.opciones.map((o) => o.nombre)).toEqual([
      'Verde',
      'Roja',
      'Habanero',
    ]);
  });
});
