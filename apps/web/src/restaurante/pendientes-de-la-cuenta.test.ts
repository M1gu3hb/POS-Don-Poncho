import { describe, expect, it } from 'vitest';

import { pendientesDelRechazo } from './pendientes-de-la-cuenta.ts';

/**
 * DP-25 · Parte 2 · Lo que el servidor dice al rechazar «pedir la cuenta» con platillos
 * pendientes: se lee con cuidado, porque una lista mal formada NO debe abrir el aviso (el
 * mesero vería una pantalla vacía) ni tragarse el error de otro rechazo.
 */

const plato = (id: string, nombre: string, cantidad = '1') => ({
  id,
  nombre,
  cantidad,
  tipoVenta: null,
  unidadVariable: null,
});

const datos = (pendientes: unknown) => ({
  regla: 'CUENTA_CON_PENDIENTES',
  pendientes: typeof pendientes === 'string' ? pendientes : JSON.stringify(pendientes),
});

describe('pendientesDelRechazo', () => {
  it('lee las dos listas, por estación, tal como las manda el servidor', () => {
    const lista = pendientesDelRechazo(
      datos({
        sinPreparar: [{ estacion: 'Cocina general', platillos: [plato('a', 'Arrachera', '2')] }],
        listos: [{ estacion: null, platillos: [plato('b', 'Cerveza clara')] }],
      }),
    );

    expect(lista).not.toBeNull();
    expect(lista?.sinPreparar).toEqual([
      { estacion: 'Cocina general', platillos: [plato('a', 'Arrachera', '2')] },
    ]);
    expect(lista?.listos).toEqual([{ estacion: null, platillos: [plato('b', 'Cerveza clara')] }]);
  });

  it('un rechazo de OTRA regla no es el aviso', () => {
    expect(pendientesDelRechazo({ regla: 'ORDEN_VACIA' })).toBeNull();
    expect(pendientesDelRechazo(null)).toBeNull();
    expect(pendientesDelRechazo(undefined)).toBeNull();
  });

  it('una lista ilegible o vacía no abre el aviso', () => {
    expect(pendientesDelRechazo(datos('{no es json'))).toBeNull();
    expect(pendientesDelRechazo(datos({ sinPreparar: 3, listos: [] }))).toBeNull();
    expect(pendientesDelRechazo(datos({ sinPreparar: [], listos: [] }))).toBeNull();
    expect(
      pendientesDelRechazo(
        datos({ sinPreparar: [{ estacion: 'X', platillos: [{ nombre: 'sin id' }] }], listos: [] }),
      ),
    ).toBeNull();
  });
});
