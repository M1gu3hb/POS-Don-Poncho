import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { ErrorPuente } from '../../../heredado/api/cliente';

import { liberarTrasCobrar, mesaParaLiberarTrasCobrar } from './liberar-tras-cobrar';

/**
 * DP-17 (QA de DP-16, R5) · AL COBRAR LA ÚLTIMA PARTE DE UNA CUENTA DIVIDIDA SE LIBERA LA MESA.
 *
 * Una parte nace sin mesa (`division.ts`): la Caja no intentaba liberar nada al cobrarla, y las
 * mesas (unidas o no) se quedaban en «Limpieza» hasta el cierre. Ahora, tras cobrar una parte, se
 * libera la mesa de su cuenta madre: si aún faltan partes, el servidor lo dice
 * (`MESA_NO_LIBERABLE` con `partesSinCobrar`) y no pasa nada; con la última, si las mesas están
 * unidas, sale la pregunta de siempre («¿Separar o dejarlas unidas?»).
 */

const faltanPartes = (n: number) =>
  new ErrorPuente('REGLA_DE_NEGOCIO', 'sin cobrar', 422, {
    regla: 'MESA_NO_LIBERABLE',
    partesSinCobrar: n,
  });

describe('la mesa que se libera tras cobrar', () => {
  it('la de la venta, si la tiene', async () => {
    const leerMadre = vi.fn();
    expect(await mesaParaLiberarTrasCobrar({ mesa_id: 'm-4' }, leerMadre)).toBe('m-4');
    expect(leerMadre).not.toHaveBeenCalled();
  });

  it('una parte sin mesa: la de su cuenta madre', async () => {
    const leerMadre = vi.fn().mockResolvedValue({ mesa_id: 'm-9' });
    expect(
      await mesaParaLiberarTrasCobrar({ mesa_id: null, orden_padre_id: 'madre' }, leerMadre),
    ).toBe('m-9');
    expect(leerMadre).toHaveBeenCalledWith('madre');
  });

  it('sin mesa ni madre (mostrador, para llevar): ninguna', async () => {
    expect(await mesaParaLiberarTrasCobrar({ mesa_id: null }, vi.fn())).toBeNull();
  });
});

describe('liberar tras cobrar', () => {
  it('si aún faltan partes por cobrar, no pasa nada y no se avisa', async () => {
    const ejecutar = vi.fn().mockRejectedValue(faltanPartes(1));
    const preguntar = vi.fn();
    expect(await liberarTrasCobrar('m-9', ejecutar, preguntar)).toBe('faltan-partes');
    expect(preguntar).not.toHaveBeenCalled();
  });

  it('con la última parte, la mesa unida pregunta y se libera con la decisión', async () => {
    const llamadas: unknown[] = [];
    const ejecutar = vi.fn((entrada: { mesaId: string; grupo?: string }) => {
      llamadas.push(entrada);
      return entrada.grupo === undefined
        ? Promise.reject(
            new ErrorPuente('REGLA_DE_NEGOCIO', 'unida', 422, { regla: 'MESA_UNIDA_SIN_DECISION' }),
          )
        : Promise.resolve();
    });
    expect(await liberarTrasCobrar('m-9', ejecutar, () => Promise.resolve('separar'))).toBe(
      'liberada',
    );
    expect(llamadas).toEqual([{ mesaId: 'm-9' }, { mesaId: 'm-9', grupo: 'separar' }]);
  });

  it('«no liberable» SIN partes pendientes (una cuenta sin cobrar de verdad) sí se avisa', async () => {
    for (const datos of [
      { regla: 'MESA_NO_LIBERABLE' },
      { regla: 'MESA_NO_LIBERABLE', partesSinCobrar: 0 },
    ]) {
      const ejecutar = vi
        .fn()
        .mockRejectedValue(new ErrorPuente('REGLA_DE_NEGOCIO', 'sin cobrar', 422, datos));
      await expect(liberarTrasCobrar('m-9', ejecutar, vi.fn())).rejects.toThrow('sin cobrar');
    }
  });

  it('QA R3 · una PARTE: «no liberable» es que faltan las otras (el servidor no manda cuántas)', async () => {
    // Al cliente sólo llega la regla (`comando.ts`): `partesSinCobrar` se queda en el servidor.
    const ejecutar = vi
      .fn()
      .mockRejectedValue(
        new ErrorPuente('REGLA_DE_NEGOCIO', 'sin cobrar', 422, { regla: 'MESA_NO_LIBERABLE' }),
      );
    expect(await liberarTrasCobrar('m-9', ejecutar, vi.fn(), true)).toBe('faltan-partes');
  });

  it('otro error sí se avisa (la venta ya está cobrada, la mesa no)', async () => {
    const ejecutar = vi.fn().mockRejectedValue(new ErrorPuente('ERROR_INTERNO', 'x', 500));
    await expect(liberarTrasCobrar('m-9', ejecutar, vi.fn())).rejects.toThrow('x');
  });
});

describe('la Caja lo usa al cobrar', () => {
  const RAIZ_WEB = process.cwd().endsWith('web')
    ? process.cwd()
    : join(process.cwd(), 'apps', 'web');
  const c = readFileSync(join(RAIZ_WEB, 'heredado/pages/Caja.jsx'), 'utf8')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+/g, '');

  it('busca la mesa de la parte en su cuenta madre y la libera con la pregunta', () => {
    expect(c).toContain('constmesaALiberar=awaitmesaParaLiberarTrasCobrar(ventaSeleccionada,');
    expect(c).toContain('if(mesaALiberar){');
    expect(c).toContain('awaitliberarTrasCobrar(mesaALiberar,');
    expect(c).toContain('Boolean(ventaSeleccionada.orden_padre_id),');
  });
});
