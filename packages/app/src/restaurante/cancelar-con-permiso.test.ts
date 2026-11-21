import { ErrorDominio, type Rol } from '@morphiqpos/contracts';
import { describe, expect, it, vi } from 'vitest';

import { Rechazo } from '../fallos.ts';
import { exigirPermisoParaCancelar } from './cancelar-con-permiso.ts';

/**
 * DP-24 · Parte 2 · LA REGLA DE QUIÉN QUITA LO YA ENVIADO Y QUIÉN CANCELA, sin base de datos.
 *
 * Es la defensa de dominio, aparte de los roles que declaran los comandos: aunque alguien agregue
 * al mesero a la lista de un comando, esta regla lo sigue rechazando. La del servidor completo,
 * con la base y la auditoría, está en `quien-quita-y-cancela.integracion.test.ts`.
 */

vi.mock('@morphiqpos/contracts', async (original) => ({
  ...(await original<typeof import('@morphiqpos/contracts')>()),
  validarEntorno: () => ({ SESSION_SECRET: 'secreto_de_la_prueba_unitaria_de_cancelar_2026' }),
}));

const ahora = new Date('2026-11-20T18:00:00.000Z');
const como = (rol: Rol) => ({
  ahora,
  ambito: { organizacionId: 'org', empleoId: 'emp', rol },
});
const ORDEN = '11111111-1111-4111-8111-111111111111';

describe('exigirPermisoParaCancelar', () => {
  it.each(['mesero', 'cocina', 'almacen'] as const)(
    '%s: SIN_PERMISO, aunque traiga una autorización',
    (rol) => {
      for (const autorizacion of [undefined, 'x'.repeat(40)]) {
        expect(() => exigirPermisoParaCancelar(como(rol), ORDEN, autorizacion)).toThrow(Rechazo);
        try {
          exigirPermisoParaCancelar(como(rol), ORDEN, autorizacion);
        } catch (fallo) {
          expect((fallo as Rechazo).codigo).toBe('SIN_PERMISO');
        }
      }
    },
  );

  it('la caja sin autorización: pide el PIN de un gerente (PUESTO_NO_OTORGABLE, pidePin)', () => {
    try {
      exigirPermisoParaCancelar(como('cajero'), ORDEN, undefined);
      expect.unreachable('la caja cancelaba sin PIN');
    } catch (fallo) {
      expect(fallo).toBeInstanceOf(ErrorDominio);
      expect((fallo as ErrorDominio).codigo).toBe('PUESTO_NO_OTORGABLE');
      expect((fallo as ErrorDominio).detalles).toMatchObject({ pidePin: true });
    }
  });

  it('la caja con una autorización que no es auténtica: también pide el PIN', () => {
    expect(() => exigirPermisoParaCancelar(como('cajero'), ORDEN, 'x'.repeat(40))).toThrow(
      ErrorDominio,
    );
  });

  it.each(['gerente', 'administrador', 'dueno'] as const)(
    '%s: autoriza por su puesto, sin PIN, y no queda nadie como «autorizó»',
    (rol) => {
      expect(exigirPermisoParaCancelar(como(rol), ORDEN, undefined)).toBeNull();
    },
  );
});
