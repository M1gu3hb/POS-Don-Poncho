import { AVISO_SIN_FOLIO, PAPEL_POR_OMISION } from '@morphiqpos/domain/venta';
import { describe, expect, it } from 'vitest';

import { avisosDelPapel, papelConCambio, papelLeido } from './papel-a-tu-gusto-formulario.ts';

describe('papelLeido', () => {
  it('sin nada guardado, o con algo dañado, sale todo', () => {
    for (const config of [
      undefined,
      null,
      {},
      { papel_a_tu_gusto: 'x' },
      { papel_a_tu_gusto: [] },
    ]) {
      expect(papelLeido(config)).toEqual(PAPEL_POR_OMISION);
    }
  });

  it('lee lo apagado, sólo en su papel', () => {
    const papel = papelLeido({ papel_a_tu_gusto: { ticket: { telefono: false } } });
    expect(papel.ticket.telefono).toBe(false);
    expect(papel.precuenta.telefono).toBe(true);
    expect(papel.ticket.logo).toBe(true);
  });
});

describe('papelConCambio', () => {
  it('cambia un renglón de un papel sin tocar el original ni el otro papel', () => {
    const antes = papelLeido(undefined);
    const despues = papelConCambio(antes, 'precuenta', 'mesero', false);
    expect(despues.precuenta.mesero).toBe(false);
    expect(despues.ticket.mesero).toBe(true);
    expect(antes.precuenta.mesero).toBe(true);
    expect(papelConCambio(despues, 'precuenta', 'mesero', true)).toEqual(antes);
  });
});

describe('avisosDelPapel', () => {
  it('avisa sólo cuando el ticket de venta se queda sin folio', () => {
    const base = papelLeido(undefined);
    expect(avisosDelPapel(base)).toEqual([]);
    expect(avisosDelPapel(papelConCambio(base, 'precuenta', 'folio', false))).toEqual([]);
    expect(avisosDelPapel(papelConCambio(base, 'ticket', 'folio', false))).toEqual([
      AVISO_SIN_FOLIO,
    ]);
  });
});
