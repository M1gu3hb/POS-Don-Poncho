import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-23 · EL TOQUE SEGURO: ningún botón que AGREGA al pedido usa un `onClick` crudo.
 *
 * La decisión (qué es un toque) tiene su prueba unitaria (`toque-seguro.test.ts`) y el gesto de
 * verdad lo prueba `pruebas/e2e/qa-final/toque-seguro-del-mesero.spec.ts`. Esto comprueba que está
 * CONECTADA: cada ficha de platillo y cada + / – del pedido es un `BotonQueAgrega` (o lleva los
 * manejadores del gancho), y que no queda en ningún lado un `onClick={…agregarAlCarrito…}`. Se
 * ata al USO: lo que cada etiqueta JSX conecta a su `onClick`, sin comentarios. Se valida mutando
 * el código real (la lista de mutaciones va en el mensaje del commit).
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

/** Sin comentarios de bloque ni de línea (un `// …` pegado a una URL no se toca). */
function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\w'"`])\/\/[^\n]*/g, '$1');
}

/** Los atributos de cada etiqueta de apertura `<nombre …>`, con las llaves y comillas bien cerradas. */
function aperturas(codigo: string, nombre: string): string[] {
  const salida: string[] = [];
  const inicio = new RegExp(`<${nombre}(?=[\\s>/])`, 'g');
  for (let m = inicio.exec(codigo); m !== null; m = inicio.exec(codigo)) {
    let i = m.index + m[0].length;
    let llaves = 0;
    let comilla: string | null = null;
    for (; i < codigo.length; i += 1) {
      const c = codigo[i] ?? '';
      if (comilla !== null) {
        if (c === comilla) comilla = null;
      } else if (c === '"' || c === "'" || c === '`') comilla = c;
      else if (c === '{') llaves += 1;
      else if (c === '}') llaves -= 1;
      else if (c === '>' && llaves === 0 && codigo[i - 1] !== '=') break;
    }
    salida.push(codigo.slice(m.index + m[0].length, i));
  }
  return salida;
}

/** Lo que agrega (o suma y resta) al pedido: si un `onClick` lo llama, es un botón que agrega. */
const ACCIONES_QUE_AGREGAN =
  /\b(agregarAlCarrito|addToCart|onTocar|onAdd|cambiarCantidad|onCambiarCantidad)\b/;

const ETIQUETAS_CRUDAS = ['button', 'Button', 'Card'] as const;

function ficheros(carpeta: string): string[] {
  return readdirSync(join(RAIZ, carpeta)).flatMap((nombre) => {
    const ruta = join(carpeta, nombre);
    if (statSync(join(RAIZ, ruta)).isDirectory()) return ficheros(ruta);
    return /\.(jsx|tsx)$/.test(nombre) && !nombre.includes('.test.') ? [ruta] : [];
  });
}

const TODOS = [...ficheros('heredado'), ...ficheros('src')].map((r) => r.replaceAll('\\', '/'));

describe('ningún botón que agrega al pedido usa onClick crudo', () => {
  it('encuentra los archivos (la búsqueda no está ciega)', () => {
    expect(TODOS.length).toBeGreaterThan(100);
    expect(TODOS).toContain('heredado/pages/Mesero.jsx');
  });

  it('en todo el código de las pantallas, ninguna etiqueta cruda llama a una acción que agrega desde su onClick', () => {
    const culpables: string[] = [];
    for (const archivo of TODOS) {
      const codigo = sinComentarios(leer(archivo));
      for (const etiqueta of ETIQUETAS_CRUDAS) {
        for (const atributos of aperturas(codigo, etiqueta)) {
          const alClic = /\bonClick=\{([\s\S]*)\}/.exec(atributos);
          if (alClic !== null && ACCIONES_QUE_AGREGAN.test(alClic[1] ?? '')) {
            culpables.push(`${archivo} · <${etiqueta} onClick=…>`);
          }
        }
      }
    }
    expect(culpables).toEqual([]);
  });
});

/** Cada superficie que agrega, con cuántos botones seguros tiene y qué acción conectan. */
const SUPERFICIES: readonly {
  readonly archivo: string;
  readonly cuantos: number;
  readonly acciones: readonly RegExp[];
}[] = [
  {
    archivo: 'heredado/pages/Mesero.jsx',
    cuantos: 1,
    acciones: [/alAgregar=\{\(\) => agregarAlCarrito\(p\)\}/],
  },
  {
    archivo: 'heredado/components/mesero/ProductoFichaExpandible.jsx',
    cuantos: 3,
    acciones: [
      /alAgregar=\{\(\) => onCambiarCantidad && onCambiarCantidad\(item\.id, -1\)\}/,
      /alAgregar=\{\(\) => onCambiarCantidad && onCambiarCantidad\(item\.id, 1\)\}/,
    ],
  },
  {
    archivo: 'heredado/components/mesero/MesaActivaView.jsx',
    cuantos: 3,
    acciones: [/alAgregar=\{\(\) => agregarAlCarrito\?\.\(p\)\}/],
  },
  {
    archivo: 'heredado/components/pedido/CatalogoDelPedido.jsx',
    cuantos: 1,
    acciones: [/alAgregar=\{\(\) => onTocar\(p\)\}/],
  },
  {
    archivo: 'heredado/components/portalqr/ProductoQRDialog.jsx',
    cuantos: 3,
    acciones: [
      /alAgregar=\{\(\) => cambiarCantidad\(-1\)\}/,
      /alAgregar=\{\(\) => cambiarCantidad\(1\)\}/,
      /alAgregar=\{submit\}/,
    ],
  },
  {
    archivo: 'src/portal/menu-digital/MenuDigital.tsx',
    cuantos: 1,
    acciones: [/alAgregar=\{alTocar\}/],
  },
  {
    archivo: 'src/portal/menu-digital/MenuALaCarta.tsx',
    cuantos: 1,
    acciones: [/alAgregar=\{alTocar\}/],
  },
];

describe('cada superficie que agrega usa el botón seguro', () => {
  it.each(SUPERFICIES)('$archivo', ({ archivo, cuantos, acciones }) => {
    const codigo = sinComentarios(leer(archivo));
    const botones = aperturas(codigo, 'BotonQueAgrega');
    expect(botones).toHaveLength(cuantos);
    for (const atributos of botones) expect(atributos).not.toMatch(/\bonClick=/);
    for (const accion of acciones) expect(codigo).toMatch(accion);
    expect(codigo).toMatch(/from '~\/tacto\/BotonQueAgrega'/);
  });

  it('la tarjeta de Caja (`ProductCard`) lleva los manejadores del gancho y ningún onClick', () => {
    const codigo = sinComentarios(leer('heredado/components/pos/ProductCard.jsx'));
    expect(codigo).toMatch(/const toqueSeguro = useToqueSeguro\(\(\) => onAdd\(product\)\);/);
    const [tarjeta] = aperturas(codigo, 'Card');
    expect(tarjeta).toMatch(/\{\.\.\.toqueSeguro\}/);
    expect(tarjeta).not.toMatch(/\bonClick=/);
  });

  it('las fichas no se encogen bajo el dedo: sin `active:scale` en las que agregan', () => {
    for (const { archivo } of SUPERFICIES) {
      for (const atributos of aperturas(sinComentarios(leer(archivo)), 'BotonQueAgrega')) {
        // «Agregar» del diálogo del comensal es un botón fijo al pie, no una ficha de una lista.
        if (atributos.includes('alAgregar={submit}')) continue;
        expect(atributos, archivo).not.toMatch(/active:scale/);
      }
    }
    const tarjeta = aperturas(
      sinComentarios(leer('heredado/components/pos/ProductCard.jsx')),
      'Card',
    )[0];
    expect(tarjeta).not.toMatch(/active:scale/);
  });
});

describe('el botón seguro y su gancho', () => {
  const boton = sinComentarios(leer('src/tacto/BotonQueAgrega.tsx'));
  const gancho = sinComentarios(leer('src/tacto/use-toque-seguro.ts'));

  it('el botón es un <button> con los manejadores del gancho puestos DESPUÉS del resto de propiedades', () => {
    const [apertura] = aperturas(boton, 'button');
    expect(apertura).toMatch(/\{\.\.\.resto\} \{\.\.\.toque\}/);
    expect(boton).toMatch(/useToqueSeguro\(alAgregar,/);
  });

  it('el gancho entrega pointerdown, keydown y click, y el click decide con `decidirToque`', () => {
    expect(gancho).toMatch(/return \{ onPointerDown, onKeyDown, onClick \};/);
    expect(gancho).toMatch(/decidirToque\(/);
    expect(gancho).toMatch(/if \(!decision\.agrega\) return;/);
  });

  it('Enter sostenido no se repite', () => {
    expect(gancho).toMatch(
      /e\.repeat && \(e\.key === 'Enter' \|\| e\.key === ' '\)\) e\.preventDefault\(\)/,
    );
  });

  it('mientras la acción devuelve una promesa pendiente, no entra otro toque', () => {
    expect(gancho).toMatch(/enCurso\.current = true;/);
    expect(gancho).toMatch(/resultado\.then\(liberar, liberar\)/);
  });

  it('mide lo que la decisión pide: alejamiento, desplazamiento, duración y cancelación', () => {
    expect(gancho).toMatch(/document\.addEventListener\('scroll', alDesplazar, true\)/);
    expect(gancho).toMatch(/document\.addEventListener\('pointercancel', alTerminar, true\)/);
    expect(gancho).toMatch(
      /sumaDeDesplazamientos\(e\.currentTarget\) !== m\.desplazamientoInicial/,
    );
  });
});

describe('la rejilla desplaza con el dedo y vuelve arriba', () => {
  const css = leer('src/tacto/toque-seguro.css');

  it('la importa la hoja global', () => {
    expect(leer('app/globals.css')).toMatch(/@import '\.\.\/src\/tacto\/toque-seguro\.css';/);
  });

  it('touch-action: pan-y y overscroll-behavior: contain, sólo en las rejillas marcadas', () => {
    const sin = sinComentarios(css);
    expect(sin).toMatch(
      /\[data-rejilla-de-platillos\] \{[^}]*touch-action: pan-y;[^}]*overscroll-behavior: contain;/,
    );
  });

  it.each([
    'heredado/pages/Mesero.jsx',
    'heredado/components/pedido/CatalogoDelPedido.jsx',
    'heredado/components/mesero/MesaActivaView.jsx',
    'heredado/pages/POS.jsx',
  ])('%s marca su rejilla', (archivo) => {
    expect(leer(archivo)).toMatch(/data-rejilla-de-platillos=""/);
  });

  it.each(['heredado/pages/Mesero.jsx', 'heredado/components/pedido/CatalogoDelPedido.jsx'])(
    '%s vuelve arriba al cambiar de categoría o búsqueda',
    (archivo) => {
      const codigo = sinComentarios(leer(archivo));
      expect(codigo).toMatch(
        /const rejillaRef = useRejillaQueVuelveArriba\(`\$\{\w+\}\|\$\{\w+\}`\);/,
      );
      expect(codigo).toMatch(/ref=\{rejillaRef\}/);
    },
  );
});
