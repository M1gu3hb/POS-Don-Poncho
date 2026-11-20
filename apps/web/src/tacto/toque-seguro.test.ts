import { describe, expect, it } from 'vitest';

import {
  MS_PARA_MANTENER,
  REPOSO_MS,
  TOLERANCIA_PX,
  VIGENCIA_DEL_GESTO_MS,
  decidirToque,
  gestoVigente,
  liberarAlTerminar,
  sumaDeDesplazamientosDe,
  type ConDesplazamiento,
  type EstadoDelBoton,
  type GestoMedido,
} from './toque-seguro';

const LIBRE: EstadoDelBoton = { ahora: 10_000, ultimoAgregado: null, enCurso: false };
const TOQUE: GestoMedido = {
  alejamientoPx: 0,
  desplazamientoPx: 0,
  duracionMs: 90,
  cancelado: false,
};
const con = (cambio: Partial<GestoMedido>): GestoMedido => ({ ...TOQUE, ...cambio });

describe('decidirToque · qué cuenta como tocar', () => {
  it('un toque quieto y corto agrega', () => {
    expect(decidirToque(TOQUE, LIBRE)).toEqual({ agrega: true, motivo: 'toque' });
  });

  it('usa la tolerancia de las pulsaciones del mesero: 10 px aún es tocar, 11 es deslizar', () => {
    expect(TOLERANCIA_PX).toBe(10);
    expect(decidirToque(con({ alejamientoPx: TOLERANCIA_PX }), LIBRE).agrega).toBe(true);
    expect(decidirToque(con({ alejamientoPx: TOLERANCIA_PX + 1 }), LIBRE)).toEqual({
      agrega: false,
      motivo: 'se-movio',
    });
  });

  it('arrastrar de 40 a 200 px no agrega, ni se mueva el dedo hacia arriba o hacia abajo', () => {
    for (const px of [40, 120, 200]) {
      expect(decidirToque(con({ alejamientoPx: px }), LIBRE).agrega).toBe(false);
    }
  });

  it('si algún contenedor se desplazó entre bajar y soltar, no agrega aunque el dedo vuelva', () => {
    expect(decidirToque(con({ desplazamientoPx: 1 }), LIBRE)).toEqual({
      agrega: false,
      motivo: 'se-desplazo',
    });
  });

  it('mantener presionado nunca agrega: 500 ms ya es mantener, 499 todavía es tocar', () => {
    expect(MS_PARA_MANTENER).toBe(500);
    expect(decidirToque(con({ duracionMs: MS_PARA_MANTENER - 1 }), LIBRE).agrega).toBe(true);
    expect(decidirToque(con({ duracionMs: MS_PARA_MANTENER }), LIBRE)).toEqual({
      agrega: false,
      motivo: 'mantenido',
    });
    expect(decidirToque(con({ duracionMs: 5_000 }), LIBRE).agrega).toBe(false);
  });

  it('un gesto que el navegador canceló (empezó a desplazar) no agrega', () => {
    expect(decidirToque(con({ cancelado: true }), LIBRE)).toEqual({
      agrega: false,
      motivo: 'cancelado',
    });
  });
});

describe('decidirToque · rebotes y acciones en curso', () => {
  it('un segundo agregado en menos de 350 ms se ignora; a los 350 ya cuenta', () => {
    expect(REPOSO_MS).toBe(350);
    const hace = (ms: number): EstadoDelBoton => ({ ...LIBRE, ultimoAgregado: LIBRE.ahora - ms });
    expect(decidirToque(TOQUE, hace(REPOSO_MS - 1))).toEqual({ agrega: false, motivo: 'repetido' });
    expect(decidirToque(TOQUE, hace(REPOSO_MS)).agrega).toBe(true);
  });

  it('el reposo se puede acortar (los + y – del pedido)', () => {
    const estado: EstadoDelBoton = { ...LIBRE, ultimoAgregado: LIBRE.ahora - 200 };
    expect(decidirToque(TOQUE, estado).agrega).toBe(false);
    expect(decidirToque(TOQUE, estado, { reposoMs: 150 }).agrega).toBe(true);
  });

  it('mientras la acción de ese botón se resuelve, no entra otro toque', () => {
    expect(decidirToque(TOQUE, { ...LIBRE, enCurso: true })).toEqual({
      agrega: false,
      motivo: 'en-curso',
    });
  });

  it('lo que la acción en curso manda sobre todo lo demás', () => {
    expect(decidirToque(con({ alejamientoPx: 99 }), { ...LIBRE, enCurso: true }).motivo).toBe(
      'en-curso',
    );
  });
});

describe('decidirToque · teclado y programático', () => {
  it('sin gesto de puntero (Enter, Espacio, lector de pantalla) agrega', () => {
    expect(decidirToque(null, LIBRE)).toEqual({ agrega: true, motivo: 'toque' });
  });

  it('el teclado también respeta el reposo y la acción en curso', () => {
    expect(decidirToque(null, { ...LIBRE, ultimoAgregado: LIBRE.ahora - 10 }).motivo).toBe(
      'repetido',
    );
    expect(decidirToque(null, { ...LIBRE, enCurso: true }).motivo).toBe('en-curso');
  });
});

describe('sin candado (la caja de mostrador: cada toque manda su comando por red)', () => {
  const EN_CURSO: EstadoDelBoton = { ahora: 10_500, ultimoAgregado: 10_000, enCurso: true };

  it('con candado, un segundo toque a 500 ms mientras la acción de 800 ms resuelve se pierde', () => {
    expect(decidirToque(TOQUE, EN_CURSO)).toEqual({ agrega: false, motivo: 'en-curso' });
  });

  it('sin candado, el mismo segundo toque agrega (suman 2)', () => {
    expect(decidirToque(TOQUE, EN_CURSO, { sinCandado: true })).toEqual({
      agrega: true,
      motivo: 'toque',
    });
  });

  it('sin candado siguen valiendo el reposo y las reglas del gesto', () => {
    const pegado: EstadoDelBoton = { ahora: 10_100, ultimoAgregado: 10_000, enCurso: true };
    expect(decidirToque(TOQUE, pegado, { sinCandado: true }).motivo).toBe('repetido');
    expect(
      decidirToque(con({ duracionMs: MS_PARA_MANTENER }), EN_CURSO, { sinCandado: true }),
    ).toEqual({
      agrega: false,
      motivo: 'mantenido',
    });
  });
});

describe('liberarAlTerminar · el rechazo no se silencia', () => {
  it('libera al resolver', async () => {
    let libre = 0;
    await liberarAlTerminar(Promise.resolve(1), () => (libre += 1));
    expect(libre).toBe(1);
  });

  it('libera al rechazar Y el rechazo sigue saliendo', async () => {
    let libre = 0;
    const derivada = liberarAlTerminar(Promise.reject(new Error('falló el agregado')), () => {
      libre += 1;
    });
    await expect(derivada).rejects.toThrow('falló el agregado');
    expect(libre).toBe(1);
  });
});

describe('gestoVigente · un gesto sin terminar también caduca', () => {
  it('uno terminado cuenta desde que terminó', () => {
    const m = { terminado: true, inicio: 0, fin: 5_000 };
    expect(gestoVigente(m, 5_000 + VIGENCIA_DEL_GESTO_MS - 1)).toBe(true);
    expect(gestoVigente(m, 5_000 + VIGENCIA_DEL_GESTO_MS)).toBe(false);
  });

  it('uno sin terminar (nunca llegó pointerup) cuenta desde que empezó', () => {
    const m = { terminado: false, inicio: 2_000, fin: 0 };
    expect(gestoVigente(m, 2_000 + VIGENCIA_DEL_GESTO_MS - 1)).toBe(true);
    expect(gestoVigente(m, 2_000 + VIGENCIA_DEL_GESTO_MS)).toBe(false);
    expect(gestoVigente(m, 60_000)).toBe(false);
  });
});

describe('sumaDeDesplazamientosDe · sólo los contenedores del botón', () => {
  const nodo = (scrollTop: number, parentElement: ConDesplazamiento | null): ConDesplazamiento => ({
    scrollTop,
    scrollLeft: 0,
    parentElement,
  });

  it('un desplazamiento en un ancestro del botón cambia la suma', () => {
    const lista = nodo(0, null);
    const boton = nodo(0, lista);
    const antes = sumaDeDesplazamientosDe(boton, null);
    (lista as { scrollTop: number }).scrollTop = 120;
    expect(sumaDeDesplazamientosDe(boton, null)).not.toBe(antes);
  });

  it('un desplazamiento en un contenedor AJENO (otra rama) no la cambia', () => {
    const lista = nodo(0, null);
    const boton = nodo(0, lista);
    const barraDeSecciones = nodo(0, null);
    const antes = sumaDeDesplazamientosDe(boton, null);
    (barraDeSecciones as { scrollTop: number }).scrollTop = 80;
    expect(sumaDeDesplazamientosDe(boton, null)).toBe(antes);
  });

  it('la página cuenta si se da', () => {
    const boton = nodo(0, null);
    expect(sumaDeDesplazamientosDe(boton, { scrollTop: 40, scrollLeft: 0 })).toBe(40);
  });
});
