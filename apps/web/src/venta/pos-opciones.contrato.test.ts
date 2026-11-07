import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-14.6-3 · /POS PIDE LAS OPCIONES COMO EL MESERO (revisión del PR #9).
 *
 *   · La pista del producto manda sobre la lectura guardada (DP-D65): si el platillo dice que tiene
 *     opciones y el mapa guardado no conoce sus grupos (se le pusieron después), /pos relee en vivo.
 *     Sin esto, un cajero que sólo usa /pos no podía vender el platillo que ganó un grupo
 *     obligatorio: no se le ofrecía y el servidor lo rechazaba.
 *   · El diálogo se abre SIN el campo de notas: /pos no guarda notas por línea, y ofrecerlo era
 *     prometer lo que se perdía en silencio.
 *
 * `POS.jsx` es heredado: el contrato lee su texto (se valida mutándolo).
 */

const HEREDADO = join(__dirname, '..', '..', 'heredado');
const leer = (ruta: string) => readFileSync(join(HEREDADO, ruta), 'utf8');

describe('/pos y las opciones', () => {
  it('relee en vivo si el producto dice que tiene opciones y lo guardado no las conoce', () => {
    expect(leer('pages/POS.jsx')).toMatch(
      /if \(product\.tiene_opciones === true && !tieneGruposParaOfrecer\(conOpciones\)\) \{\s*conOpciones = conSusOpciones\(\s*\[product\],\s*await queryClient\.fetchQuery\(consultaDeLasOpciones\(\)\),?\s*\)\[0\];/,
    );
  });

  it('abre el diálogo de opciones sin el campo de notas', () => {
    expect(leer('pages/POS.jsx')).toMatch(
      /<SeleccionModificadoresDialog[\s\S]*?conNotas=\{false\}/,
    );
    const dialogo = leer('components/mesero/SeleccionModificadoresDialog.jsx');
    expect(dialogo).toMatch(/conNotas = true/);
    expect(dialogo).toMatch(/\{conNotas \? \(/);
  });
});
