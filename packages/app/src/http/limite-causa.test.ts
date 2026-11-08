import { repoLimite } from '@morphiqpos/data';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { permitirPortal } from '../portal/limite.ts';
import { permitir } from './limite.ts';

/**
 * DP-15 · LA ALERTA DEL LIMITADOR DICE LA CAUSA.
 *
 * En producción (base propia, pooler de transacción) el limitador avisó «No se pudo contar el
 * intento de …» y el carrito del portal falló, sin decir por qué: el `catch` tragaba el error. La
 * alerta lleva ahora la clase del error y su código (SQLSTATE o el del socket), que no contienen
 * datos de entrada, como el registro de los comandos.
 */

vi.mock('@morphiqpos/data', async () => {
  const original = await vi.importActual<typeof import('@morphiqpos/data')>('@morphiqpos/data');
  return { ...original, repoLimite: { contarIntento: vi.fn(), devolverIntento: vi.fn() } };
});

const sinCabeceras = { get: () => null };
let escrito: string[] = [];
const escuchar = (): void => {
  escrito = [];
  vi.spyOn(console, 'error').mockImplementation((linea: unknown) => {
    escrito.push(String(linea));
  });
};
const lineas = (): string[] => escrito;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('la causa en la alerta del limitador', () => {
  it('el del personal: la clase y el código', async () => {
    escuchar();
    vi.mocked(repoLimite.contarIntento).mockRejectedValueOnce(
      Object.assign(new Error('se cayó'), { code: 'ECONNRESET' }),
    );
    const permiso = await permitir('empleados', sinCabeceras, 'pimienta');
    expect(permiso.ok).toBe(true);
    expect(lineas().join('\n')).toContain(
      'No se pudo contar el intento de empleados. causa=Error sqlstate=ECONNRESET',
    );
  });

  it('el del portal: la clase y el código, sin el mensaje del error', async () => {
    escuchar();
    vi.mocked(repoLimite.contarIntento).mockRejectedValueOnce(
      Object.assign(new Error('valor secreto'), { code: '40P01' }),
    );
    await permitirPortal('consulta', 'token', 'pimienta');
    const todo = lineas().join('\n');
    expect(todo).toContain('No se pudo contar el intento de consulta. causa=Error sqlstate=40P01');
    expect(todo).not.toContain('valor secreto');
  });
});
