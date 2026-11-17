import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PLAZO_PARA_ENVIAR_MS,
  crearMesaDeTrabajos,
  type ControlesDelTrabajo,
  type FinDelTrabajo,
} from './trabajos.ts';

/**
 * X5 · UN PLAZO DEL LADO DE LA PÁGINA AL IMPRIMIR.
 *
 * Si la app nunca contesta (se colgó, la impresora no responde) la barra se quedaba en
 * «Enviando…» para siempre. Con reloj falso: sin respuesta, al cumplirse el plazo pasa a error
 * (con el id pendiente para reintentar sin duplicar); con respuesta a tiempo no hay error; y la
 * respuesta tardía de un trabajo ya vencido no lo marca «Impreso» ni lanza otro.
 */

const IMPRESO: FinDelTrabajo = { ok: true, estado: 'impreso' };

function contador(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `trabajo-${String(n)}`;
  };
}

/** Una tarea que se queda esperando hasta que la prueba la suelta. */
function tareaEnEspera() {
  const controles: ControlesDelTrabajo[] = [];
  let soltar: (fin: FinDelTrabajo) => void = () => undefined;
  return {
    controles,
    tarea: (c: ControlesDelTrabajo): Promise<FinDelTrabajo> => {
      controles.push(c);
      return new Promise<FinDelTrabajo>((resolver) => {
        soltar = resolver;
      });
    },
    terminar: (fin: FinDelTrabajo) => {
      soltar(fin);
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('el plazo del lado de la página', () => {
  it('el plazo es de 20 segundos', () => {
    expect(PLAZO_PARA_ENVIAR_MS).toBe(20_000);
  });

  it('sin respuesta, al cumplirse el plazo la barra pasa a error y guarda el id para reintentar', async () => {
    const mesa = crearMesaDeTrabajos();
    const espera = tareaEnEspera();
    const corriendo = mesa.lanzar('ticket:A-1', contador(), espera.tarea);

    await vi.advanceTimersByTimeAsync(PLAZO_PARA_ENVIAR_MS - 1);
    expect(mesa.leer('ticket:A-1').fase).toBe('enviando');

    await vi.advanceTimersByTimeAsync(1);
    expect(mesa.leer('ticket:A-1')).toMatchObject({
      fase: 'error',
      idPendiente: 'trabajo-1',
      fallo: { codigo: 'SIN_RESPUESTA' },
    });
    expect(await corriendo).toMatchObject({ ok: false, fallo: { codigo: 'SIN_RESPUESTA' } });
  });

  it('el aviso dice qué pasó y qué hacer, sin palabras técnicas', async () => {
    const mesa = crearMesaDeTrabajos();
    void mesa.lanzar('t', contador(), tareaEnEspera().tarea);
    await vi.advanceTimersByTimeAsync(PLAZO_PARA_ENVIAR_MS);
    const fallo = mesa.leer('t').fallo;
    expect(fallo?.titulo).toBe('La impresora no contestó');
    expect(fallo?.queHacer).toMatch(/Reintenta/);
    expect(fallo?.queHacer).toMatch(/navegador/);
    expect(fallo?.queHacer).toMatch(/Impresión/);
  });

  it('con respuesta a tiempo no hay error, ni al pasar el plazo, y no queda reloj vivo', async () => {
    const mesa = crearMesaDeTrabajos();
    const espera = tareaEnEspera();
    const corriendo = mesa.lanzar('t', contador(), espera.tarea);
    await vi.advanceTimersByTimeAsync(PLAZO_PARA_ENVIAR_MS - 1_000);
    espera.terminar(IMPRESO);
    expect(await corriendo).toEqual(IMPRESO);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(PLAZO_PARA_ENVIAR_MS * 2);
    expect(mesa.leer('t')).toMatchObject({ fase: 'impreso', fallo: null });
  });

  it('la respuesta tardía de un trabajo vencido no lo marca «Impreso»', async () => {
    const mesa = crearMesaDeTrabajos();
    const espera = tareaEnEspera();
    void mesa.lanzar('t', contador(), espera.tarea);
    await vi.advanceTimersByTimeAsync(PLAZO_PARA_ENVIAR_MS);
    expect(mesa.leer('t').fase).toBe('error');

    espera.terminar(IMPRESO);
    await vi.advanceTimersByTimeAsync(0);
    expect(mesa.leer('t')).toMatchObject({ fase: 'error', fallo: { codigo: 'SIN_RESPUESTA' } });
  });

  it('la respuesta tardía no lanza otro trabajo, y su avance tardío tampoco cambia la barra', async () => {
    const mesa = crearMesaDeTrabajos();
    const espera = tareaEnEspera();
    const nuevoId = vi.fn(contador());
    void mesa.lanzar('t', nuevoId, espera.tarea);
    await vi.advanceTimersByTimeAsync(PLAZO_PARA_ENVIAR_MS);

    espera.controles[0]?.avanzar(0.9);
    espera.terminar(IMPRESO);
    await vi.advanceTimersByTimeAsync(PLAZO_PARA_ENVIAR_MS * 2);

    expect(espera.controles).toHaveLength(1);
    expect(nuevoId).toHaveBeenCalledTimes(1);
    expect(mesa.leer('t').fase).toBe('error');
  });

  it('el reintento tras el plazo lleva el MISMO id: la app no imprime doble lo que sí entregó', async () => {
    const mesa = crearMesaDeTrabajos();
    const ids: string[] = [];
    const primera = tareaEnEspera();
    const segunda = tareaEnEspera();
    const id = contador();
    const registrando =
      (espera: ReturnType<typeof tareaEnEspera>) =>
      (c: ControlesDelTrabajo): Promise<FinDelTrabajo> => {
        ids.push(c.id);
        return espera.tarea(c);
      };
    void mesa.lanzar('t', id, registrando(primera), { titulo: 'Ticket A-1' });
    await vi.advanceTimersByTimeAsync(PLAZO_PARA_ENVIAR_MS);
    expect(mesa.leer('t').fase).toBe('error');

    void mesa.lanzar('t', id, registrando(segunda), { titulo: 'Ticket A-1' });
    expect(mesa.leer('t').fase).toBe('enviando');
    segunda.terminar(IMPRESO);
    await vi.advanceTimersByTimeAsync(0);
    expect(ids).toEqual(['trabajo-1', 'trabajo-1']);
    expect(mesa.leer('t').fase).toBe('impreso');
  });

  it('mientras la app avisa su avance, el plazo se renueva: sólo vence el silencio', async () => {
    const mesa = crearMesaDeTrabajos();
    const espera = tareaEnEspera();
    const corriendo = mesa.lanzar('t', contador(), espera.tarea);
    for (let i = 0; i < 3; i += 1) {
      await vi.advanceTimersByTimeAsync(PLAZO_PARA_ENVIAR_MS - 1_000);
      espera.controles[0]?.avanzar((i + 1) / 4);
    }
    expect(mesa.leer('t').fase).toBe('imprimiendo');

    await vi.advanceTimersByTimeAsync(PLAZO_PARA_ENVIAR_MS);
    expect(mesa.leer('t')).toMatchObject({ fase: 'error', fallo: { codigo: 'SIN_RESPUESTA' } });
    expect(await corriendo).toMatchObject({ ok: false });
  });

  it('un plazo propio sirve para la mesa (otra mesa, otro plazo)', async () => {
    const mesa = crearMesaDeTrabajos(500);
    void mesa.lanzar('t', contador(), tareaEnEspera().tarea);
    await vi.advanceTimersByTimeAsync(499);
    expect(mesa.leer('t').fase).toBe('enviando');
    await vi.advanceTimersByTimeAsync(1);
    expect(mesa.leer('t').fase).toBe('error');
  });
});
