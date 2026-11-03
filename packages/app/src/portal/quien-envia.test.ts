import { describe, expect, it } from 'vitest';

import { banderasDe } from './banderas.ts';
import {
  comensalEnvia,
  comoSeEnvia,
  notaDelPedidoListo,
  platillosDelCarrito,
  type ReglasDelEnvio,
} from './quien-envia.ts';

/** DP-12.2 · Quién manda a cocina, y qué botón le toca al comensal. */

const MESERO: ReglasDelEnvio = { quienEnvia: 'mesero', comensalesAbrenMesa: true };
const COMENSALES: ReglasDelEnvio = { quienEnvia: 'comensales', comensalesAbrenMesa: false };
const COMENSALES_QUE_ABREN: ReglasDelEnvio = {
  quienEnvia: 'comensales',
  comensalesAbrenMesa: true,
};

describe('comoSeEnvia', () => {
  it('sólo el mesero envía: el comensal siempre lo llama, abierta o cerrada', () => {
    for (const cuentaAbierta of [true, false]) {
      expect(comoSeEnvia(MESERO, { cuentaAbierta, faltaMesero: false, cuentaPedida: false })).toBe(
        'llamar_mesero',
      );
    }
  });

  it('los comensales envían con la mesa abierta', () => {
    expect(
      comoSeEnvia(COMENSALES, { cuentaAbierta: true, faltaMesero: false, cuentaPedida: false }),
    ).toBe('enviar');
    expect(
      comoSeEnvia(COMENSALES_QUE_ABREN, {
        cuentaAbierta: true,
        faltaMesero: true,
        cuentaPedida: false,
      }),
    ).toBe('enviar');
  });

  it('con la mesa cerrada: la abren al enviar sólo si el negocio lo deja y la mesa tiene mesero', () => {
    expect(
      comoSeEnvia(COMENSALES_QUE_ABREN, {
        cuentaAbierta: false,
        faltaMesero: false,
        cuentaPedida: false,
      }),
    ).toBe('abrir_y_enviar');
    expect(
      comoSeEnvia(COMENSALES_QUE_ABREN, {
        cuentaAbierta: false,
        faltaMesero: true,
        cuentaPedida: false,
      }),
    ).toBe('pedir_que_atiendan');
    expect(
      comoSeEnvia(COMENSALES, { cuentaAbierta: false, faltaMesero: false, cuentaPedida: false }),
    ).toBe('pedir_que_atiendan');
  });

  it('DP-13.3 · con la cuenta ya pedida nadie envía desde el teléfono, mande quien mande', () => {
    for (const reglas of [MESERO, COMENSALES, COMENSALES_QUE_ABREN]) {
      expect(
        comoSeEnvia(reglas, { cuentaAbierta: true, faltaMesero: false, cuentaPedida: true }),
      ).toBe('cuenta_pedida');
    }
  });

  it('comensalEnvia sólo en los dos casos en que el comensal manda a cocina', () => {
    expect(comensalEnvia('enviar')).toBe(true);
    expect(comensalEnvia('abrir_y_enviar')).toBe(true);
    expect(comensalEnvia('llamar_mesero')).toBe(false);
    expect(comensalEnvia('pedir_que_atiendan')).toBe(false);
    expect(comensalEnvia('cuenta_pedida')).toBe(false);
  });
});

describe('las banderas del envío', () => {
  it('por omisión sólo el mesero envía y los comensales no abren su mesa', () => {
    expect(banderasDe({})).toMatchObject({ quienEnvia: 'mesero', comensalesAbrenMesa: false });
  });

  it('lee lo que el negocio eligió y descarta lo que no tiene forma', () => {
    expect(
      banderasDe({ portal_qr_envia_a_cocina: 'comensales', portal_qr_comensales_abren_mesa: true }),
    ).toMatchObject({ quienEnvia: 'comensales', comensalesAbrenMesa: true });
    expect(
      banderasDe({ portal_qr_envia_a_cocina: 'todos', portal_qr_comensales_abren_mesa: 'sí' }),
    ).toMatchObject({ quienEnvia: 'mesero', comensalesAbrenMesa: false });
  });
});

describe('la nota del aviso', () => {
  it('cuenta piezas enteras y lo de peso como uno', () => {
    expect(platillosDelCarrito(['2', '1', '0.5'])).toBe(4);
    expect(platillosDelCarrito([])).toBe(0);
  });

  it('dice cuántos platillos, en singular y plural', () => {
    expect(notaDelPedidoListo(1)).toBe('Pedido listo para confirmar (1 platillo)');
    expect(notaDelPedidoListo(3)).toBe('Pedido listo para confirmar (3 platillos)');
  });
});
