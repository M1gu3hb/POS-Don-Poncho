import type { CSSProperties, ReactElement } from 'react';

/**
 * «ESTE APARATO ES DEMASIADO VIEJO» (DP-20.1).
 *
 * El modo compatible alcanza hasta un motor que entienda las capas de CSS (Chromium 99). Por debajo
 * de eso el navegador tira TODA la hoja de Tailwind —vive en `@layer`— y el POS saldría sin
 * estilos, que es peor que no salir: parece roto y nadie sabe por qué. Ahí se enseña este aviso.
 *
 * No se detecta el navegador ni se usa JavaScript (un motor así de viejo puede no ejecutar el del
 * POS). Lo decide la propia hoja, en `app/globals.css`:
 *
 *   - el aviso nace oculto, con `display: none` en línea: si la hoja no llega a cargar, no sale;
 *   - una regla SIN capa lo enseña (`display: block !important`);
 *   - otra, dentro de `@layer`, lo vuelve a ocultar (`display: none !important`). Con `!important`
 *     las capas ganan a lo que no tiene capa, así que en cualquier motor que las entienda queda
 *     oculto. El que no las entiende descarta ese bloque entero… y el aviso se queda a la vista.
 *
 * Sus estilos van en línea y con propiedades de siempre: tiene que verse bien justo donde nada de
 * lo demás funciona. En un motor moderno no ocupa ni un pixel.
 */

export const ID_DEL_AVISO_DE_APARATO_VIEJO = 'aparato-demasiado-viejo';

const ESTILO: CSSProperties = {
  display: 'none',
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  zIndex: 2147483647,
  boxSizing: 'border-box',
  padding: '18vh 8vw 0',
  backgroundColor: '#161614',
  color: '#f4efe6',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  fontSize: '26px',
  lineHeight: 1.4,
  textAlign: 'center',
};

export function AvisoDeAparatoViejo(): ReactElement {
  return (
    <div id={ID_DEL_AVISO_DE_APARATO_VIEJO} role="alert" style={ESTILO}>
      <p style={{ margin: 0, fontWeight: 700 }}>Este aparato es demasiado viejo para el POS.</p>
      <p style={{ margin: '12px 0 0' }}>Pide ayuda a tu proveedor.</p>
    </div>
  );
}
