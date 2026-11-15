import { describe, expect, it } from 'vitest';

import { leerElEstado, SIN_ESTADO } from './estado-de-la-impresora.ts';

describe('DP-20 · el estado de la impresora, dicho para una persona', () => {
  it('lista: en línea, con papel, tapa cerrada', () => {
    const estado = leerElEstado({
      soportado: true,
      enLinea: true,
      sinPapel: false,
      tapaAbierta: false,
    });
    expect(estado.resumen).toBe('Impresora lista ✓');
    expect(estado.sinProblemas).toBe(true);
    expect(estado.renglones.map((r) => `${r.etiqueta}: ${r.valor}`)).toEqual([
      'En línea: Sí',
      'Papel: Con papel',
      'Tapa: Cerrada',
    ]);
  });

  it('sin papel manda sobre todo lo demás', () => {
    const estado = leerElEstado({
      soportado: true,
      enLinea: false,
      sinPapel: true,
      tapaAbierta: true,
    });
    expect(estado.resumen).toBe('La impresora está sin papel');
    expect(estado.sinProblemas).toBe(false);
  });

  it('tapa abierta y fuera de línea se dicen cada uno', () => {
    expect(leerElEstado({ soportado: true, tapaAbierta: true }).resumen).toBe(
      'La impresora tiene la tapa abierta',
    );
    expect(leerElEstado({ soportado: true, enLinea: false }).resumen).toBe(
      'La impresora está fuera de línea',
    );
  });

  it('el cajón abierto es un dato, no un problema', () => {
    const estado = leerElEstado({ soportado: true, cajonAbierto: true });
    expect(estado.renglones).toEqual([{ etiqueta: 'Cajón', valor: 'Abierto', bien: null }]);
    expect(estado.sinProblemas).toBe(true);
  });

  it('si la conexión no lo soporta, dice su mensaje', () => {
    expect(leerElEstado({ soportado: false, mensaje: 'La red no contesta estados.' })).toEqual({
      soportado: false,
      sinProblemas: false,
      resumen: 'La red no contesta estados.',
      renglones: [],
    });
  });

  it('si no soporta y no dice por qué, usa la frase de siempre', () => {
    expect(leerElEstado({ soportado: false }).resumen).toBe(SIN_ESTADO);
    expect(leerElEstado({ soportado: false, mensaje: '  ' }).resumen).toBe(SIN_ESTADO);
  });
});
