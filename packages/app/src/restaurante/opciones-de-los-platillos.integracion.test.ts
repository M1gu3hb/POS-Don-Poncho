import { describe, expect, it } from 'vitest';

import { guardarModificadores } from '../catalogo/modificadores-guardar.ts';
import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { opcionesDeLosPlatillos } from './opciones-de-los-platillos.ts';
import { ambitoDeCaja, sembrarSalon, type Salon } from './pruebas/salon-real.ts';

/**
 * QA1-4 (DP-13.5) · EL MESERO Y EL EDITOR VEN LAS OPCIONES DE CADA PLATILLO, Y CUÁLES SON OBLIGATORIAS.
 *
 * Sin esta lectura, el mesero no sabía que la quesadilla pide su relleno y la mandaba a cocina sin
 * él; el editor de Productos abría vacío un juego que se reemplaza entero al guardar.
 */

async function conOpciones(salon: Salon) {
  exigirOk(
    await comando(guardarModificadores, {
      entrada: {
        productoId: salon.platillos.arrachera,
        grupos: [
          {
            nombre: 'Término',
            obligatorio: true,
            tipo: 'unica',
            activo: true,
            opciones: [
              { nombre: 'Medio', activa: true },
              { nombre: 'Bien cocido', activa: false },
            ],
          },
          {
            nombre: 'Extras',
            obligatorio: false,
            tipo: 'multiple',
            activo: false,
            opciones: [{ nombre: 'Queso', activa: true }],
          },
        ],
      },
      ambito: { ...ambitoDeCaja(salon), rol: 'dueno' },
      idempotencyKey: clave(),
    }),
    'catalogo.guardar_modificadores',
  );
}

describe('las opciones de los platillos, para el personal', () => {
  it('cada grupo con su id, si es obligatorio, su tipo y lo activo de cada opción', async () => {
    const salon = await sembrarSalon({ nombre: 'Fonda de las opciones', mesas: 1 });
    await conOpciones(salon);

    const porProducto = await opcionesDeLosPlatillos({ ...ambitoDeCaja(salon), rol: 'mesero' });

    expect(Object.keys(porProducto)).toEqual([salon.platillos.arrachera]);
    const grupos = porProducto[salon.platillos.arrachera] ?? [];
    expect(grupos).toMatchObject([
      {
        nombre: 'Extras',
        obligatorio: false,
        tipo: 'multiple',
        activo: false,
        opciones: [{ nombre: 'Queso', activo: true }],
      },
      {
        nombre: 'Término',
        obligatorio: true,
        tipo: 'unica',
        activo: true,
        opciones: [
          { nombre: 'Medio', activo: true },
          { nombre: 'Bien cocido', activo: false },
        ],
      },
    ]);
    expect(grupos.every((g) => g.id.length > 0 && g.opciones.every((o) => o.id.length > 0))).toBe(
      true,
    );
  });

  it('sólo las del negocio de la sesión', async () => {
    const otro = await sembrarSalon({ nombre: 'Fonda vecina', mesas: 1 });
    await conOpciones(otro);
    const salon = await sembrarSalon({ nombre: 'Fonda sin opciones', mesas: 1 });

    expect(await opcionesDeLosPlatillos({ ...ambitoDeCaja(salon), rol: 'mesero' })).toEqual({});
  });
});
