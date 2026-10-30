import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { TeselaDeMesa, type TeselaDeMesaProps } from './TeselaDeMesa';
import type { MesaDelSalon } from './tipos-del-salon';

/**
 * UNA MESA DEL SALÓN, pintada.
 *
 * Las pruebas de navegador (`estados-de-mesa.spec.ts`) encuentran cada mesa por sus clases —
 * `div.cursor-pointer.select-none` en el plano, `button.rounded-2xl` en la rejilla—, el número por
 * `span.font-heading` y la palabra del estado por `span.leading-tight` (plano) o
 * `span.rounded-full.border` (rejilla). Aquí se fija ese marcado, y que la mesa ya no lleve lo
 * que el lenguaje nuevo quitó: degradados, sombras y colores puestos a mano, emoji.
 */

const mesa: MesaDelSalon = {
  id: 'm-5',
  numero: 5,
  estado: 'ocupada',
  zona: 'Interior',
  forma: 'redonda',
  tamano: 'mediana',
  posicion_x: 140,
  posicion_y: 60,
  personas_actuales: 4,
  capacidad: 6,
};

const base: Omit<TeselaDeMesaProps, 'forma'> = {
  mesa,
  oscuro: false,
  activa: false,
  responsableNombre: '',
  responsableColor: null,
  solicitudes: undefined,
  lugarDeLosGlobos: 'arriba',
  alTocar: () => undefined,
  alAtender: () => undefined,
};

const plano = (cambios: Partial<TeselaDeMesaProps> = {}): string =>
  renderToStaticMarkup(<TeselaDeMesa {...base} forma="plano" {...cambios} />);
const rejilla = (cambios: Partial<TeselaDeMesaProps> = {}): string =>
  renderToStaticMarkup(<TeselaDeMesa {...base} forma="rejilla" {...cambios} />);

describe('la mesa del salón, memoizada', () => {
  it('con las mismas propiedades no se vuelve a dibujar: abrir una mesa no toca las otras veinte', () => {
    expect(TeselaDeMesa).toHaveProperty('$$typeof', Symbol.for('react.memo'));
  });
});

describe('la mesa en el PLANO', () => {
  it('es un div que se toca (cursor-pointer select-none), no un botón', () => {
    const html = plano();
    expect(html).toMatch(/^<div[^>]*class="[^"]*\bcursor-pointer\b[^"]*\bselect-none\b/);
    expect(html).not.toContain('<button');
  });

  it('lleva el número en un span.font-heading y el estado en un span.leading-tight', () => {
    const html = plano();
    expect(html).toMatch(/<span class="[^"]*\bfont-heading\b[^"]*">5<\/span>/);
    expect(html).toMatch(/<span class="[^"]*\bleading-tight\b[^"]*"[^>]*>Ocupada<\/span>/);
  });

  it('un solo span.leading-tight (la prueba lo busca sin ambigüedad), aun con quien atiende', () => {
    const html = plano({ responsableNombre: 'Carlos', responsableColor: 'hsl(10 80% 50%)' });
    expect(html.match(/leading-tight/g)).toHaveLength(1);
  });

  it('se coloca en su posición y con la medida de su forma y tamaño', () => {
    expect(plano()).toMatch(/left:140px;top:60px;width:80px;height:80px/);
  });

  it('una mesa sin posición cae donde siempre: en (100, 100)', () => {
    const html = plano({ mesa: { ...mesa, posicion_x: null, posicion_y: undefined } });
    expect(html).toMatch(/left:100px;top:100px/);
  });

  it('redonda es completa; rectangular, no', () => {
    expect(plano()).toContain('rounded-full');
    const rectangular = plano({ mesa: { ...mesa, forma: 'rectangular' } });
    expect(rectangular).not.toMatch(/^<div[^>]*class="[^"]*\brounded-full\b/);
    expect(rectangular).toMatch(/width:120px;height:70px/);
  });

  it('el relleno es SÓLIDO: el color del estado, sin degradado ni sombra a mano', () => {
    const html = plano();
    expect(html).toContain('background:#E63946');
    expect(html).toContain('border-color:#A41E2A');
    expect(html).not.toContain('gradient');
    expect(html).not.toMatch(/style="[^"]*box-shadow/);
    expect(html).not.toContain('blur');
  });

  it('la etiqueta con texto blanco, en claro, va sobre el tono oscuro de su familia', () => {
    expect(plano()).toMatch(/<span[^>]*leading-tight[^>]*style="[^"]*background:#A41E2A/);
  });

  it('en oscuro usa la paleta oscura', () => {
    const html = plano({ oscuro: true });
    expect(html).toContain('background:#4a1922');
    expect(html).toContain('border-color:#f43f5e');
  });

  it('la mesa abierta lleva activa (anillo y data-activa)', () => {
    expect(plano({ activa: true })).toContain('data-activa=""');
    expect(plano({ activa: false })).not.toContain('data-activa');
  });

  it('quien atiende: el punto de su color y su nombre; personas en la pastilla', () => {
    const html = plano({ responsableNombre: 'Atiende: Carlos Pérez', responsableColor: '#ff0000' });
    expect(html).toContain('background:#ff0000');
    expect(html).toContain('Atiende: Carlos Pérez');
    expect(html).toContain('Atiende: Carlos Pérez — 4 personas');
    // En la pastilla va sin el prefijo; el título conserva el nombre completo.
    expect(html).toContain('>Carlos Pérez · 4 pers.<');
  });

  it('sin quien atienda, y con personas, el contador suelto', () => {
    expect(plano()).toMatch(/4 pers\./);
  });

  it('la celebración y la alergia son iconos, no emoji', () => {
    const html = plano({ mesa: { ...mesa, celebracion_especial: true, notas_alergias: 'nuez' } });
    expect(html).toContain('lucide-party-popper');
    expect(html).toContain('lucide-triangle-alert');
    expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('con solicitudes pendientes pinta sus globos; sin ellas, ninguno', () => {
    const conGlobo = plano({
      solicitudes: [{ id: 's1', mesa_id: 'm-5', tipo: 'ayuda', created_date: null }],
    });
    expect(conGlobo).toContain('Mesa 5: Necesita ayuda. Tocar para atender.');
    expect(plano()).not.toContain('Tocar para atender');
  });

  it('un estado desconocido se pinta como «Libre»', () => {
    expect(plano({ mesa: { ...mesa, estado: 'inventado' } })).toContain('>Libre<');
  });
});

describe('la mesa en la REJILLA del teléfono', () => {
  it('es un botón rounded-2xl con su type', () => {
    const html = rejilla();
    expect(html).toMatch(/<button[^>]*class="[^"]*\brounded-2xl\b[^"]*"[^>]*type="button"/);
    expect(html).not.toMatch(/<button[^>]*class="[^"]*\brounded-lg\b/);
  });

  it('el número en span.font-heading y la palabra en span.rounded-full.border', () => {
    const html = rejilla();
    expect(html).toMatch(/<span class="[^"]*\bfont-heading\b[^"]*">5<\/span>/);
    expect(html).toMatch(
      /<span class="[^"]*\brounded-full\b[^"]*\bborder\b[^"]*"[^>]*>Ocupada<\/span>/,
    );
  });

  it('un solo span.rounded-full.border dentro de la tarjeta, aun con quien atiende', () => {
    const html = rejilla({ responsableNombre: 'Carlos', responsableColor: '#00ff00' });
    const chips = html.match(/<span class="[^"]*\brounded-full\b[^"]*\bborder\b[^"]*"/g) ?? [];
    expect(chips).toHaveLength(1);
    expect(html).toContain('Carlos');
  });

  it('cuántos son: «4 personas», o la capacidad si nadie se sentó', () => {
    expect(rejilla()).toContain('4 personas');
    expect(rejilla({ mesa: { ...mesa, personas_actuales: 1 } })).toContain('1 persona<');
    expect(rejilla({ mesa: { ...mesa, personas_actuales: 0 } })).toContain('>6<');
  });

  it('los globos van ANTES de la tarjeta y no dentro: un botón no lleva otro adentro', () => {
    const html = rejilla({
      solicitudes: [{ id: 's1', mesa_id: 'm-5', tipo: 'cuenta', created_date: null }],
    });
    const globo = html.indexOf('Pide la cuenta');
    const tarjeta = html.indexOf('rounded-2xl');
    expect(globo).toBeGreaterThan(-1);
    expect(globo).toBeLessThan(tarjeta);
    // En línea: en el flujo de la rejilla, no flotando sobre la tarjeta como en el plano.
    expect(html).toContain('flex flex-wrap items-center justify-center');
    expect(html).not.toMatch(/absolute bottom-full|absolute top-full/);
    // Y ningún <button> dentro de otro <button>.
    expect(html).not.toMatch(/<button[^>]*rounded-2xl[^>]*>(?:(?!<\/button>)[\s\S])*<button/);
  });

  it('relleno sólido, sin degradado ni sombra a mano, y activa con data-activa', () => {
    const html = rejilla({ activa: true });
    expect(html).toContain('background:#E63946');
    expect(html).not.toContain('gradient');
    expect(html).not.toMatch(/style="[^"]*box-shadow/);
    expect(html).toContain('data-activa=""');
  });
});
