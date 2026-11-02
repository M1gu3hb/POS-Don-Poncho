import { obtenerDb } from '@morphiqpos/data';
import { describe, expect, it } from 'vitest';

import { permitirElSondeo } from './carrito-http.ts';
import { SEGUNDOS_ENTRE_LATIDOS } from './carrito.ts';
import { huellaDelDispositivo } from './carrito.ts';
import { mesaConPortal, PIMIENTA, TELEFONO_A } from './pruebas/mesa-con-portal.ts';

/**
 * DP-12.2 · UNA MESA CON DOCE TELÉFONOS, contra Postgres real. Con el límite por mesa (240 al
 * minuto) y cada teléfono sondeando cada 2.5 s, desde el décimo el carrito se cortaba a todos.
 * Ahora el límite es por teléfono, y el latido se escribe a lo mucho cada 30 s.
 */

const telefono = (i: number) => `telefono${String(i).padStart(2, '0')}_0123456789abcdef`;

describe('doce teléfonos en la misma mesa (DP-12.2)', () => {
  it('un minuto de sondeo de los doce (24 cada uno) pasa entero; el 61 de uno solo, no', async () => {
    const caso = await mesaConPortal();
    const contexto = { correlationId: 'prueba', organizacionId: caso.negocio.organizacionId };
    const permisos = await Promise.all(
      Array.from({ length: 12 }, async (_, i) => {
        const vistos = [];
        for (let n = 0; n < 24; n++) {
          vistos.push(await permitirElSondeo(caso.qrToken, telefono(i), PIMIENTA, contexto));
        }
        return vistos;
      }),
    );
    expect(permisos.flat().every((p) => p.ok)).toBe(true);
    expect(permisos.flat()).toHaveLength(288);

    let ultimo = { ok: true, esperaSegundos: 0 };
    for (let n = 0; n < 37; n++) {
      ultimo = await permitirElSondeo(caso.qrToken, telefono(0), PIMIENTA, contexto);
    }
    expect(ultimo.ok).toBe(false);
    // Y los demás teléfonos de la mesa siguen.
    expect((await permitirElSondeo(caso.qrToken, telefono(1), PIMIENTA, contexto)).ok).toBe(true);
  });

  it('los doce leen el carrito a la vez y todos cuentan como conectados', async () => {
    const caso = await mesaConPortal();
    const estados = await Promise.all(
      Array.from({ length: 12 }, (_, i) => caso.mirar(telefono(i))),
    );
    expect(estados.every((e) => e !== null)).toBe(true);
    expect((await caso.mirar(TELEFONO_A))?.conectados).toBe(13);
  });

  it(`el latido se escribe a lo mucho cada ${String(SEGUNDOS_ENTRE_LATIDOS)} s por teléfono`, async () => {
    const caso = await mesaConPortal();
    const huella = huellaDelDispositivo(PIMIENTA, TELEFONO_A);
    const visto = async () =>
      (
        await obtenerDb()
          .selectFrom('dispositivos_mesa')
          .select('visto_en')
          .where('mesa_id', '=', caso.mesaId)
          .where('dispositivo_huella', '=', huella)
          .executeTakeFirstOrThrow()
      ).visto_en.getTime();
    const t0 = new Date('2026-11-01T20:00:00Z');
    await caso.mirar(TELEFONO_A, t0);
    await caso.mirar(TELEFONO_A, new Date(t0.getTime() + 10_000));
    expect(await visto()).toBe(t0.getTime());
    const t31 = new Date(t0.getTime() + 31_000);
    await caso.mirar(TELEFONO_A, t31);
    expect(await visto()).toBe(t31.getTime());
  });
});
