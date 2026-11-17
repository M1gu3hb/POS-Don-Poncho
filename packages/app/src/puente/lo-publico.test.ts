import { describe, expect, it } from 'vitest';

import { banderasDe } from '../portal/banderas.ts';
import { negocioPublico } from '../portal/lista-blanca.ts';
import { CONFIG_POR_OMISION, PUBLICOS, recortarALoPublico } from './configuracion.ts';

/**
 * La lectura pública de la configuración trae SÓLO lo que el portal del comensal lee.
 *
 * Su único consumidor sin sesión es `negocioPublico` (portal/lista-blanca.ts). Lo que éste
 * no lee no tiene por qué viajar: cada clave de más es una que alguien podría llegar a
 * enseñar por descuido.
 */

/** Las claves que `negocioPublico` le pide a la configuración pública, mirando qué toca. */
function clavesQueLeeElPortal(): readonly string[] {
  const leidas = new Set<string>();
  const espia = new Proxy<Record<string, unknown>>(
    {},
    {
      get(_objetivo, clave) {
        if (typeof clave === 'string') leidas.add(clave);
        return '';
      },
    },
  );
  negocioPublico(espia, banderasDe({}), true);
  return [...leidas].sort();
}

const COMPLETA: Record<string, unknown> = {
  ...CONFIG_POR_OMISION,
  id: 'cfg-1',
  presentacion_password: 'no-sale',
  nombre_negocio: 'Cantina La Mezcalera',
};

describe('la lista pública es exactamente lo que el portal lee', () => {
  it('cada clave de PUBLICOS es una que negocioPublico lee, y no queda ninguna sin leer', () => {
    expect([...PUBLICOS].sort()).toEqual(clavesQueLeeElPortal());
  });

  it('son tres: el nombre y los dos logos', () => {
    expect([...PUBLICOS].sort()).toEqual(['background_logo_url', 'logo_url', 'nombre_negocio']);
  });
});

describe('el recorte de la lectura pública', () => {
  it('trae las claves de PUBLICOS y ninguna otra (ni colores, ni moneda, ni id)', () => {
    const recortada = recortarALoPublico(COMPLETA);
    expect(Object.keys(recortada).sort()).toEqual([...PUBLICOS].sort());
    expect(recortada['nombre_negocio']).toBe('Cantina La Mezcalera');
    for (const fuera of ['color_primario', 'moneda', 'usa_mesas', 'mensaje_ticket', 'id']) {
      expect(fuera in recortada, fuera).toBe(false);
    }
  });

  it('una clave de PUBLICOS que la lectura no trae sale vacía, no ausente', () => {
    const recortada = recortarALoPublico({ nombre_negocio: 'X' });
    expect(Object.keys(recortada).sort()).toEqual([...PUBLICOS].sort());
    expect(recortada['logo_url']).toBeUndefined();
  });
});
