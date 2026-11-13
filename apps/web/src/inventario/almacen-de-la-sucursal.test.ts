import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  NOMBRE_DEL_ALMACEN_PRINCIPAL,
  almacenPrincipal,
  crearAlmacenPrincipal,
  leerAlmacenes,
} from './almacen-de-la-sucursal.ts';

/**
 * DP-18 (A4) · SIN ALMACÉN NO HAY COMPRAS NI INVENTARIO, Y NINGUNA PANTALLA LO CREABA.
 *
 * `compras.registrar` respondía 422 «Esta sucursal no tiene un almacén donde recibir la compra» y el
 * comando que lo crea (`inventario.crear_almacen`, `POST /api/inventario/almacenes/crear`) existía sin
 * que ninguna pantalla lo llamara. La base de Don Poncho en producción no tiene almacén: el lunes nadie
 * habría podido registrar una compra.
 */

const respuesta = (cuerpo: unknown, estado = 200): Response =>
  new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': 'application/json' },
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('el almacén de la sucursal', () => {
  it('el principal manda; si ninguno lo es, el primero; sin almacenes, ninguno', () => {
    const a = { id: 'a', nombre: 'Bodega', principal: false };
    const b = { id: 'b', nombre: 'Almacén principal', principal: true };
    expect(almacenPrincipal([a, b])?.id).toBe('b');
    expect(almacenPrincipal([a])?.id).toBe('a');
    expect(almacenPrincipal([])).toBeNull();
  });

  it('se leen del resumen de inventario, sin caché', async () => {
    const llamadas: [string, RequestInit | undefined][] = [];
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      llamadas.push([url, init]);
      return Promise.resolve(
        respuesta({ ok: true, datos: { almacenes: [{ id: 'x', nombre: 'A', principal: true }] } }),
      );
    });

    const almacenes = await leerAlmacenes();

    expect(almacenes.map((a) => a.id)).toEqual(['x']);
    expect(llamadas[0]?.[0]).toBe('/api/inventario/resumen');
    expect(llamadas[0]?.[1]?.cache).toBe('no-store');
  });

  it('crearlo llama al comando con su nombre, como escritura propia y con clave de idempotencia', async () => {
    const llamadas: [string, RequestInit | undefined][] = [];
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      llamadas.push([url, init]);
      return Promise.resolve(respuesta({ ok: true, datos: { id: 'nuevo' } }));
    });

    const id = await crearAlmacenPrincipal();

    expect(id).toBe('nuevo');
    const [url, init] = llamadas[0] ?? [];
    expect(url).toBe('/api/inventario/almacenes/crear');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ nombre: NOMBRE_DEL_ALMACEN_PRINCIPAL });
    const cabeceras = new Headers(init?.headers);
    expect(cabeceras.get('idempotency-key')?.length ?? 0).toBeGreaterThan(8);
  });
});
