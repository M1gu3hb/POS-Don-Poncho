import { describe, expect, it } from 'vitest';

import {
  AVISOS_A_LA_VISTA,
  avisosSegunLaVentana,
  avisosPendientes,
  fraseDelAviso,
  fraseHablada,
  platillosEnPalabras,
  platillosNuevos,
  quitadosVigentes,
  repartirAvisos,
  type AvisoDeListo,
  type PlatilloDelAviso,
} from './avisos-de-listo.ts';

/**
 * DP-24 · 4.3 · El aviso de «listo»: el texto grande, lo que ya se quitó y lo que suena.
 */

const plato = (
  id: string,
  nombre: string,
  cantidad = '1',
  parche: Partial<PlatilloDelAviso> = {},
): PlatilloDelAviso => ({ id, nombre, cantidad, tipoVenta: null, unidadVariable: null, ...parche });

const aviso = (
  comandaId: string,
  platillos: readonly PlatilloDelAviso[],
  parche: Partial<AvisoDeListo> = {},
): AvisoDeListo => ({
  comandaId,
  ordenId: 'o1',
  mesaId: 'm5',
  mesaNumero: 5,
  estacionNombre: 'Cantina',
  estacionColor: '#0891b2',
  listoEn: '2026-11-20T19:30:00.000Z',
  platillos,
  ...parche,
});

describe('el texto del aviso', () => {
  it('«Mesa 5 · Listo en Cantina: 2 Coca cola, 1 Jugo · Recoger en Cantina»', () => {
    const a = aviso('c1', [plato('1', 'Coca cola', '2.0000'), plato('2', 'Jugo')]);
    expect(fraseDelAviso(a)).toBe(
      'Mesa 5 · Listo en Cantina: 2 Coca cola, 1 Jugo · Recoger en Cantina',
    );
  });

  it('suma por nombre lo que salió junto y respeta el orden', () => {
    expect(
      platillosEnPalabras([
        plato('1', 'Coca cola'),
        plato('2', 'Jugo'),
        plato('3', 'Coca cola', '2'),
      ]),
    ).toBe('3 Coca cola, 1 Jugo');
  });

  it('DP-25 · 3.2 · lleva las opciones de cada platillo: «1 Cerveza (Michelado), 1 Cerveza»', () => {
    const a = aviso('c1', [
      plato('1', 'Cerveza', '1', { opciones: ['Michelado'] }),
      plato('2', 'Cerveza'),
      plato('3', 'Cerveza', '1', { opciones: ['Michelado'] }),
    ]);
    expect(platillosEnPalabras(a.platillos)).toBe('2 Cerveza (Michelado), 1 Cerveza');
    expect(fraseHablada(a)).toContain('2 Cerveza (Michelado), 1 Cerveza');
  });

  it('usa el nombre REAL de la estación y «Cocina» sólo si no tiene', () => {
    expect(
      fraseDelAviso(aviso('c', [plato('1', 'Taco')], { estacionNombre: 'Barra de mezcal' })),
    ).toContain('Listo en Barra de mezcal');
    expect(fraseDelAviso(aviso('c', [plato('1', 'Taco')], { estacionNombre: null }))).toContain(
      'Recoger en Cocina',
    );
  });

  it('lo que va por peso se dice con su peso', () => {
    const peso = plato('1', 'Barbacoa', '0.5', {
      tipoVenta: 'variable_medida',
      unidadVariable: 'kg',
    });
    expect(platillosEnPalabras([peso])).toBe('½ kg Barbacoa');
  });

  it('la voz no lleva símbolos y puede decir el nombre del mesero', () => {
    const a = aviso('c1', [plato('1', 'Jugo')]);
    expect(fraseHablada(a)).toBe('Mesa 5, listo en Cantina: 1 Jugo. Recoger en Cantina.');
    expect(fraseHablada(a, 'Ana')).toMatch(/^Ana, Mesa 5/);
  });
});

describe('lo que el mesero ya quitó', () => {
  const avisos = [
    aviso('c1', [plato('1', 'Jugo'), plato('2', 'Coca cola')]),
    aviso('c2', [plato('3', 'Taco')]),
  ];

  it('sólo se quitan los platillos que ya vio; un aviso sin platillos se va', () => {
    const p = avisosPendientes(avisos, new Set(['1', '3']));
    expect(p).toHaveLength(1);
    expect(p[0]?.platillos.map((x) => x.id)).toEqual(['2']);
  });

  it('un platillo que sale después vuelve a avisar en la misma comanda, sólo él', () => {
    const despues = [aviso('c1', [plato('1', 'Jugo'), plato('9', 'Agua')])];
    const p = avisosPendientes(despues, new Set(['1']));
    expect(p[0]?.platillos.map((x) => x.id)).toEqual(['9']);
  });

  it('lo entregado (que el servidor ya no trae) se olvida; lo vigente se recuerda', () => {
    expect([...quitadosVigentes(new Set(['1', '77']), avisos)]).toEqual(['1']);
  });

  it('nada se pierde en silencio: lo que no se quitó sigue pendiente', () => {
    expect(avisosPendientes(avisos, new Set())).toHaveLength(2);
  });
});

describe('qué suena', () => {
  const pendientes = [aviso('c1', [plato('1', 'Jugo'), plato('2', 'Coca cola')])];

  it('la primera lectura avisa de todo lo pendiente (es comida que espera), una sola vez', () => {
    expect(platillosNuevos(pendientes, null)).toEqual(['1', '2']);
  });

  it('después sólo suena lo que llegó nuevo', () => {
    expect(platillosNuevos(pendientes, new Set(['1']))).toEqual(['2']);
    expect(platillosNuevos(pendientes, new Set(['1', '2']))).toEqual([]);
  });
});

describe('apilar', () => {
  it('tres a la vista y el resto contado, nunca escondido', () => {
    const muchos = Array.from({ length: 5 }, (_, i) =>
      aviso(`c${String(i)}`, [plato(String(i), 'Taco')]),
    );
    const { visibles, ocultos } = repartirAvisos(muchos);
    expect(visibles).toHaveLength(AVISOS_A_LA_VISTA);
    expect(ocultos).toHaveLength(2);
    expect([...visibles, ...ocultos]).toEqual(muchos);
  });
});

describe('con una ventana abierta', () => {
  const m5 = aviso('c5', [plato('1', 'Jugo')], { mesaNumero: 5 });
  const m7 = aviso('c7', [plato('2', 'Taco')], { mesaNumero: 7 });

  it('sin ventana se pintan todos completos', () => {
    expect(avisosSegunLaVentana([m5, m7], { abierta: false, mesaNumero: null })).toEqual({
      completos: [m5, m7],
      enPastilla: [],
    });
  });

  it('con la mesa 5 abierta, su aviso no se pinta y el de la 7 baja a la pastilla sin tarjeta encima', () => {
    expect(avisosSegunLaVentana([m5, m7], { abierta: true, mesaNumero: 5 })).toEqual({
      completos: [],
      enPastilla: [m7],
    });
  });

  it('con otra ventana (sin mesa) abierta, ninguna tarjeta completa', () => {
    const r = avisosSegunLaVentana([m5, m7], { abierta: true, mesaNumero: null });
    expect(r.completos).toEqual([]);
    expect(r.enPastilla).toHaveLength(2);
  });
});
