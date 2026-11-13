import { ErrorDominio } from '@morphiqpos/contracts';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { crearComando, definirComando } from './comando.ts';
import { ambitoDeCajero, crearFabrica, type TxFalsa } from './pruebas/dobles.ts';

/**
 * A12 (DP-18): un interbloqueo de Postgres salía como ERROR_INTERNO (500).
 *
 * En la jornada simulada, la estación tocó «Preparar» mientras el mesero quitaba un platillo de la
 * MISMA orden: una transacción toma los renglones de cocina y luego las líneas de venta, la otra al
 * revés, y Postgres aborta una con 40P01. La que pierde no dejó nada (se revirtió entera, con su clave
 * de idempotencia y su auditoría), así que repetirla es el remedio estándar y es seguro: ningún
 * comando hace nada fuera de su transacción. Aquí se prueba el envoltorio; que el reintento resuelva
 * el cruce real lo dice la jornada simulada.
 */

const CLAVE = 'clave-de-idempotencia-0001';
const ENTRADA = { ordenId: '66666666-6666-4666-8666-666666666666' };

const BASE = {
  nombre: 'restaurante.transicionar_pedido',
  entidad: 'comanda',
  escribe: true,
  roles: ['cajero'],
  paquetes: ['tienda'],
  entrada: z.object({ ordenId: z.uuid() }),
} as const;

/** Un error como los que lanza `pg`: con su SQLSTATE en `code`. */
const deLaBase = (codigo: string): Error =>
  Object.assign(new Error('error de la base'), { code: codigo });

/**
 * Corre un comando que falla las primeras `veces` con `error` y luego confirma. La definición se
 * arma en la llamada, como en `comando.transaccion.test.ts`, para que TypeScript la infiera.
 */
async function fallaPrimero(veces: number, error: () => Error) {
  const llamadas = { n: 0 };
  const fabrica = crearFabrica('tienda');
  const salida = await crearComando<TxFalsa>(fabrica)(
    definirComando({
      ...BASE,
      async ejecutar(ctx, entrada) {
        llamadas.n += 1;
        if (llamadas.n <= veces) throw error();
        ctx.auditar({ entidadId: entrada.ordenId, payload: {} });
        return { intento: llamadas.n };
      },
    }),
    { entrada: ENTRADA, ambito: ambitoDeCajero(), idempotencyKey: CLAVE },
  );
  return { fabrica, salida, llamadas };
}

describe('comando() · conflictos de concurrencia de Postgres', () => {
  it('un interbloqueo (40P01) se repite y el comando confirma', async () => {
    const { fabrica, salida, llamadas } = await fallaPrimero(1, () => deLaBase('40P01'));

    expect(salida.ok).toBe(true);
    expect(llamadas.n).toBe(2);
    expect(fabrica.base.transacciones.filter((t) => t.confirmada)).toHaveLength(1);
    expect(fabrica.base.transacciones.filter((t) => !t.confirmada)).toHaveLength(1);
  });

  it('un conflicto de serialización (40001) también se repite', async () => {
    const { salida, llamadas } = await fallaPrimero(1, () => deLaBase('40001'));

    expect(salida.ok).toBe(true);
    expect(llamadas.n).toBe(2);
  });

  it('si el conflicto sigue, se rinde al tercer intento con ERROR_INTERNO', async () => {
    const { salida, llamadas } = await fallaPrimero(99, () => deLaBase('40P01'));

    expect(llamadas.n).toBe(3);
    expect(salida.ok).toBe(false);
    if (!salida.ok) expect(salida.error.codigo).toBe('ERROR_INTERNO');
  });

  it('otro error de la base no se repite', async () => {
    const { salida, llamadas } = await fallaPrimero(99, () => deLaBase('23505'));

    expect(llamadas.n).toBe(1);
    expect(salida.ok).toBe(false);
  });

  it('una regla de negocio no se repite', async () => {
    const { salida, llamadas } = await fallaPrimero(
      99,
      () => new ErrorDominio('TRANSICION_INVALIDA', 'Ese pedido cambió de estado.', {}),
    );

    expect(llamadas.n).toBe(1);
    expect(salida.ok).toBe(false);
    if (!salida.ok) expect(salida.error.codigo).toBe('REGLA_DE_NEGOCIO');
  });
});
