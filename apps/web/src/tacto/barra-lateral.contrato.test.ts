import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-21 · Bloque 9 · O5/M3 · EL BOTÓN DE LA BARRA, grande y a la vista: el cableado, leído.
 *
 * Era un chevron de 16 px al 50 % de opacidad que sólo existía en `lg:`: plegada, casi no se veía.
 * Son pantallas heredadas (JSX) que un test de componentes no alcanza: el contrato lee su texto y
 * se valida mutando el código real.
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');
const BARRA = leer('heredado/components/common/Sidebar.jsx');
const ARMAZON = leer('heredado/components/common/AppLayout.jsx');

/** El elemento `<button …>` que lleva este texto en su `aria-label`. */
function botonConEtiqueta(etiqueta: string): string {
  const en = BARRA.indexOf(etiqueta);
  if (en === -1) throw new Error(`No encontré «${etiqueta}» en la barra.`);
  const abre = BARRA.lastIndexOf('<button', en);
  return BARRA.slice(abre, BARRA.indexOf('</button>', en));
}

describe('el botón de plegar la barra (escritorio)', () => {
  const boton = botonConEtiqueta('Ocultar menú');

  it('mide 44 × 44 como mínimo', () => {
    expect(boton).toMatch(/\bmin-h-11\b/);
    expect(boton).toMatch(/\bmin-w-11\b/);
  });

  it('dice «Ocultar» o «Mostrar» con letra, no sólo con un dibujo', () => {
    expect(boton).toMatch(/Ocultar/);
    expect(boton).toMatch(/Mostrar/);
    expect(boton).toMatch(
      /aria-label=\{plegada \? 'Mostrar menú' : 'Ocultar menú'\}|collapsed \? 'Mostrar menú' : 'Ocultar menú'/,
    );
  });

  it('no se apaga al 50 % ni se esconde: visible plegada y desplegada', () => {
    expect(boton).not.toMatch(/\/50\b/);
    expect(boton).not.toMatch(/opacity-/);
    expect(boton).not.toMatch(/\b(lg|md|sm):hidden\b|\binvisible\b/);
  });

  it('sólo existe donde hay barra fija (lg:); abajo de eso hay el botón del cajón', () => {
    expect(boton).toMatch(/\bhidden\b[^`]*\blg:flex\b/);
  });
});

describe('el botón del cajón (teléfono y tableta)', () => {
  const boton = botonConEtiqueta('Abrir menú');

  it('mide lo mismo (44 px) y dice «Menú» con letra', () => {
    expect(boton).toMatch(/\bmin-h-11\b/);
    expect(boton).toMatch(/\bmin-w-11\b/);
    expect(boton).toMatch(/>\s*Menú\s*</);
  });

  it('su nombre accesible contiene lo que se lee: «Abrir menú»', () => {
    expect(boton).toMatch(/aria-label="Abrir menú"/);
  });
});

describe('el armazón recuerda la elección y empieza plegada con pocas secciones', () => {
  it('AppLayout usa el estado recordado y no un `useState(deModelo)` suelto', () => {
    expect(ARMAZON).toMatch(/useBarraLateral\(/);
    expect(ARMAZON).not.toMatch(/useState\(deModelo\)/);
  });

  it('le dice cuántas secciones tiene el puesto', () => {
    expect(ARMAZON).toMatch(/secciones:/);
    expect(ARMAZON).toMatch(/navegacionParaRolYPlantilla\(/);
  });
});
