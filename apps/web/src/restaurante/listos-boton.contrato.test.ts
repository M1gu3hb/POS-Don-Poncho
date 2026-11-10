import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-16 (1.2) · «MARCAR ENTREGADO» DEL MESERO: COMPLETA, GRANDE Y QUE AVISE SI FALLA.
 *
 * La tarjeta «Listos para recoger» salía cortada (en el diálogo de la mesa era un hijo de una
 * columna con `overflow-hidden` que se comprimía), el botón era `size="sm"` de 32 px y un fallo
 * sólo asomaba como un aviso pasajero. Ahora: la tarjeta no se encoge ni recorta, el botón ocupa
 * todo el ancho con al menos 48 px de alto y el motivo del fallo queda a la vista junto al botón.
 */

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const leer = (...ruta: string[]): string =>
  readFileSync(join(RAIZ_WEB, ...ruta), 'utf8').replace(/\s+/g, ' ');

describe('DP-16 · «Listos para recoger» (pantalla nueva)', () => {
  const fuente = leer('src', 'restaurante', 'ListosParaRecoger.tsx');
  const boton = fuente.slice(fuente.indexOf('<Button'), fuente.indexOf('</Button>'));

  it('el botón es grande, a todo lo ancho y de al menos 48 px', () => {
    expect(boton).toContain('size="lg"');
    expect(boton).toContain('w-full');
    // 48 px como mínimo (3rem), sin saltarse la perilla de densidad (`--altura-control`).
    expect(boton).toContain('min-h-[max(3rem,var(--altura-control))]');
    expect(boton).not.toContain('size="sm"');
  });

  it('el fallo de entrega es un aviso visible y anunciado', () => {
    expect(fuente).toContain('tono="peligro"');
    // `Aviso` con `anuncio="alerta"` es un `role="alert"`: el lector de pantalla lo dice solo.
    expect(fuente).toContain('anuncio="alerta"');
  });

  it('la franja va justo debajo de la cabecera, antes de las acciones de la mesa', () => {
    const mesa = leer('src', 'restaurante', 'MesaActiva.tsx');
    expect(mesa.indexOf('{bloqueDeListos}</div>')).toBeGreaterThan(-1);
    expect(mesa.indexOf('{bloqueDeListos}</div>')).toBeLessThan(mesa.indexOf('<AccionesDeLaMesa'));
  });
});

describe('DP-16 · «Listos para recoger» (diálogo de la mesa heredado)', () => {
  const fuente = leer('heredado', 'components', 'mesero', 'ListosParaRecogerCard.jsx');
  const raiz = fuente.slice(
    fuente.lastIndexOf('return ( <div'),
    fuente.lastIndexOf('return ( <div') + 260,
  );
  const inicio = fuente.indexOf('<Button size="lg"');
  const boton = fuente.slice(inicio, fuente.indexOf('</Button>', inicio));

  it('la tarjeta no se encoge ni recorta lo que lleva dentro', () => {
    expect(raiz).toContain('shrink-0');
    expect(raiz).not.toContain('overflow-hidden');
  });

  it('el botón de entregar es grande, a todo lo ancho y de al menos 48 px', () => {
    expect(boton).toContain('w-full');
    expect(boton).toContain('min-h-12');
  });

  it('un fallo queda escrito en la tarjeta y el botón sigue disponible', () => {
    expect(fuente).toContain('role="alert"');
    expect(fuente).toContain('setFalloDeEntrega(');
    expect(fuente).toMatch(/finally \{ setEntregando\(false\)/);
  });
});
