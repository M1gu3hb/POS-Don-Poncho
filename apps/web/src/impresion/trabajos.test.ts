import { describe, expect, it } from 'vitest';

import {
  crearMesaDeTrabajos,
  enCurso,
  falloDelPuente,
  mensajeDe,
  textoDeLaFase,
  type ControlesDelTrabajo,
  type FinDelTrabajo,
} from './trabajos.ts';

/**
 * DP-20 · refuerzo §4 · EL BOTÓN NO ACEPTA OTRO TOQUE MIENTRAS IMPRIME, y un reintento no
 * duplica el ticket (lleva el mismo id).
 */

/** Una tarea que se queda esperando hasta que la prueba la suelta. */
function tareaEnEspera(): {
  tarea: (controles: ControlesDelTrabajo) => Promise<FinDelTrabajo>;
  terminar: (fin: FinDelTrabajo) => void;
  ids: string[];
  controles: ControlesDelTrabajo[];
} {
  const ids: string[] = [];
  const controles: ControlesDelTrabajo[] = [];
  let soltar: (fin: FinDelTrabajo) => void = () => undefined;
  return {
    ids,
    controles,
    tarea: (c) => {
      ids.push(c.id);
      controles.push(c);
      return new Promise<FinDelTrabajo>((resolver) => {
        soltar = resolver;
      });
    },
    terminar: (fin) => {
      soltar(fin);
    },
  };
}

function contador(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `trabajo-${String(n)}`;
  };
}

const IMPRESO: FinDelTrabajo = { ok: true, estado: 'impreso' };
const SIN_PAPEL: FinDelTrabajo = { ok: false, fallo: falloDelPuente('SIN_PAPEL', undefined) };

describe('un trabajo a la vez por botón', () => {
  it('con un trabajo en curso, el segundo toque no cuenta: la tarea no se llama otra vez', async () => {
    const mesa = crearMesaDeTrabajos();
    const espera = tareaEnEspera();
    const id = contador();
    const primero = mesa.lanzar('ticket:A-1', id, espera.tarea);
    expect(mesa.leer('ticket:A-1').fase).toBe('enviando');

    expect(await mesa.lanzar('ticket:A-1', id, espera.tarea)).toBeNull();
    expect(await mesa.lanzar('ticket:A-1', id, espera.tarea)).toBeNull();
    expect(espera.ids).toEqual(['trabajo-1']);

    espera.terminar(IMPRESO);
    expect(await primero).toEqual(IMPRESO);
    expect(mesa.leer('ticket:A-1').fase).toBe('impreso');
  });

  it('otro documento sí se imprime mientras tanto', async () => {
    const mesa = crearMesaDeTrabajos();
    const a = tareaEnEspera();
    const b = tareaEnEspera();
    const id = contador();
    void mesa.lanzar('ticket:A-1', id, a.tarea);
    const otro = mesa.lanzar('ticket:A-2', id, b.tarea);
    b.terminar(IMPRESO);
    expect(await otro).toEqual(IMPRESO);
    expect(enCurso(mesa.leer('ticket:A-1'))).toBe(true);
  });

  it('al terminar se puede volver a imprimir, con id NUEVO: no hay bloqueo permanente', async () => {
    const mesa = crearMesaDeTrabajos();
    const id = contador();
    const ids: string[] = [];
    const tarea = (c: ControlesDelTrabajo): Promise<FinDelTrabajo> => {
      ids.push(c.id);
      return Promise.resolve(IMPRESO);
    };
    await mesa.lanzar('ticket:A-1', id, tarea);
    await mesa.lanzar('ticket:A-1', id, tarea);
    expect(ids).toEqual(['trabajo-1', 'trabajo-2']);
  });

  it('el reintento tras un fallo lleva el MISMO id; el siguiente tras salir bien, uno nuevo', async () => {
    const mesa = crearMesaDeTrabajos();
    const id = contador();
    const ids: string[] = [];
    const fines: FinDelTrabajo[] = [SIN_PAPEL, IMPRESO, IMPRESO];
    const tarea = (c: ControlesDelTrabajo): Promise<FinDelTrabajo> => {
      ids.push(c.id);
      return Promise.resolve(fines.shift() ?? IMPRESO);
    };
    await mesa.lanzar('ticket:A-1', id, tarea);
    expect(mesa.leer('ticket:A-1')).toMatchObject({ fase: 'error', idPendiente: 'trabajo-1' });
    await mesa.lanzar('ticket:A-1', id, tarea);
    await mesa.lanzar('ticket:A-1', id, tarea);
    expect(ids).toEqual(['trabajo-1', 'trabajo-1', 'trabajo-2']);
  });

  it('una tarea que revienta deja el botón en error, no trabado', async () => {
    const mesa = crearMesaDeTrabajos();
    const fin = await mesa.lanzar('ticket:A-1', contador(), () =>
      Promise.reject(new Error('El navegador no pudo dibujar el documento.')),
    );
    expect(fin).toMatchObject({
      ok: false,
      fallo: { titulo: 'El navegador no pudo dibujar el documento.' },
    });
    expect(enCurso(mesa.leer('ticket:A-1'))).toBe(false);
  });

  it('un rechazo del puente (objeto plano, no un Error) también dice su mensaje', async () => {
    const mesa = crearMesaDeTrabajos();
    const rechazo: unknown = {
      name: 'ORIGEN',
      codigo: 'ORIGEN',
      message: 'Esta página no puede usar la app.',
    };
    const fin = await mesa.lanzar('t', contador(), () =>
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- así rechaza el puente.
      Promise.reject(rechazo),
    );
    expect(fin).toMatchObject({
      ok: false,
      fallo: { titulo: 'Esta página no puede usar la app.' },
    });
    expect(mensajeDe('texto suelto')).toBeNull();
    expect(mensajeDe({ message: '' })).toBeNull();
  });

  it('avisa a quien escucha en cada cambio, y el avance pasa a «Imprimiendo…»', async () => {
    const mesa = crearMesaDeTrabajos();
    const espera = tareaEnEspera();
    const fases: string[] = [];
    const quitar = mesa.suscribir(() => fases.push(mesa.leer('t').fase));
    const corriendo = mesa.lanzar('t', contador(), espera.tarea);
    espera.controles[0]?.avanzar(0.5);
    expect(mesa.leer('t')).toMatchObject({ fase: 'imprimiendo', avance: 0.5 });
    espera.terminar({ ok: true, estado: 'enviado' });
    await corriendo;
    quitar();
    mesa.soltar('t');
    expect(fases).toEqual(['enviando', 'imprimiendo', 'enviado']);
    expect(mesa.leer('t').fase).toBe('libre');
  });

  it('lo que está a la vista trae sus salidas, y «Reintentar» relanza con el mismo id', async () => {
    const mesa = crearMesaDeTrabajos();
    const id = contador();
    const ids: string[] = [];
    const fines: FinDelTrabajo[] = [SIN_PAPEL, IMPRESO];
    const salidas = { titulo: 'Ticket A-1', yaQuedo: 'La venta ya quedó cobrada.' };
    await mesa.lanzar(
      'ticket:A-1',
      id,
      (c) => {
        ids.push(c.id);
        return Promise.resolve(fines.shift() ?? IMPRESO);
      },
      salidas,
    );
    expect(mesa.aLaVista()).toEqual([
      { clave: 'ticket:A-1', estado: mesa.leer('ticket:A-1'), salidas },
    ]);
    expect(mesa.aLaVista()).toBe(mesa.aLaVista());
    mesa.reintentar('ticket:A-1');
    await Promise.resolve();
    await Promise.resolve();
    expect(ids).toEqual(['trabajo-1', 'trabajo-1']);
    expect(mesa.leer('ticket:A-1').fase).toBe('impreso');
  });

  it('si el documento se fue al navegador, el botón queda libre: no dice «Impreso»', async () => {
    const mesa = crearMesaDeTrabajos();
    await mesa.lanzar('precuenta:1', contador(), () =>
      Promise.resolve({ ok: true, estado: 'navegador' }),
    );
    expect(mesa.leer('precuenta:1').fase).toBe('libre');
    expect(mesa.aLaVista()).toEqual([]);
  });

  it('soltar no interrumpe un trabajo en curso', () => {
    const mesa = crearMesaDeTrabajos();
    void mesa.lanzar('t', contador(), tareaEnEspera().tarea);
    mesa.soltar('t');
    expect(mesa.leer('t').fase).toBe('enviando');
  });
});

describe('lo que se le dice a la persona', () => {
  it('cada fallo dice qué pasó y qué hacer', () => {
    expect(falloDelPuente('SIN_PAPEL', 'x')).toMatchObject({ titulo: 'Sin papel' });
    expect(falloDelPuente('TAPA_ABIERTA', undefined).titulo).toBe('Tapa abierta');
    expect(falloDelPuente('DESCONECTADA', undefined).titulo).toBe('Impresora desconectada');
    expect(falloDelPuente('TIEMPO', undefined).titulo).toBe('No respondió en 10 s');
    for (const codigo of [
      'SIN_PAPEL',
      'TAPA_ABIERTA',
      'DESCONECTADA',
      'TIEMPO',
      'SIN_PERMISO',
      'SIN_PERFIL',
    ]) {
      expect(falloDelPuente(codigo, undefined).queHacer).not.toBe('');
    }
  });

  it('un fallo que no conoce usa el mensaje de la app', () => {
    expect(falloDelPuente('RARO', 'La impresora se calentó')).toMatchObject({
      codigo: 'RARO',
      titulo: 'La impresora se calentó',
    });
    expect(falloDelPuente(undefined, undefined).titulo).toBe('No se pudo imprimir');
  });

  it('el botón dice «Enviado» cuando la impresora no confirma e «Impreso» cuando sí', () => {
    const base = { avance: null, fallo: null, idPendiente: null };
    expect(textoDeLaFase({ ...base, fase: 'enviando' }, 'Imprimir')).toBe('Enviando…');
    expect(textoDeLaFase({ ...base, fase: 'imprimiendo' }, 'Imprimir')).toBe('Imprimiendo…');
    expect(textoDeLaFase({ ...base, fase: 'impreso' }, 'Imprimir')).toBe('Impreso ✓');
    expect(textoDeLaFase({ ...base, fase: 'enviado' }, 'Imprimir')).toBe('Enviado ✓');
    expect(textoDeLaFase({ ...base, fase: 'error' }, 'Imprimir')).toBe('Imprimir');
  });
});
