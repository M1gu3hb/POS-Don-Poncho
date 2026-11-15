import { describe, expect, it } from 'vitest';

import { aplicaLaRevision, revisaElSpooler } from './revision-del-spooler.ts';

/** DP-20 · La revisión del spooler está encendida salvo que el aparato la apague. */
describe('la revisión del spooler de Windows', () => {
  it('encendida por omisión, y sólo `false` la apaga', () => {
    expect(revisaElSpooler({ version: 1, perfil: null })).toBe(true);
    expect(revisaElSpooler({ verificarSpooler: true })).toBe(true);
    expect(revisaElSpooler({ verificarSpooler: false })).toBe(false);
    // Lo que no se entiende no la apaga: apagarla esconde los errores de la impresora.
    expect(revisaElSpooler({ verificarSpooler: 'no' })).toBe(true);
    expect(revisaElSpooler({ verificarSpooler: 0 })).toBe(true);
    expect(revisaElSpooler(null)).toBe(true);
    expect(revisaElSpooler(undefined)).toBe(true);
  });

  it('sólo se ofrece con la impresora instalada en Windows (en crudo)', () => {
    expect(aplicaLaRevision('spooler')).toBe(true);
    for (const otra of ['driver', 'red', 'usb', 'bluetooth', 'serial']) {
      expect(aplicaLaRevision(otra)).toBe(false);
    }
  });
});
