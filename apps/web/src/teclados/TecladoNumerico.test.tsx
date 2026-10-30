import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { TecladoNumerico, type TecladoNumericoProps } from './TecladoNumerico.tsx';
import { aplanar, nombreDe, pulsar, type Elemento } from './lectura-de-elementos.ts';

/**
 * EL TECLADO DE PIN, UNO SOLO: el del acceso y el del despertar lo comparten.
 *
 * Se pinta (el marcado que llega al navegador) y se lee el árbol que devuelve el componente
 * para pulsarlo con el `onClick` real de cada tecla (sin DOM: ver `lectura-de-elementos`). Lo que
 * importa de cada copia que desapareció: el nombre accesible de cada tecla es el dígito EXACTO
 * (las pruebas de navegador las buscan así), el despertar no suelta el foco mientras comprueba
 * (`aria-disabled`) y el acceso sí deshabilita de verdad mientras espera un bloqueo.
 */

describe('el marcado que llega al navegador', () => {
  const noHace = () => undefined;
  const pintado = renderToStaticMarkup(
    <TecladoNumerico alDigito={noHace} alBorrar={noHace} alEntrar={noHace} />,
  );

  it('el contenedor suena a teclado y cada tecla lleva el relieve del tacto', () => {
    expect(pintado).toMatch(/^<div data-sonido="tecla"/);
    expect(pintado.match(/data-tacto/g)).toHaveLength(12);
  });

  it('«Entrar» suena como el botón que es, y las teclas no repiten el sonido', () => {
    expect(pintado.match(/data-sonido="toque"/g)).toHaveLength(1);
    expect(pintado.match(/data-sonido="tecla"/g)).toHaveLength(1);
  });

  it('cada tecla es un botón de tipo button: ninguna manda un formulario', () => {
    expect(pintado.match(/<button/g)).toHaveLength(12);
    expect(pintado.match(/type="button"/g)).toHaveLength(12);
  });

  it('en modo suave las teclas pintan aria-disabled y ninguna `disabled`', () => {
    const suave = renderToStaticMarkup(
      <TecladoNumerico alDigito={noHace} alBorrar={noHace} suave deshabilitado />,
    );
    expect(suave.match(/aria-disabled="true"/g)).toHaveLength(11);
    expect(suave).not.toMatch(/\sdisabled(=|\s|>)/);
  });
});

function acciones() {
  return { alDigito: vi.fn(), alBorrar: vi.fn(), alEntrar: vi.fn() };
}

/** Las teclas, en el orden en que se pintan: todo control que tiene `data-tacto`. */
function teclas(props: TecladoNumericoProps): Elemento[] {
  return aplanar(TecladoNumerico(props)).filter((el) => 'data-tacto' in el.props);
}

function tecla(props: TecladoNumericoProps, nombre: string): Elemento {
  const encontrada = teclas(props).find((el) => nombreDe(el) === nombre);
  if (encontrada === undefined) throw new Error(`No hay una tecla «${nombre}».`);
  return encontrada;
}

describe('las teclas y sus nombres', () => {
  it('sin «Entrar» (el despertar): del 1 al 9, Borrar y el 0, en ese orden', () => {
    const { alDigito, alBorrar } = acciones();
    expect(teclas({ alDigito, alBorrar }).map(nombreDe)).toEqual([
      ...['1', '2', '3', '4', '5', '6', '7', '8', '9'],
      'Borrar',
      '0',
    ]);
  });

  it('con «Entrar» (el acceso): se suma al final', () => {
    expect(teclas(acciones()).map(nombreDe).slice(-3)).toEqual(['Borrar', '0', 'Entrar']);
  });

  it('el borrado sin texto visible se sigue llamando «Borrar»', () => {
    const { alDigito, alBorrar } = acciones();
    const borrar = tecla({ alDigito, alBorrar }, 'Borrar');
    expect(borrar.props['aria-label']).toBe('Borrar');
  });
});

describe('el tacto y el sonido', () => {
  it('cada tecla lleva data-tacto, «Entrar» incluida', () => {
    const todas = teclas(acciones());
    expect(todas).toHaveLength(12);
    for (const el of todas) expect(el.props['data-tacto'], nombreDe(el)).toBeDefined();
  });

  it('el contenedor suena como teclado, y «Entrar» como el botón que es', () => {
    const arbol = aplanar(TecladoNumerico(acciones()));
    const contenedor = arbol.find((el) => el.props['data-sonido'] === 'tecla');
    expect(contenedor, 'Falta data-sonido="tecla" en el contenedor.').toBeDefined();
    expect(tecla(acciones(), 'Entrar').props['data-sonido']).toBe('toque');
    expect(tecla(acciones(), '5').props['data-sonido']).toBeUndefined();
  });
});

describe('al pulsar', () => {
  it('cada dígito manda SU dígito', () => {
    const { alDigito, alBorrar } = acciones();
    for (const digito of ['0', '1', '5', '9']) pulsar(tecla({ alDigito, alBorrar }, digito));
    expect(alDigito.mock.calls).toEqual([['0'], ['1'], ['5'], ['9']]);
  });

  it('Borrar y Entrar llaman a lo suyo', () => {
    const a = acciones();
    pulsar(tecla(a, 'Borrar'));
    pulsar(tecla(a, 'Entrar'));
    expect(a.alBorrar).toHaveBeenCalledTimes(1);
    expect(a.alEntrar).toHaveBeenCalledTimes(1);
    expect(a.alDigito).not.toHaveBeenCalled();
  });
});

describe('cuando no se puede teclear', () => {
  it('deshabilitado de verdad (el acceso): todas las teclas con `disabled`', () => {
    for (const el of teclas({ ...acciones(), deshabilitado: true })) {
      expect(el.props['disabled'], nombreDe(el)).toBe(true);
    }
  });

  it('Borrar se apaga sola cuando no hay nada que borrar, y «Entrar» cuando faltan dígitos', () => {
    const props = { ...acciones(), nadaQueBorrar: true, incompleto: true };
    expect(tecla(props, 'Borrar').props['disabled']).toBe(true);
    expect(tecla(props, 'Entrar').props['disabled']).toBe(true);
    expect(tecla(props, '3').props['disabled']).toBe(false);
  });

  it('«Entrar» enseña que está entrando', () => {
    expect(tecla({ ...acciones(), entrando: true }, 'Entrar').props['cargando']).toBe(true);
    expect(tecla(acciones(), 'Entrar').props['cargando']).toBe(false);
  });

  it('en modo suave (el despertar) usa aria-disabled, no `disabled`, y no pulsa nada', () => {
    const a = acciones();
    const props = { alDigito: a.alDigito, alBorrar: a.alBorrar, deshabilitado: true, suave: true };
    for (const el of teclas(props)) {
      expect(el.props['aria-disabled'], nombreDe(el)).toBe(true);
      expect(el.props['disabled'], nombreDe(el)).toBeUndefined();
      pulsar(el);
    }
    expect(a.alDigito).not.toHaveBeenCalled();
    expect(a.alBorrar).not.toHaveBeenCalled();
  });

  it('en modo suave y libre, las teclas dicen aria-disabled falso y sí pulsan', () => {
    const a = acciones();
    const props = { alDigito: a.alDigito, alBorrar: a.alBorrar, suave: true };
    expect(tecla(props, '4').props['aria-disabled']).toBe(false);
    pulsar(tecla(props, '4'));
    expect(a.alDigito).toHaveBeenCalledWith('4');
  });

  it('en modo suave, Borrar se apaga con aria-disabled cuando no hay nada que borrar', () => {
    const a = acciones();
    const props = { alDigito: a.alDigito, alBorrar: a.alBorrar, suave: true, nadaQueBorrar: true };
    expect(tecla(props, 'Borrar').props['aria-disabled']).toBe(true);
    pulsar(tecla(props, 'Borrar'));
    expect(a.alBorrar).not.toHaveBeenCalled();
  });
});
