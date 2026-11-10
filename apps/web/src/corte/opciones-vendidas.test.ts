import { describe, expect, it } from 'vitest';

import type { HojaDelServidor } from './hoja.ts';
import { opcionesVendidas, TITULO_DE_OPCIONES } from './opciones-vendidas.ts';

const conOpciones = (opciones: HojaDelServidor['opciones']): HojaDelServidor =>
  ({ opciones }) as unknown as HojaDelServidor;

describe('DP-16 · las opciones vendidas en el corte', () => {
  it('una fila por opción: grupo, opción, veces y lo que sumó o restó', () => {
    const [seccion] = opcionesVendidas(
      conOpciones([
        { grupo: 'Extras', opcion: 'Queso', veces: '12', importeCentavos: '18000' },
        { grupo: 'Extras', opcion: 'Sin crema', veces: '3', importeCentavos: '-1500' },
      ]),
    );
    expect(seccion?.titulo).toBe(TITULO_DE_OPCIONES);
    if (seccion?.tipo !== 'tabla') throw new Error('se esperaba una tabla');
    expect(seccion.columnas.map((c) => c.titulo)).toEqual(['Grupo', 'Opción', 'Veces', 'Sumó']);
    expect(seccion.filas).toEqual([
      [
        { tipo: 'texto', texto: 'Extras' },
        { tipo: 'texto', texto: 'Queso' },
        { tipo: 'texto', texto: '12' },
        { tipo: 'dinero', centavos: 18000 },
      ],
      [
        { tipo: 'texto', texto: 'Extras' },
        { tipo: 'texto', texto: 'Sin crema' },
        { tipo: 'texto', texto: '3' },
        { tipo: 'dinero', centavos: -1500 },
      ],
    ]);
  });

  it('sin opciones (o un servidor que no las manda) no hay sección', () => {
    expect(opcionesVendidas(conOpciones([]))).toEqual([]);
    expect(opcionesVendidas(conOpciones(undefined))).toEqual([]);
  });
});
