import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { conSusOpciones, type GrupoDelPlatillo } from './opciones-de-los-platillos';

/**
 * QA1-4 (DP-13.5) · EL MESERO Y EL EDITOR VEN LAS OPCIONES DE CADA PLATILLO.
 *
 * El puente no trae `modificadores`: el mesero mandaba a cocina la quesadilla sin su relleno
 * obligatorio, porque el diálogo de opciones sólo se abre si el producto los trae.
 */

const RELLENO: GrupoDelPlatillo = {
  id: 'g-relleno',
  nombre: 'Relleno',
  obligatorio: true,
  tipo: 'unica',
  activo: true,
  opciones: [{ id: 'o-pollo', nombre: 'Pollo', activo: true }],
};

describe('conSusOpciones', () => {
  it('pega a cada producto sus grupos, y la lista vacía al que no tiene', () => {
    const productos = conSusOpciones(
      [
        { id: 'quesadilla', nombre: 'Quesadilla' },
        { id: 'agua', nombre: 'Agua' },
      ],
      { quesadilla: [RELLENO] },
    );
    expect(productos).toEqual([
      { id: 'quesadilla', nombre: 'Quesadilla', modificadores: [RELLENO] },
      { id: 'agua', nombre: 'Agua', modificadores: [] },
    ]);
  });
});

const HEREDADO = join(__dirname, '..', '..', 'heredado');
const leer = (ruta: string) => readFileSync(join(HEREDADO, ruta), 'utf8');

describe('las pantallas que leen producto.modificadores los reciben', () => {
  it.each(['pages/Mesero.jsx', 'pages/Productos.jsx'])(
    '%s pega las opciones a sus productos y no actúa antes de tenerlas',
    (ruta) => {
      const fuente = leer(ruta);
      expect(fuente).toMatch(/conSusOpciones\(\s*Array\.isArray\(productos\)/);
      // Mesero decide con `esperaLaLectura`; Productos, con su propio `if (!opcionesListas`.
      expect(fuente).toMatch(/if \(!opcionesListas|esperaLaLectura = opcionesListas/);
    },
  );

  it('si el mesero toca antes de que lleguen, las espera: el toque no se pierde', () => {
    expect(leer('pages/Mesero.jsx')).toMatch(
      /const esperaLaLectura = opcionesListas\s*\? sinSusGrupos\s*: pideOpciones\(productoTocado, undefined\) !== 'no';\s*if \(esperaLaLectura\) \{[\s\S]*?try \{\s*const opciones = opcionesListas\s*\? await queryClient\.fetchQuery\(consultaDeLasOpciones\(\)\)\s*: await queryClient\.ensureQueryData\(consultaDeLasOpciones\(\)\);[\s\S]*?producto = conSusOpciones\(\[productoTocado\], opciones\)\[0\];/,
    );
  });

  it('DP-14.6-3 · el mesero manda la elección estructurada, no sólo en la nota', () => {
    // La línea que viaja a `enviar_pedido` lleva `opciones` (grupo y opciones elegidas) de lo que
    // el diálogo devolvió: el servidor la valida y la guarda sin leerla de la nota.
    expect(leer('pages/Mesero.jsx')).toMatch(
      /const opciones = opcionesParaElComando\(\{ modificadores: item\._modificadores \}\);\s*if \(opciones\.length > 0\) linea\.opciones = opciones;\s*if \(\s*variableSnap/,
    );
  });

  it('el mesero arma su lista con las opciones pegadas', () => {
    expect(leer('pages/Mesero.jsx')).toMatch(
      /const productosArr = useMemo\(\s*\(\) => conSusOpciones/,
    );
  });

  it('guardar las opciones vuelve a leerlas', () => {
    // DP-16 · El editor de grupos (Productos → «Opciones») sustituyó al diálogo heredado.
    const editor = readFileSync(
      join(HEREDADO, '..', 'src', 'catalogo', 'opciones', 'OpcionesDelPlatilloDialog.tsx'),
      'utf8',
    );
    expect(editor).toMatch(/invalidateQueries\(\{ queryKey: CLAVE_DE_LAS_OPCIONES \}\)/);
  });
});
