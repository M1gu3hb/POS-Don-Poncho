import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  VIGENCIA_DEL_BORRADOR_MS,
  borrarBorrador,
  claveDelBorrador,
  guardarBorrador,
  leerBorrador,
  type Almacen,
} from './borrador-del-pedido.ts';

function almacen(): Almacen & { readonly datos: Map<string, string> } {
  const datos = new Map<string, string>();
  return {
    datos,
    getItem: (c) => datos.get(c) ?? null,
    setItem: (c, v) => {
      datos.set(c, v);
    },
    removeItem: (c) => {
      datos.delete(c);
    },
  };
}

const clave = claveDelBorrador('mesero-1', 'mesa-5');
const borrador = {
  ordenId: 'orden-a',
  carrito: [
    { id: 'taco', cantidad: 2, nombre: 'Taco de barbacoa' },
    { id: 'agua', cantidad: 1, nombre: 'Agua de jamaica' },
  ],
  nota: 'sin cebolla',
};

describe('DP-15 · el pedido a medias del mesero', () => {
  it('lo que se guarda se recupera en la misma cuenta, con todo', () => {
    const a = almacen();
    guardarBorrador(a, clave, borrador, 1_000);
    expect(leerBorrador(a, clave, 'orden-a', 2_000)).toEqual(borrador);
  });

  it('no revive en otra cuenta de la misma mesa (otra familia)', () => {
    const a = almacen();
    guardarBorrador(a, clave, borrador, 1_000);
    expect(leerBorrador(a, clave, 'orden-b', 2_000)).toBeNull();
  });

  it('a las 3 horas caduca, y se borra', () => {
    const a = almacen();
    guardarBorrador(a, clave, borrador, 1_000);
    expect(leerBorrador(a, clave, 'orden-a', 1_000 + VIGENCIA_DEL_BORRADOR_MS + 1)).toBeNull();
    expect(a.datos.size).toBe(0);
  });

  it('vacío no se guarda (y borra lo que había); enviado, se borra', () => {
    const a = almacen();
    guardarBorrador(a, clave, borrador, 1_000);
    guardarBorrador(a, clave, { ordenId: 'orden-a', carrito: [], nota: '' }, 2_000);
    expect(a.datos.size).toBe(0);
    guardarBorrador(a, clave, borrador, 3_000);
    borrarBorrador(a, clave);
    expect(leerBorrador(a, clave, 'orden-a', 4_000)).toBeNull();
  });

  it('cada persona tiene el suyo', () => {
    expect(claveDelBorrador('mesero-1', 'mesa-5')).not.toBe(claveDelBorrador('mesero-2', 'mesa-5'));
  });

  it('lo mal formado no revive y un almacén que falla no tumba la pantalla', () => {
    const a = almacen();
    a.datos.set(clave, '{no es json');
    expect(leerBorrador(a, clave, 'orden-a', 1)).toBeNull();
    a.datos.set(
      clave,
      JSON.stringify({
        ordenId: 'orden-a',
        guardado: 1,
        nota: '',
        carrito: [{ id: 'x', cantidad: -1 }],
      }),
    );
    expect(leerBorrador(a, clave, 'orden-a', 2)).toBeNull();
    const roto: Almacen = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('lleno');
      },
      removeItem: () => {
        throw new Error('bloqueado');
      },
    };
    expect(() => {
      guardarBorrador(roto, clave, borrador, 1);
    }).not.toThrow();
    expect(leerBorrador(roto, clave, 'orden-a', 1)).toBeNull();
  });
});

describe('DP-15 · el mesero usa el borrador', () => {
  it('lo recupera al abrir la cuenta, lo guarda mientras arma y lo borra al enviar', () => {
    const raiz = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
    const c = readFileSync(join(raiz, 'heredado', 'pages', 'Mesero.jsx'), 'utf8')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\s+/g, '');
    expect(c).toContain(
      'mesa.venta_activa_id,Date.now(),):null;setCarrito(borrador?[...borrador.carrito]:[]);',
    );
    expect(c).toContain(
      'guardarBorrador(almacenDelBorrador(),claveDelBorrador(posUser.id,mesaActiva.id),{ordenId:mesaActiva.venta_activa_id,carrito,nota:notaMesa},',
    );
    expect(c).toContain("sonar('enviarACocina');if(posUser?.id&&mesaActiva?.id){borrarBorrador(");
  });
});
