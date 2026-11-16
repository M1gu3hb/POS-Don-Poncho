import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

import {
  GUION_DEL_AVISO_DE_APARATO_VIEJO,
  ID_DEL_AVISO_DE_APARATO_VIEJO,
} from './aviso-de-aparato-viejo.ts';

/**
 * DP-20.1 · «ESTE APARATO ES DEMASIADO VIEJO»: el guion que llega al navegador, corrido tal cual.
 *
 * Lo que no puede pasar nunca es que el aviso salga en un motor que sí entiende las capas de CSS:
 * tapa el POS entero. (Pasó con el primer intento, que lo decidía la hoja: ver el componente.)
 */

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');

/** Corre el guion en un mundo con (o sin) capas de CSS y devuelve cómo quedó el aviso. */
function correr(opciones: { readonly conCapas: boolean; readonly conAviso?: boolean }): {
  display: string;
  buscados: string[];
} {
  const aviso = { style: { display: 'none' } };
  const buscados: string[] = [];
  const mundo: Record<string, unknown> = {
    document: {
      getElementById(id: string): unknown {
        buscados.push(id);
        return opciones.conAviso === false ? null : aviso;
      },
    },
  };
  if (opciones.conCapas) mundo['CSSLayerBlockRule'] = (): undefined => undefined;
  runInContext(GUION_DEL_AVISO_DE_APARATO_VIEJO, createContext(mundo));
  return { display: aviso.style.display, buscados };
}

describe('el guion del aviso de aparato demasiado viejo', () => {
  it('en un motor que NO entiende las capas de CSS, lo enseña', () => {
    const { display, buscados } = correr({ conCapas: false });
    expect(display).toBe('block');
    expect(buscados).toEqual([ID_DEL_AVISO_DE_APARATO_VIEJO]);
  });

  it('en un motor que sí las entiende no lo toca: ni lo busca', () => {
    const { display, buscados } = correr({ conCapas: true });
    expect(display).toBe('none');
    expect(buscados).toEqual([]);
  });

  it('si el aviso no está en la página, no lanza', () => {
    expect(() => correr({ conCapas: false, conAviso: false })).not.toThrow();
  });

  it('va en línea: sintaxis de siempre, sin nada que venga de fuera', () => {
    expect(GUION_DEL_AVISO_DE_APARATO_VIEJO).not.toMatch(/=>|\blet\b|\bconst\b|\?\.|\?\?|`|\$\{/);
    expect(GUION_DEL_AVISO_DE_APARATO_VIEJO).toContain(`'${ID_DEL_AVISO_DE_APARATO_VIEJO}'`);
  });
});

describe('el aviso en la página', () => {
  const sinComentarios = (ruta: string): string =>
    readFileSync(join(RAIZ_WEB, ruta), 'utf8')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');

  it('nace oculto, y el guion va justo detrás, con el nonce de la petición', () => {
    const componente = sinComentarios('src/compatibilidad/AvisoDeAparatoViejo.tsx').replace(
      /\s+/g,
      ' ',
    );
    expect(componente).toContain(
      "<div id={ID_DEL_AVISO_DE_APARATO_VIEJO} style={{ display: 'none' }}>",
    );
    expect(componente).toMatch(
      /<\/div> <script nonce=\{nonce\} dangerouslySetInnerHTML=\{\{ __html: GUION_DEL_AVISO_DE_APARATO_VIEJO \}\} \/>/,
    );
    expect(componente).toContain('Este aparato es demasiado viejo para el POS.');
    expect(componente).toContain('Pide ayuda a tu proveedor.');
  });

  it('el layout raíz lo monta al principio del cuerpo, con su nonce', () => {
    const layout = sinComentarios('app/layout.tsx').replace(/\s+/g, ' ');
    expect(layout).toMatch(/<body> <AvisoDeAparatoViejo nonce=\{nonce\} \/>/);
  });

  it('la hoja no decide si se ve: su regla no lleva `display`', () => {
    const hoja = sinComentarios('app/globals.css');
    const regla = /#aparato-demasiado-viejo \{([^}]*)\}/.exec(hoja)?.[1] ?? '';
    expect(regla).toContain('position: fixed');
    expect(regla).not.toMatch(/\bdisplay\b/);
    expect(hoja).not.toMatch(/@layer[^{]*\{[^}]*#aparato-demasiado-viejo/);
  });
});
