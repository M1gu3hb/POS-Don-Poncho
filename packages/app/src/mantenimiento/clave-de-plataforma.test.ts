import { describe, expect, it } from 'vitest';

import { claveDePlataforma, listaResultante } from './clave-de-plataforma.ts';

/**
 * DP-13.3b · La clave de idempotencia de la marca de plataforma depende del ESTADO, no sólo de
 * quién la pide.
 *
 * `comando()` contesta con la respuesta guardada a toda llamada que repita clave y entrada. La
 * clave de `marcar-plataforma.mjs` era `marcar-plataforma:<org>:<empleo>`: marcar, quitar y volver
 * a marcar repetía la clave de la primera vez, y la tercera llamada devolvía «ya quedó marcado»
 * SIN marcar nada. La lista resultante sola tampoco alcanza: marcar → quitar → marcar da la
 * MISMA lista las dos veces. La versión del documento, que sube con cada escritura, es lo que las
 * distingue.
 */

const ORG = '5b1f0c1e-3a6d-4f51-9f0e-0c7e2d9a1b11';
const UNO = '0b0e8c35-4c35-4b6e-9b46-6a9a3e5d7c11';
const OTRO = '6f4a3d21-9e0c-4f7b-8a55-2d1c0b9e8f77';

const marcar = { accion: 'marcar', organizacionId: ORG, empleoId: UNO, antes: [] } as const;

describe('la lista que resulta', () => {
  it('marcar agrega sin duplicar y sin depender del orden', () => {
    expect(listaResultante({ ...marcar, antes: [OTRO] })).toEqual([UNO, OTRO].sort());
    expect(listaResultante({ ...marcar, antes: [UNO, OTRO] })).toEqual([UNO, OTRO].sort());
  });

  it('quitar saca al empleo, y reemplazar pone al otro', () => {
    const quitar = { accion: 'quitar', organizacionId: ORG, empleoId: UNO } as const;
    expect(listaResultante({ ...quitar, antes: [UNO, OTRO] })).toEqual([OTRO]);
    expect(listaResultante({ ...quitar, antes: [UNO], reemplazarPor: OTRO })).toEqual([OTRO]);
    expect(listaResultante({ ...quitar, antes: [UNO, OTRO], reemplazarPor: OTRO })).toEqual([OTRO]);
  });
});

describe('claveDePlataforma', () => {
  it('es la misma para el mismo estado: reintentar la misma petición sigue siendo idempotente', () => {
    expect(claveDePlataforma({ ...marcar, version: 3 })).toBe(
      claveDePlataforma({ ...marcar, version: 3 }),
    );
  });

  it('marcar → quitar → marcar: la lista resultante se repite y la clave NO', () => {
    const primera = { ...marcar, version: 1 };
    const tercera = { ...marcar, version: 3 };
    expect(listaResultante(primera)).toEqual(listaResultante(tercera));
    expect(claveDePlataforma(tercera)).not.toBe(claveDePlataforma(primera));
  });

  it('cambia con la lista resultante, con la acción, con el empleo y con el negocio', () => {
    const base = claveDePlataforma({ ...marcar, version: 1 });
    expect(claveDePlataforma({ ...marcar, antes: [OTRO], version: 1 })).not.toBe(base);
    expect(
      claveDePlataforma({
        accion: 'quitar',
        organizacionId: ORG,
        empleoId: UNO,
        antes: [],
        version: 1,
      }),
    ).not.toBe(base);
    expect(claveDePlataforma({ ...marcar, empleoId: OTRO, version: 1 })).not.toBe(base);
    expect(claveDePlataforma({ ...marcar, organizacionId: UNO, version: 1 })).not.toBe(base);
  });

  it('cabe en lo que la base acepta (8 a 200) y no lleva más que ids y hashes', () => {
    const clave = claveDePlataforma({ ...marcar, antes: [OTRO], version: 123456 });
    expect(clave.length).toBeGreaterThanOrEqual(8);
    expect(clave.length).toBeLessThanOrEqual(200);
    expect(clave).toMatch(/^plataforma:marcar:[0-9a-f-]{36}:[0-9a-f-]{36}:[0-9a-f]{12}:v123456$/);
  });
});
