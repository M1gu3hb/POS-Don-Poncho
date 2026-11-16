import type { ReactElement } from 'react';

import {
  GUION_DEL_AVISO_DE_APARATO_VIEJO,
  ID_DEL_AVISO_DE_APARATO_VIEJO,
} from './aviso-de-aparato-viejo.ts';

/**
 * «ESTE APARATO ES DEMASIADO VIEJO» (DP-20.1).
 *
 * El modo compatible alcanza hasta un motor que entienda las capas de CSS (Chromium 99). Por debajo
 * de eso el navegador tira TODA la hoja de Tailwind —vive en `@layer`— y el POS saldría sin
 * estilos, que es peor que no salir: parece roto y nadie sabe por qué. Ahí se enseña este aviso.
 *
 * El aviso nace oculto (`display: none` en línea) y lo enseña un guion de una línea que le pregunta
 * al motor si conoce las capas (`CSSLayerBlockRule`). No mira el nombre del navegador. Va en línea
 * y con sintaxis de siempre: un motor así de viejo puede no ejecutar el JavaScript del POS, pero
 * éste sí.
 *
 * ── Por qué no lo decide la hoja ───────────────────────────────────────────────────────────────
 * Se intentó sin JavaScript: una regla sin capa que lo enseñaba (`display: block !important`) y
 * otra dentro de `@layer` que lo volvía a ocultar; con `!important` las capas ganan a lo que no
 * tiene capa, así que sólo un motor sin capas lo dejaba a la vista. En la hoja real, el Chromium
 * 99.0.4844.0 resolvió ese cruce AL REVÉS y el aviso tapó todo el POS… en el motor más viejo que
 * sí lo pinta bien (lo atrapó `pruebas/e2e/motor-viejo.spec.ts`). Un aviso que puede salir donde
 * no debe es peor que no tenerlo: con el guion, donde hay capas no se enseña nunca.
 *
 * Su aspecto va en `app/globals.css`, fuera de las capas (ahí es donde tiene que verse), y no usa
 * el sistema de diseño a propósito. En un motor moderno no ocupa ni un pixel.
 */

export function AvisoDeAparatoViejo({
  nonce,
}: {
  readonly nonce: string | undefined;
}): ReactElement {
  return (
    <>
      <div id={ID_DEL_AVISO_DE_APARATO_VIEJO} style={{ display: 'none' }}>
        <p>
          <strong>Este aparato es demasiado viejo para el POS.</strong>
        </p>
        <p>Pide ayuda a tu proveedor.</p>
      </div>
      <script
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: GUION_DEL_AVISO_DE_APARATO_VIEJO }}
      />
    </>
  );
}
