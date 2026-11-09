import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { apartarAgotados, avisoDeAgotados, esRechazoPorAgotado } from './apartar-agotados.ts';

/**
 * DP-15.1 · Si al enviar el pedido algo se agotó, se aparta y se envía el resto.
 *
 * El servidor rechaza TODO el pedido con `PRODUCTO_AGOTADO` (una sola transacción: o entran todas
 * las líneas o ninguna) y no dice cuáles —sólo la regla—. La pantalla relee el menú, aparta lo que
 * ahora sale agotado, lo dice, y manda lo demás. Sin cambiar el error para los otros clientes.
 */

const taco = { id: 'p-taco', nombre: 'Taco de barbacoa', cantidad: 2 };
const consome = { id: 'p-consome', nombre: 'Consomé', cantidad: 1 };
const agua = { id: 'p-agua', nombre: 'Agua de jamaica', cantidad: 1 };

describe('apartar lo agotado del pedido', () => {
  it('aparta los renglones cuyo platillo ya sale agotado y deja el resto como estaba', () => {
    const resultado = apartarAgotados(
      [taco, consome, agua],
      [
        { id: 'p-taco', agotado_hoy: true },
        { id: 'p-consome', agotado_hoy: false },
        { id: 'p-agua' },
      ],
    );
    expect(resultado.quedan).toEqual([consome, agua]);
    expect(resultado.apartados).toEqual(['Taco de barbacoa']);
  });

  it('un platillo con dos renglones (con y sin cebolla) se aparta entero y se nombra una vez', () => {
    const otroTaco = { ...taco, cantidad: 1, notas: 'sin cebolla' };
    const resultado = apartarAgotados(
      [taco, otroTaco, agua],
      [{ id: 'p-taco', agotado_hoy: true }],
    );
    expect(resultado.quedan).toEqual([agua]);
    expect(resultado.apartados).toEqual(['Taco de barbacoa']);
  });

  it('si nada sale agotado en el menú releído, no aparta nada (y quien llama muestra el error del servidor)', () => {
    const resultado = apartarAgotados([taco], [{ id: 'p-taco', agotado_hoy: false }]);
    expect(resultado.quedan).toEqual([taco]);
    expect(resultado.apartados).toEqual([]);
  });

  it('un platillo que el menú ya no trae no se da por agotado: no se inventa', () => {
    expect(apartarAgotados([taco], []).apartados).toEqual([]);
  });

  it('si se agota todo, no queda nada que enviar', () => {
    const resultado = apartarAgotados([taco], [{ id: 'p-taco', agotado_hoy: true }]);
    expect(resultado.quedan).toEqual([]);
  });

  it('no muta el carrito que recibe', () => {
    const carrito = [taco, agua];
    apartarAgotados(carrito, [{ id: 'p-taco', agotado_hoy: true }]);
    expect(carrito).toEqual([taco, agua]);
  });
});

describe('el aviso', () => {
  it('uno: «X se agotó, lo quitamos del pedido»', () => {
    expect(avisoDeAgotados(['Consomé'])).toBe('Consomé se agotó, lo quitamos del pedido');
  });

  it('varios: en plural y bien unidos', () => {
    expect(avisoDeAgotados(['Consomé', 'Taco'])).toBe(
      'Consomé y Taco se agotaron, los quitamos del pedido',
    );
    expect(avisoDeAgotados(['Consomé', 'Taco', 'Agua'])).toBe(
      'Consomé, Taco y Agua se agotaron, los quitamos del pedido',
    );
  });
});

describe('reconocer el rechazo', () => {
  it('sólo la regla PRODUCTO_AGOTADO del servidor', () => {
    expect(esRechazoPorAgotado({ datos: { regla: 'PRODUCTO_AGOTADO' } })).toBe(true);
    expect(esRechazoPorAgotado({ datos: { regla: 'ORDEN_NO_EDITABLE' } })).toBe(false);
    expect(esRechazoPorAgotado({ datos: {} })).toBe(false);
    expect(esRechazoPorAgotado(new Error('PRODUCTO_AGOTADO'))).toBe(false);
    expect(esRechazoPorAgotado(null)).toBe(false);
    expect(esRechazoPorAgotado('PRODUCTO_AGOTADO')).toBe(false);
  });
});

describe('el mesero usa el apartado de agotados', () => {
  const raiz = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
  const c = readFileSync(join(raiz, 'heredado', 'pages', 'Mesero.jsx'), 'utf8')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+/g, '');

  it('ante PRODUCTO_AGOTADO relee el menú, aparta, avisa y reintenta UNA vez con otra clave', () => {
    expect(c).toContain(
      'if(!yaReintentado&&esRechazoPorAgotado(err)){constquedan=awaitapartarLoAgotado(renglones);',
    );
    expect(c).toContain(
      'claveEnvioRef.current=null;if(quedan.length>0)returnawaitenviarRenglones(quedan,true);return;',
    );
    expect(c).toContain('staleTime:0,');
    expect(c).toContain('toast.warning(avisoDeAgotados(apartados));');
  });

  it('el botón de enviar manda el carrito entero, sin heredar el evento del clic', () => {
    expect(c).toContain('constenviarPedido=()=>enviarRenglones(carrito,false);');
  });

  it('barre los borradores de cuentas cerradas sólo cuando ya leyó las mesas', () => {
    expect(c).toContain('if(!Array.isArray(mesasRaw)||mesasRaw.length===0)return;');
    expect(c).toContain(
      'limpiarBorradoresDeCuentasCerradas(almacenDelBorrador(),vivas,Date.now());',
    );
  });
});
