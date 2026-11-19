import { obtenerDb } from '@morphiqpos/data';
import { describe, expect, it } from 'vitest';

import { exigirOk } from '../pruebas/negocio-real.ts';
import { mesaConPortal, TELEFONO_A } from './pruebas/mesa-con-portal.ts';
import { valorarVisita } from './valoracion.ts';

/**
 * DP-22 · CALIFICAR LA VISITA (`portal.valorar`), contra Postgres real.
 *
 * La carita del comensal se guarda UNA vez y en SU cuenta: el emoji lo pone el servidor, una
 * segunda carita no pisa la primera (devuelve la que quedó) y una mesa sin visita no puede calificar
 * ni toca la cuenta de otra mesa.
 */

async function mesaConVisita() {
  const caso = await mesaConPortal();
  const { ventaId } = await caso.abrir(2);
  exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
  exigirOk(await caso.enviar(TELEFONO_A, true), 'enviar');
  return { caso, ventaId };
}

const guardada = (ordenId: string) =>
  obtenerDb()
    .selectFrom('ordenes')
    .select(['satisfaccion_score', 'satisfaccion_emoji', 'satisfaccion_comentario'])
    .where('id', '=', ordenId)
    .executeTakeFirstOrThrow();

describe('calificar la visita desde el portal', () => {
  it('la carita se guarda en la cuenta de la mesa, con el emoji que pone el servidor', async () => {
    const { caso, ventaId } = await mesaConVisita();
    const salida = exigirOk(
      await caso.publico(valorarVisita, { score: 5, comentario: 'Muy rico todo' }),
      'portal.valorar',
    );
    expect(salida).toMatchObject({ ventaId, score: 5, yaValorada: false });
    expect(await guardada(ventaId)).toEqual({
      satisfaccion_score: 5,
      satisfaccion_emoji: '🤩',
      satisfaccion_comentario: 'Muy rico todo',
    });
  });

  it('no se califica dos veces: la segunda devuelve la que quedó y no pisa nada', async () => {
    const { caso, ventaId } = await mesaConVisita();
    exigirOk(await caso.publico(valorarVisita, { score: 4 }), 'primera');
    const segunda = exigirOk(
      await caso.publico(valorarVisita, { score: 1, comentario: 'Cambié de opinión' }),
      'segunda',
    );
    expect(segunda).toMatchObject({ ventaId, score: 4, yaValorada: true });
    expect(await guardada(ventaId)).toMatchObject({
      satisfaccion_score: 4,
      satisfaccion_emoji: '🙂',
      satisfaccion_comentario: null,
    });
  });

  it('una cuenta ajena no se toca: calificar en una mesa deja la de otra sin calificar', async () => {
    const propia = await mesaConVisita();
    const ajena = await mesaConVisita();
    exigirOk(await propia.caso.publico(valorarVisita, { score: 2 }), 'la propia');
    expect((await guardada(ajena.ventaId)).satisfaccion_score).toBeNull();
    expect((await guardada(propia.ventaId)).satisfaccion_score).toBe(2);
  });

  it('una mesa sin visita no puede calificar: dice que no encontró la visita', async () => {
    const caso = await mesaConPortal();
    const salida = await caso.publico(valorarVisita, { score: 5 });
    expect(salida.ok).toBe(false);
    expect(salida.ok ? '' : salida.error.mensaje).toContain('visita reciente');
  });

  it('un número fuera de 1 a 5 se rechaza y no escribe', async () => {
    const { caso, ventaId } = await mesaConVisita();
    expect((await caso.publico(valorarVisita, { score: 9 })).ok).toBe(false);
    expect((await guardada(ventaId)).satisfaccion_score).toBeNull();
  });
});
