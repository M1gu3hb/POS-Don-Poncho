import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  botonDelCarrito,
  type EstadoDelCarrito,
  type LineaDelCarrito,
} from './carrito-compartido/carrito-de-la-mesa';
import {
  etiquetaDeLaOpcion,
  hayBarraDelCarrito,
  ordenarEsVolverALlamar,
  pedidoGuardadoEsperandoAlMesero,
  VOLVER_A_LLAMAR_AL_MESERO,
} from './atencion-del-comensal';

/** DP-13.4 · «Atención» no contradice a «Llamar a mi mesero» del carrito, ni lo tapa. */

const linea: LineaDelCarrito = {
  id: 'l1',
  productoId: 'p1',
  nombre: 'Barbacoa',
  cantidad: '1',
  notas: '',
  precioCentavos: '12000',
  esMia: true,
};

const estado = (parte: Partial<EstadoDelCarrito> = {}): EstadoDelCarrito => ({
  lineas: [linea],
  conectados: 1,
  personas: 2,
  esperarATodos: false,
  ronda: 0,
  ultimoEnvio: null,
  envio: 'llamar_mesero',
  meseroAvisado: true,
  ...parte,
});

describe('el pedido guardado que espera al mesero', () => {
  it('son platillos armados con el mesero ya avisado', () => {
    expect(pedidoGuardadoEsperandoAlMesero(estado())).toBe(true);
  });

  it('sin avisar al mesero no está esperándolo', () => {
    expect(pedidoGuardadoEsperandoAlMesero(estado({ meseroAvisado: false }))).toBe(false);
    // Un servidor anterior no manda el campo.
    const deUnServidorAnterior: EstadoDelCarrito = {
      lineas: [linea],
      conectados: 1,
      personas: 2,
      esperarATodos: false,
      ronda: 0,
      ultimoEnvio: null,
    };
    expect(pedidoGuardadoEsperandoAlMesero(deUnServidorAnterior)).toBe(false);
  });

  it('un aviso sin platillos no es un pedido guardado (llamar fallaría: «agrega algo»)', () => {
    expect(pedidoGuardadoEsperandoAlMesero(estado({ lineas: [] }))).toBe(false);
  });

  it('sin carrito leído tampoco', () => {
    expect(pedidoGuardadoEsperandoAlMesero(null)).toBe(false);
  });
});

describe('«Quiero ordenar» con el pedido guardado es volver a llamar', () => {
  it('sólo la opción «ordenar»', () => {
    expect(ordenarEsVolverALlamar('ordenar', estado())).toBe(true);
    expect(ordenarEsVolverALlamar('cuenta', estado())).toBe(false);
    expect(ordenarEsVolverALlamar('ayuda', estado())).toBe(false);
  });

  it('sin pedido guardado sigue siendo un aviso nuevo, como siempre', () => {
    expect(ordenarEsVolverALlamar('ordenar', estado({ meseroAvisado: false }))).toBe(false);
    expect(ordenarEsVolverALlamar('ordenar', null)).toBe(false);
  });

  it('dice lo mismo que el botón del carrito en ese estado', () => {
    expect(botonDelCarrito(estado()).texto).toBe(VOLVER_A_LLAMAR_AL_MESERO);
    expect(botonDelCarrito(estado({ envio: 'pedir_que_atiendan' })).texto).toBe(
      VOLVER_A_LLAMAR_AL_MESERO,
    );
  });

  it('la etiqueta cambia sólo para «ordenar» con el pedido guardado', () => {
    expect(etiquetaDeLaOpcion('ordenar', 'Quiero ordenar', true)).toBe(VOLVER_A_LLAMAR_AL_MESERO);
    expect(etiquetaDeLaOpcion('ordenar', 'Quiero ordenar', false)).toBe('Quiero ordenar');
    expect(etiquetaDeLaOpcion('cuenta', 'Pedir cuenta', true)).toBe('Pedir cuenta');
    expect(etiquetaDeLaOpcion('ayuda', 'Necesito ayuda', true)).toBe('Necesito ayuda');
  });
});

describe('la barra del carrito', () => {
  const base = { pedidosActivos: true, cuentaYaSolicitada: false, estado: estado() };

  it('está puesta con pedidos desde el teléfono, la cuenta sin pedir y algo armado', () => {
    expect(hayBarraDelCarrito(base)).toBe(true);
  });

  it('no hay barra sin platillos, sin pedidos desde el teléfono o con la cuenta ya pedida', () => {
    expect(hayBarraDelCarrito({ ...base, estado: estado({ lineas: [] }) })).toBe(false);
    expect(hayBarraDelCarrito({ ...base, estado: null })).toBe(false);
    expect(hayBarraDelCarrito({ ...base, pedidosActivos: false })).toBe(false);
    expect(hayBarraDelCarrito({ ...base, cuentaYaSolicitada: true })).toBe(false);
  });
});

/** El contrato de texto de las dos pantallas heredadas. */
const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');
const PORTAL = leer('heredado/pages/PortalCliente.jsx');
const FAB = leer('heredado/components/portalqr/AtencionFAB.jsx');

describe('PortalCliente', () => {
  it('«ordenar» con el pedido guardado llama por el carrito: el mismo aviso y las mismas palabras', () => {
    expect(PORTAL).toMatch(/ordenarEsVolverALlamar\(tipo, carritoMesa\.estado\)/);
    expect(PORTAL).toMatch(/await carritoMesa\.llamar\(\)/);
    expect(PORTAL).toMatch(/toast\.success\(PEDIDO_GUARDADO\)/);
  });

  it('le dice al botón flotante si hay barra y si el pedido está guardado', () => {
    // Lo que se les pasa sale de las funciones probadas arriba, no de un valor fijo.
    expect(PORTAL).toMatch(/sobreElCarrito=\{hayBarraDelCarrito\(\{/);
    expect(PORTAL).toMatch(
      /pedidoGuardado=\{pedidoGuardadoEsperandoAlMesero\(carritoMesa\.estado\)\}/,
    );
  });
});

describe('AtencionFAB', () => {
  it('sube por encima de la barra del carrito cuando la hay (no tapa su mitad izquierda)', () => {
    expect(FAB).toMatch(/sobreElCarrito\s*=\s*false/);
    expect(FAB).toMatch(
      /BORDE_DE_ABAJO_SOBRE_EL_CARRITO =\s*'calc\(var\(--espacio-4\) \+ var\(--altura-control\) \+ var\(--espacio-3\)\)'/,
    );
    expect(FAB).toMatch(
      /style=\{sobreElCarrito \? \{ bottom: BORDE_DE_ABAJO_SOBRE_EL_CARRITO \} : undefined\}/,
    );
  });

  it('sigue a la izquierda y abajo: el contrato de DP-12.6 no se toca', () => {
    expect(FAB).toMatch(/fixed bottom-5 left-5 z-50 flex flex-col items-start/);
  });

  it('la opción «ordenar» con el pedido guardado dice lo del carrito', () => {
    expect(FAB).toMatch(/pedidoGuardado\s*=\s*false/);
    expect(FAB).toMatch(/etiquetaDeLaOpcion\(\s*tipo,/);
  });

  it('la etiqueta accesible del botón no cambia', () => {
    expect(FAB).toMatch(/'Atención'/);
    expect(FAB).toMatch(/'Atención no disponible'/);
  });
});
