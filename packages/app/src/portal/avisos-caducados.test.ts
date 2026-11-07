import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * DP-14 · ronda 2, medio 9 · RESOLVER LOS AVISOS CADUCADOS NO TUMBA EL MAPA DEL MESERO.
 *
 * Se llama en cada lectura de los avisos del mapa (`puente/consultar.ts`). Si la transacción de una
 * mesa falla (un candado que no llega, la base que se cae un instante), se registra y se sigue con
 * las demás: la lectura de los avisos no puede fallar por esto.
 */

const filasDeMesas = [{ mesa_id: 'mesa-1' }, { mesa_id: 'mesa-2' }];
const conTransaccion = vi.fn<() => Promise<boolean>>();

/** Un constructor de consultas falso: cada método se devuelve a sí mismo y `execute` da las mesas. */
function constructor(): unknown {
  const falso: Record<string, unknown> = {};
  return new Proxy(falso, {
    get: (_obj, prop) =>
      prop === 'execute' ? () => Promise.resolve(filasDeMesas) : () => constructor(),
  });
}

vi.mock('@morphiqpos/data', () => ({
  obtenerDb: () => constructor(),
  conTransaccion: () => conTransaccion(),
}));
vi.mock('server-only', () => ({}));

afterEach(() => {
  vi.restoreAllMocks();
  conTransaccion.mockReset();
});

describe('resolverLosAvisosCaducados', () => {
  it('si una mesa falla, lo registra y sigue con la otra; no lanza', async () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    conTransaccion.mockRejectedValueOnce(new Error('se cayó la base')).mockResolvedValueOnce(true);
    const { resolverLosAvisosCaducados } = await import('./avisos-caducados.ts');
    await expect(resolverLosAvisosCaducados('org-1')).resolves.toBe(1);
    expect(conTransaccion).toHaveBeenCalledTimes(2);
    expect(consola).toHaveBeenCalledTimes(1);
    expect(String(consola.mock.calls[0]?.[0])).toMatch(/portal\.avisos_caducados/);
  });
});
