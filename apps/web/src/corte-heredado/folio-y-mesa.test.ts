import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { folioDelCorte, folioDeLaVenta, mesaDeLaVenta } from './folio-y-mesa.ts';

/**
 * DP-17 (QA de DP-16, H4) · EL VISOR DE REGISTROS ESCRIBE EL FOLIO Y LA MESA COMO EL DOCUMENTO.
 *
 * El documento al cerrar dice «Folio: CC-2», tickets «A-3» y «Mesa 4» (la serie la pone el
 * servidor: `o.serie || '-' || o.folio`, y la mesa `'Mesa ' || m.numero`); el visor de Registros
 * del mismo corte decía «Folio: 2», «3» y «4». El mismo papel visto desde dos lados tiene que decir
 * lo mismo.
 */

describe('el folio y la mesa, como en el documento al cerrar', () => {
  it('el folio de la venta lleva su serie', () => {
    expect(folioDeLaVenta({ serie: 'A', folio: '3' })).toBe('A-3');
  });

  it('sin serie (un registro viejo) queda el número; sin folio, la raya', () => {
    expect(folioDeLaVenta({ folio: '3' })).toBe('3');
    expect(folioDeLaVenta({ serie: 'A', folio: null })).toBe('—');
  });

  it('el folio del corte lleva su serie («CC-2»), o «sin folio»', () => {
    expect(folioDelCorte({ serie: 'CC', folio: '2' })).toBe('CC-2');
    expect(folioDelCorte({ folio: '2' })).toBe('2');
    expect(folioDelCorte({ serie: 'CC', folio: null })).toBe('sin folio');
  });

  it('la mesa dice «Mesa N» (o su nombre si lo tiene); sin mesa, nada', () => {
    expect(mesaDeLaVenta({ mesa_numero: 4 })).toBe('Mesa 4');
    expect(mesaDeLaVenta({ mesa_numero: 4, mesa_nombre: 'Terraza' })).toBe('Terraza');
    expect(mesaDeLaVenta({ mesa_numero: null })).toBeNull();
  });
});

describe('el visor los usa', () => {
  const RAIZ_WEB = process.cwd().endsWith('web')
    ? process.cwd()
    : join(process.cwd(), 'apps', 'web');
  const c = readFileSync(join(RAIZ_WEB, 'heredado/components/tickets/CorteTicket.jsx'), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+/g, '');

  it('en la cabecera, el folio del corte con su serie', () => {
    expect(c).toContain('{folioDelCorte(corte??{})}');
  });

  it('en el detalle de ventas, el folio con serie y «Mesa N»', () => {
    expect(c).toContain('{folioDeLaVenta(v)}');
    // QA R3: una parte no tiene mesa y su nombre ya la dice («Mesa 9 · cuenta 1 de 2»): sin «— · ».
    expect(c).toContain("[mesaDeLaVenta(v),v.cliente_nombre].filter(Boolean).join('·')||'—'");
    expect(c).not.toContain("{mesaDeLaVenta(v)??'—'}");
  });
});
