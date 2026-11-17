import { describe, expect, it } from 'vitest';

import {
  ROLES_QUE_PAGAN_DEL_CAJON,
  ROLES_QUE_REGISTRAN_COMPRAS,
  puedePagarDelCajon,
} from './quien-paga-del-cajon.ts';

/** A5 · El almacén registra compras; pagarlas del cajón es de quien lleva la caja. */
describe('quién registra compras y quién las paga del cajón', () => {
  it('el almacén registra compras, pero no las paga del cajón', () => {
    expect(ROLES_QUE_REGISTRAN_COMPRAS).toContain('almacen');
    expect(puedePagarDelCajon('almacen')).toBe(false);
  });

  it('quien paga del cajón siempre puede registrar compras', () => {
    for (const rol of ROLES_QUE_PAGAN_DEL_CAJON) {
      expect(ROLES_QUE_REGISTRAN_COMPRAS).toContain(rol);
    }
  });

  it('mesero, cocina y cajero no registran ni pagan', () => {
    for (const rol of ['mesero', 'cocina', 'cajero'] as const) {
      expect(ROLES_QUE_REGISTRAN_COMPRAS as readonly string[]).not.toContain(rol);
      expect(puedePagarDelCajon(rol)).toBe(false);
    }
  });
});
