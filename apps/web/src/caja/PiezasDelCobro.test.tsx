import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { aplanar, nombreDe, pulsar, type Elemento } from '../teclados/lectura-de-elementos.ts';
import { CabeceraDeCaja, type CabeceraDeCajaProps } from './CabeceraDeCaja.tsx';
import { RecibidoDelCobro } from './RecibidoDelCobro.tsx';
import { ResumenDeCobro } from './ResumenDeCobro.tsx';
import { TeselasDeMetodo } from './TeselasDeMetodo.tsx';

/**
 * LAS PIEZAS DEL COBRO, pintadas: lo que las pruebas de navegador buscan por nombre y lo que el
 * cajero lee. Se pinta el marcado (como llega al navegador) y se pulsa con el `onClick` real.
 */

function texto(marcado: string): string {
  return (
    marcado
      .replace(/<\/(span|p|div|dt|dd|button|h1|label)>/g, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      // `<Dinero>` parte el importe en tres `<span>` en línea: aquí se junta como se lee.
      .replace(
        /\$ ([\d,]+) \.(\d\d)/g,
        (_, pesos: string, centavos: string) => `$${pesos}.${centavos}`,
      )
  );
}

function cabecera(parcial: Partial<CabeceraDeCajaProps> = {}): CabeceraDeCajaProps {
  return {
    hayCaja: true,
    esCajaDirecta: false,
    cobrosPendientes: 2,
    cargandoCaja: false,
    puedoAbrir: true,
    verificandoMesas: false,
    alAbrirCaja: () => undefined,
    alCorteDeTurno: () => undefined,
    alCierreDiario: () => undefined,
    ...parcial,
  };
}

function botones(props: CabeceraDeCajaProps): Elemento[] {
  return aplanar(CabeceraDeCaja(props)).filter((el) => typeof el.props['onClick'] === 'function');
}

describe('la cabecera de la caja', () => {
  it('es el h1 «Caja» y cuenta los cobros pendientes', () => {
    const marcado = renderToStaticMarkup(<CabeceraDeCaja {...cabecera()} />);
    expect(marcado).toMatch(/<h1[^>]*>Caja<\/h1>/);
    expect(texto(marcado)).toContain('2 cobros pendientes');
  });

  it('dice cómo va el día: caja cerrada, o punto de venta directo', () => {
    expect(
      texto(renderToStaticMarkup(<CabeceraDeCaja {...cabecera({ hayCaja: false })} />)),
    ).toContain('Caja cerrada');
    const directa = cabecera({ esCajaDirecta: true });
    expect(texto(renderToStaticMarkup(<CabeceraDeCaja {...directa} />))).toContain(
      'Punto de venta directo',
    );
  });

  it('cada acción tiene su rótulo largo y su rótulo corto del teléfono', () => {
    const marcado = renderToStaticMarkup(<CabeceraDeCaja {...cabecera()} />);
    for (const [largo, corto] of [
      ['Abrir caja', 'Abrir'],
      ['Corte de turno', 'Turno'],
      ['Cierre diario', 'Cierre'],
    ] as const) {
      expect(marcado).toMatch(new RegExp(`class="hidden sm:inline">${largo}<`));
      expect(marcado).toMatch(new RegExp(`class="sm:hidden">${corto}<`));
    }
  });

  it('con la caja abierta: sólo «Abrir caja» queda apagado', () => {
    const [abrir, turno, cierre] = botones(cabecera());
    expect(abrir?.props['disabled']).toBe(true);
    expect(turno?.props['disabled']).toBe(false);
    expect(cierre?.props['disabled']).toBe(false);
  });

  it('con la caja cerrada: se puede abrir y no se puede cortar ni cerrar', () => {
    const [abrir, turno, cierre] = botones(cabecera({ hayCaja: false }));
    expect(abrir?.props['disabled']).toBe(false);
    expect(abrir?.props['variant']).toBe('default');
    expect(turno?.props['disabled']).toBe(true);
    expect(cierre?.props['disabled']).toBe(true);
  });

  it('mientras la caja carga o si no se puede abrir, «Abrir caja» no se pulsa', () => {
    expect(botones(cabecera({ hayCaja: false, cargandoCaja: true }))[0]?.props['disabled']).toBe(
      true,
    );
    expect(botones(cabecera({ hayCaja: false, puedoAbrir: false }))[0]?.props['disabled']).toBe(
      true,
    );
  });

  it('mientras se verifican las mesas, el cierre dice que verifica y no se pulsa', () => {
    const props = cabecera({ verificandoMesas: true });
    expect(botones(props)[2]?.props['disabled']).toBe(true);
    expect(texto(renderToStaticMarkup(<CabeceraDeCaja {...props} />))).toContain('Verificando…');
  });

  it('cada botón llama a lo suyo', () => {
    const alAbrirCaja = vi.fn();
    const alCorteDeTurno = vi.fn();
    const alCierreDiario = vi.fn();
    const props = cabecera({ alAbrirCaja, alCorteDeTurno, alCierreDiario, hayCaja: false });
    for (const boton of botones(props)) pulsar(boton);
    // Cerrada: «Abrir caja» pulsa; el corte y el cierre están `disabled` y el navegador no los pulsa.
    expect(alAbrirCaja).toHaveBeenCalledTimes(1);
    expect(alCorteDeTurno).not.toHaveBeenCalled();
    expect(alCierreDiario).not.toHaveBeenCalled();
  });
});

describe('las teselas del método de pago', () => {
  it('son cuatro, con el nombre exacto de cada método', () => {
    const teselas = aplanar(
      TeselasDeMetodo({ metodo: 'efectivo', alElegir: () => undefined }),
    ).filter((el) => el.props['aria-pressed'] !== undefined);
    expect(teselas.map(nombreDe)).toEqual(['Efectivo', 'Tarjeta', 'Transferencia', 'Mixto']);
  });

  it('la elegida lo dice con aria-pressed y con su palomita, no sólo con el anillo', () => {
    const marcado = renderToStaticMarkup(
      <TeselasDeMetodo metodo="tarjeta" alElegir={() => undefined} />,
    );
    expect(marcado.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(marcado.match(/aria-pressed="false"/g)).toHaveLength(3);
    expect(marcado.match(/data-activa/g)).toHaveLength(1);
    expect(marcado.match(/lucide-check/g)).toHaveLength(1);
  });

  it('tocar una tesela elige SU método', () => {
    const alElegir = vi.fn();
    const teselas = aplanar(TeselasDeMetodo({ metodo: 'efectivo', alElegir })).filter(
      (el) => el.props['aria-pressed'] !== undefined,
    );
    for (const tesela of teselas) pulsar(tesela);
    expect(alElegir.mock.calls).toEqual([['efectivo'], ['tarjeta'], ['transferencia'], ['mixto']]);
  });
});

describe('el resumen del cobro', () => {
  const base = {
    subtotalCentavos: 35_000,
    propinaCentavos: 0,
    propinaPorcentaje: 0,
    totalCentavos: 35_000,
    colorearImportes: true,
    propinaTipo: 'sin_propina',
    alDefinirPropina: () => undefined,
  };

  it('dice la venta y el total a cobrar, en grande', () => {
    const marcado = renderToStaticMarkup(<ResumenDeCobro {...base} />);
    expect(texto(marcado)).toContain('Subtotal $350.00');
    expect(texto(marcado)).toContain('$350.00 TOTAL A COBRAR');
    expect(marcado).toContain('text-display');
  });

  it('con propina la suma al total y dice su porcentaje', () => {
    const marcado = texto(
      renderToStaticMarkup(
        <ResumenDeCobro
          {...base}
          propinaCentavos={3_500}
          propinaPorcentaje={10}
          totalCentavos={38_500}
        />,
      ),
    );
    expect(marcado).toContain('Propina (10%) + $35.00');
    expect(marcado).toContain('$385.00 TOTAL A COBRAR');
  });

  it('una propina sin decidir es un botón que dice quién la dejó en el aire', () => {
    const alDefinirPropina = vi.fn();
    const props = { ...base, propinaTipo: 'pendiente_cliente', alDefinirPropina };
    expect(texto(renderToStaticMarkup(<ResumenDeCobro {...props} />))).toContain(
      'Cliente no eligió propina en QR — toca para definirla',
    );
    const boton = aplanar(ResumenDeCobro(props)).find(
      (el) => typeof el.props['onClick'] === 'function',
    );
    expect(boton).toBeDefined();
    if (boton !== undefined) pulsar(boton);
    expect(alDefinirPropina).toHaveBeenCalledTimes(1);
  });

  it('con la propina decidida no hay botón', () => {
    const arbol = aplanar(ResumenDeCobro(base));
    expect(arbol.some((el) => typeof el.props['onClick'] === 'function')).toBe(false);
  });
});

describe('lo recibido y su cambio', () => {
  function recibido(texto: string, alCambiarRecibido = vi.fn(), procesando = false) {
    return { recibido: texto, alCambiarRecibido, totalCentavos: 35_050, procesando };
  }

  it('el campo conserva su placeholder y su id, y no mete más campos', () => {
    const marcado = renderToStaticMarkup(<RecibidoDelCobro {...recibido('')} />);
    expect(marcado.match(/<input/g)).toHaveLength(1);
    expect(marcado).toContain('placeholder="0.00"');
    expect(marcado).toContain('id="cobro-recibido"');
    expect(marcado).toContain('inputMode="decimal"');
  });

  it('sin recibido no hay cambio; con recibido, el cambio es lo que sobra', () => {
    expect(texto(renderToStaticMarkup(<RecibidoDelCobro {...recibido('')} />))).not.toContain(
      'Cambio',
    );
    expect(texto(renderToStaticMarkup(<RecibidoDelCobro {...recibido('500')} />))).toContain(
      'Cambio $149.50',
    );
  });

  it('el cambio va grande y en el color del éxito: el color no le quita el tamaño', () => {
    const marcado = renderToStaticMarkup(<RecibidoDelCobro {...recibido('500')} />);
    expect(marcado).toMatch(/class="[^"]*\btext-3xl\b[^"]*\btext-exito\b[^"]*"/);
  });

  it('nunca enseña un cambio negativo: si no alcanza, $0.00', () => {
    expect(texto(renderToStaticMarkup(<RecibidoDelCobro {...recibido('100')} />))).toContain(
      'Cambio $0.00',
    );
  });

  it('el campo rechaza lo que no es un importe y acepta la coma como punto', () => {
    const alCambiarRecibido = vi.fn();
    const campo = aplanar(RecibidoDelCobro(recibido('', alCambiarRecibido))).find(
      (el) => el.props['id'] === 'cobro-recibido',
    );
    const alEscribir = campo?.props['onChange'] as (e: { target: { value: string } }) => void;
    alEscribir({ target: { value: '12a' } });
    alEscribir({ target: { value: '1.234' } });
    expect(alCambiarRecibido).not.toHaveBeenCalled();
    alEscribir({ target: { value: '12,5' } });
    expect(alCambiarRecibido).toHaveBeenCalledExactlyOnceWith('12.5');
  });

  it('el teclado de la pantalla edita el MISMO texto, y se apaga mientras cobra', () => {
    const alCambiarRecibido = vi.fn();
    const teclado = aplanar(RecibidoDelCobro(recibido('12', alCambiarRecibido, true))).find(
      (el) => typeof el.props['alCambiar'] === 'function',
    );
    expect(teclado?.props['importe']).toBe('12');
    expect(teclado?.props['deshabilitado']).toBe(true);
    (teclado?.props['alCambiar'] as (importe: string) => void)('127');
    expect(alCambiarRecibido).toHaveBeenCalledWith('127');
  });
});
