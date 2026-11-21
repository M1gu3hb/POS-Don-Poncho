import { describe, expect, it } from 'vitest';

import { encabezadoDelBloque, horaDelPedido } from './encabezado-del-bloque';
import { bloquesPorColumna } from './platillos-del-tablero';
import type { ComandaDeCocina } from './tipos';

/**
 * DP-24 · 4.1 · El título del bloque: «Mesa 1 · Ana · hora», «PARA LLEVAR · 3 · Don Beto», y la
 * mesa PRINCIPAL en una unión.
 */

const comanda = (parche: Partial<ComandaDeCocina> = {}): ComandaDeCocina => ({
  id: 'c1',
  estado: 'nuevo',
  venta_id: 'cuenta-1',
  mesa_numero: 4,
  fecha_marchada: '2026-11-20T19:30:00.000Z',
  items: [{ id: 'a', producto_nombre: 'Taco', estado: 'pendiente', cantidad: 1 }],
  ...parche,
});

const bloque = (c: ComandaDeCocina) => bloquesPorColumna([c]).nuevo[0]!;

describe('encabezadoDelBloque', () => {
  it('«Mesa N» con el mesero y la hora del pedido', () => {
    const e = encabezadoDelBloque(bloque(comanda()), { mesero: 'Ana' }, 'UTC');
    expect(e.principal).toBe('Mesa 4');
    expect(e.detalle).toBe(`Ana · ${horaDelPedido('2026-11-20T19:30:00.000Z', 'UTC')}`);
    expect(e.detalle).toMatch(/^Ana · 7:30/);
  });

  it('en una unión dice la mesa PRINCIPAL de la cuenta, no la de la comanda', () => {
    const e = encabezadoDelBloque(bloque(comanda({ mesa_numero: 5 })), { mesaNumero: 4 }, 'UTC');
    expect(e.principal).toBe('Mesa 4');
  });

  it('el pedido para llevar se anuncia con su número y su nombre', () => {
    const e = encabezadoDelBloque(
      bloque(comanda({ canal: 'llevar', numero_pedido: 3, nombre_pedido: 'Don Beto' })),
      undefined,
      'UTC',
    );
    expect(e.principal).toBe('PARA LLEVAR · 3 · Don Beto');
  });

  it('sin mesero y sin fecha no inventa nada', () => {
    const e = encabezadoDelBloque(
      bloque(comanda({ fecha_marchada: null, fecha_creacion: null })),
      undefined,
      'UTC',
    );
    expect(e.detalle).toBe('');
  });
});
