import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  claveDelBorrador,
  guardarBorrador,
  leerBorrador,
  type AlmacenRecorrible,
} from '../borrador-del-pedido.ts';
import { textoDelTelefono, type PedidoParaLlevar } from './pedidos-para-llevar.ts';

/**
 * DP-D157 · El teléfono del pedido para llevar, del lado de la pantalla.
 *
 * Viaja con el borrador igual que el nombre (una recarga a media captura no lo pierde, y al
 * cobrar, descartar o vaciar se va con él), se pide junto al nombre, se valida antes de enviar con
 * la MISMA regla del servidor y se ve en la lista de «Para llevar» de la Caja.
 */

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const fuente = (...ruta: string[]): string =>
  readFileSync(join(RAIZ_WEB, ...ruta), 'utf8')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+/g, ' ');

function almacen(): AlmacenRecorrible {
  const datos = new Map<string, string>();
  return {
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

const clave = claveDelBorrador('cajera-1', 'para-llevar');
const carrito = [{ id: 'taco', cantidad: 2 }];

describe('el teléfono viaja con el borrador, como el nombre', () => {
  it('lo que se guarda se recupera con el teléfono', () => {
    const a = almacen();
    guardarBorrador(
      a,
      clave,
      { ordenId: 'para-llevar', carrito, nota: 'Ana', telefono: '55 2468 5678' },
      1_000,
    );
    expect(leerBorrador(a, clave, 'para-llevar', 2_000)).toEqual({
      ordenId: 'para-llevar',
      carrito,
      nota: 'Ana',
      telefono: '55 2468 5678',
    });
  });

  it('un borrador de antes (sin teléfono) se sigue leyendo igual, sin inventar el campo', () => {
    const a = almacen();
    guardarBorrador(a, clave, { ordenId: 'para-llevar', carrito, nota: 'Ana' }, 1_000);
    const leido = leerBorrador(a, clave, 'para-llevar', 2_000);
    expect(leido).toEqual({ ordenId: 'para-llevar', carrito, nota: 'Ana' });
    expect(leido).not.toHaveProperty('telefono');
  });

  it('sin renglones ni nombre no se guarda nada, aunque haya un teléfono tecleado', () => {
    const a = almacen();
    guardarBorrador(
      a,
      clave,
      { ordenId: 'para-llevar', carrito: [], nota: '', telefono: '5524685678' },
      1_000,
    );
    expect(a.length).toBe(0);
  });

  it('un teléfono que no es texto no revive', () => {
    const a = almacen();
    a.setItem(
      clave,
      JSON.stringify({
        ordenId: 'para-llevar',
        carrito,
        nota: '',
        telefono: 5524685678,
        guardado: 1_000,
      }),
    );
    expect(leerBorrador(a, clave, 'para-llevar', 2_000)).toEqual({
      ordenId: 'para-llevar',
      carrito,
      nota: '',
    });
  });
});

describe('el armado del pedido lo guarda y lo suelta', () => {
  const hook = fuente('heredado', 'components', 'pedido', 'useArmadoDelPedido.js');

  it('recupera el teléfono del borrador, lo guarda con el carrito y la nota, y lo expone', () => {
    expect(hook).toContain(
      "const [telefono, setTelefono] = useState(() => guardado?.telefono ?? '');",
    );
    expect(hook).toContain('{ ordenId: ordenDelBorrador, carrito, nota, telefono },');
    expect(hook).toContain('}, [carrito, nota, telefono, claveDelAparato, ordenDelBorrador]);');
    expect(hook).toContain('telefono, setTelefono,');
  });

  it('«vaciar» (descartar, o cobrado) borra el teléfono junto con el nombre y el borrador', () => {
    expect(hook).toContain(
      "const vaciar = () => { setCarrito([]); setNota(''); setTelefono(''); if (claveDelAparato) borrarBorrador(",
    );
  });
});

describe('el diálogo del pedido para llevar', () => {
  const dialogo = fuente('heredado', 'components', 'caja', 'ParaLlevarDialog.jsx');

  it('pide el teléfono junto al nombre, opcional, en un campo de teléfono', () => {
    expect(dialogo).toContain('htmlFor="para-llevar-telefono"');
    expect(dialogo).toContain('id="para-llevar-telefono"');
    expect(dialogo).toContain('inputMode="tel"');
    expect(dialogo).toContain('value={pedido.telefono}');
    expect(dialogo).toContain('onChange={(e) => pedido.setTelefono(e.target.value.slice(0, 40))}');
  });

  it('valida con la regla del dominio antes de armar y no manda nada si es inválido', () => {
    expect(dialogo).toContain(
      "import { normalizarTelefonoDelPedido } from '@morphiqpos/domain/venta';",
    );
    expect(dialogo).toContain('const telefono = normalizarTelefonoDelPedido(pedido.telefono);');
    expect(dialogo).toContain('if (!telefono.ok) { toast.error(telefono.motivo); return; }');
  });

  it('manda telefonoPedido sólo si hay uno, junto a nombrePedido', () => {
    expect(dialogo).toContain(
      '{ ...(nombre ? { nombrePedido: nombre } : {}), ...(telefono.telefono ? { telefonoPedido: telefono.telefono } : {}), lineas, },',
    );
  });
});

describe('la lista de «Para llevar» de la Caja', () => {
  const base: PedidoParaLlevar = {
    ordenId: 'o1',
    numero: 3,
    nombre: 'Ana',
    telefono: null,
    folio: 'A-1',
    totalCentavos: '0',
    cobradoEn: null,
    estado: 'listo',
    pendientes: 0,
    listas: 1,
    listoEn: null,
  };

  it('dice el teléfono cuando lo hay, y nada cuando no', () => {
    expect(textoDelTelefono({ ...base, telefono: '55 2468 5678' })).toBe('Tel. 55 2468 5678');
    expect(textoDelTelefono({ ...base, telefono: '  ' })).toBeNull();
    expect(textoDelTelefono({ ...base, telefono: null })).toBeNull();
    // Un servidor viejo no manda el campo.
    expect(textoDelTelefono({})).toBeNull();
  });

  it('la pantalla pinta el teléfono en lo listo y en lo que sigue en cocina', () => {
    const c = fuente('src', 'restaurante', 'para-llevar', 'ParaLlevarDeHoy.tsx');
    expect(c).toContain('textoDelTelefono(pedido)');
    // Una vez en la tarjeta de lo listo y otra en la fila de lo que sigue en cocina: cada una con su guarda.
    expect(c.split('{textoDelTelefono(pedido) === null ? null : (')).toHaveLength(3);
  });
});
