import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { TecladoDeCobro, type TecladoDeCobroProps } from './TecladoDeCobro.tsx';
import { aplanar, nombreDe, pulsar, type Elemento } from './lectura-de-elementos.ts';

/**
 * EL TECLADO DE COBRO, pintado y pulsado: lo que llega a «Recibido» al tocar cada tecla.
 *
 * La lógica de cada tecla está en `teclado-de-cobro.test.ts`; aquí se comprueba que la pantalla
 * la CABLEA bien: que el billete fija (no suma), que «Exacto» manda el total de la cuenta, que
 * ninguna tecla es más chica que el dedo y que todas suenan y se hunden como teclas.
 */

function teclado(props: Partial<TecladoDeCobroProps> = {}): {
  readonly props: TecladoDeCobroProps;
  readonly alCambiar: ReturnType<typeof vi.fn>;
} {
  const alCambiar = vi.fn();
  return { props: { importe: '', totalCentavos: 85_050, alCambiar, ...props }, alCambiar };
}

/** Las teclas en el orden en que se pintan: todo control con `data-tacto`. */
function teclas(props: TecladoDeCobroProps): Elemento[] {
  return aplanar(TecladoDeCobro(props)).filter((el) => 'data-tacto' in el.props);
}

/** El nombre de una tecla; los billetes lo llevan en su `<Dinero>`, no en un texto. */
function rotuloDe(el: Elemento): string {
  const nombre = nombreDe(el);
  if (nombre !== '') return nombre;
  const dinero = aplanar(el.props['children'] as never).find(
    (hijo) => typeof hijo.props['centavos'] === 'number',
  );
  return dinero === undefined ? '' : `$${String((dinero.props['centavos'] as number) / 100)}`;
}

function tecla(props: TecladoDeCobroProps, rotulo: string): Elemento {
  const encontrada = teclas(props).find((el) => rotuloDe(el) === rotulo);
  if (encontrada === undefined) throw new Error(`No hay una tecla «${rotulo}».`);
  return encontrada;
}

describe('las teclas', () => {
  it('son 18: los diez dígitos, «00», el punto, borrar, «Exacto» y los cuatro billetes', () => {
    const { props } = teclado();
    expect(teclas(props).map(rotuloDe).sort()).toEqual(
      [
        ...['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '00'],
        'Punto decimal',
        'Borrar',
        'Exacto',
        ...['$50', '$100', '$200', '$500'],
      ].sort(),
    );
  });

  it('en el marcado cada una es un botón con tacto, sonido de tecla y alto de dedo', () => {
    const pintado = renderToStaticMarkup(<TecladoDeCobro {...teclado().props} />);
    expect(pintado.match(/<button/g)).toHaveLength(18);
    expect(pintado.match(/type="button"/g)).toHaveLength(18);
    expect(pintado.match(/data-tacto/g)).toHaveLength(18);
    expect(pintado.match(/data-sonido="tecla"/g)).toHaveLength(18);
    // Ninguna tecla baja del área táctil mínima: es la altura que pide la densidad elegida.
    expect(pintado.match(/h-\[calc\(var\(--area-tactil-minima\)/g)).toHaveLength(18);
  });

  it('no mete ni un campo de texto: los de la caja conservan su orden', () => {
    expect(renderToStaticMarkup(<TecladoDeCobro {...teclado().props} />)).not.toContain('<input');
  });
});

describe('al pulsar', () => {
  it('un dígito se agrega a lo recibido', () => {
    const { props, alCambiar } = teclado({ importe: '12' });
    pulsar(tecla(props, '7'));
    expect(alCambiar).toHaveBeenCalledWith('127');
  });

  it('«00» agrega dos ceros, el punto lo abre y borrar quita el último', () => {
    const { props, alCambiar } = teclado({ importe: '5' });
    pulsar(tecla(props, '00'));
    pulsar(tecla(props, 'Punto decimal'));
    pulsar(tecla(props, 'Borrar'));
    expect(alCambiar.mock.calls).toEqual([['500'], ['5.'], ['']]);
  });

  it('un billete FIJA lo recibido: con 120 tecleados, el de 500 deja 500 (no 620)', () => {
    const { props, alCambiar } = teclado({ importe: '120' });
    pulsar(tecla(props, '$500'));
    pulsar(tecla(props, '$50'));
    expect(alCambiar.mock.calls).toEqual([['500'], ['50']]);
  });

  it('«Exacto» manda el total de la cuenta en pesos con sus centavos', () => {
    const { props, alCambiar } = teclado({ importe: '20', totalCentavos: 85_050 });
    pulsar(tecla(props, 'Exacto'));
    expect(alCambiar).toHaveBeenCalledWith('850.50');
  });
});

describe('cuando no se puede teclear', () => {
  it('con la caja procesando todas las teclas están deshabilitadas y no mandan nada', () => {
    const { props, alCambiar } = teclado({ importe: '12', deshabilitado: true });
    for (const el of teclas(props)) {
      expect(el.props['disabled'], rotuloDe(el)).toBe(true);
      pulsar(el);
    }
    expect(alCambiar).not.toHaveBeenCalled();
  });

  it('borrar se apaga sola cuando no hay nada recibido', () => {
    expect(tecla(teclado({ importe: '' }).props, 'Borrar').props['disabled']).toBe(true);
    expect(tecla(teclado({ importe: '3' }).props, 'Borrar').props['disabled']).toBe(false);
  });
});
