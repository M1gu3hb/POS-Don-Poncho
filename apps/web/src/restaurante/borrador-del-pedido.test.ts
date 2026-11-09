import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  GRACIA_DEL_BARRIDO_MS,
  VIGENCIA_DEL_BORRADOR_MS,
  borrarBorrador,
  claveDelBorrador,
  guardarBorrador,
  leerBorrador,
  limpiarBorradoresDeCuentasCerradas,
  type Almacen,
  type AlmacenRecorrible,
} from './borrador-del-pedido.ts';

function almacen(): AlmacenRecorrible & { readonly datos: Map<string, string> } {
  const datos = new Map<string, string>();
  return {
    datos,
    get length() {
      return datos.size;
    },
    key: (i) => [...datos.keys()][i] ?? null,
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

  it('no revive en otra cuenta de la misma mesa (otra familia), y se borra: esa cuenta ya se cerró', () => {
    const a = almacen();
    guardarBorrador(a, clave, borrador, 1_000);
    expect(leerBorrador(a, clave, 'orden-b', 2_000)).toBeNull();
    expect(a.datos.size).toBe(0);
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

describe('DP-15.1 · el borrador de una cuenta que ya se cobró se barre', () => {
  const OTRA = claveDelBorrador('mesero-1', 'mesa-7');
  const AHORA = 10 * 60 * 60 * 1000;
  const VIEJO = AHORA - GRACIA_DEL_BARRIDO_MS - 1;

  it('lo de una cuenta que ya no está sobre ninguna mesa se borra; lo de las vivas se queda', () => {
    const a = almacen();
    guardarBorrador(a, clave, borrador, VIEJO); // orden-a: sigue viva
    guardarBorrador(a, OTRA, { ...borrador, ordenId: 'orden-cobrada' }, VIEJO);
    limpiarBorradoresDeCuentasCerradas(a, new Set(['orden-a']), AHORA);
    expect([...a.datos.keys()]).toEqual([clave]);
  });

  it('no toca el que se acaba de guardar: la lista de mesas puede venir de antes de abrir la cuenta', () => {
    const a = almacen();
    guardarBorrador(a, OTRA, { ...borrador, ordenId: 'orden-recien-abierta' }, AHORA - 1_000);
    limpiarBorradoresDeCuentasCerradas(a, new Set(), AHORA);
    expect(a.datos.size).toBe(1);
  });

  it('lo vencido se borra aunque su cuenta siga viva', () => {
    const a = almacen();
    guardarBorrador(a, clave, borrador, AHORA - VIGENCIA_DEL_BORRADOR_MS - 1);
    limpiarBorradoresDeCuentasCerradas(a, new Set(['orden-a']), AHORA);
    expect(a.datos.size).toBe(0);
  });

  it('lo mal formado se borra, y lo que no es de este módulo no se toca', () => {
    const a = almacen();
    a.datos.set(`${clave}.roto`, '{no es json');
    a.datos.set(OTRA, JSON.stringify([1, 2]));
    a.datos.set('otra-cosa', 'intacta');
    limpiarBorradoresDeCuentasCerradas(a, new Set(['orden-a']), AHORA);
    // Sólo lo que lleva el prefijo del borrador se mira; el JSON roto y el que no es objeto, fuera.
    expect([...a.datos.keys()]).toEqual(['otra-cosa']);
  });

  it('un almacén que falla no tumba la pantalla', () => {
    const roto: AlmacenRecorrible = {
      length: 1,
      key: () => {
        throw new Error('bloqueado');
      },
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => undefined,
      removeItem: () => {
        throw new Error('bloqueado');
      },
    };
    expect(() => {
      limpiarBorradoresDeCuentasCerradas(roto, new Set(), AHORA);
    }).not.toThrow();
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
