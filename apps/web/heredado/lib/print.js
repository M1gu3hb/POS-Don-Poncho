'use client';
/**
 * Helper único para impresión.
 * Evita que el navegador imprima cabeceras/URL extras y separa los modos
 * de papel (térmico 58/80 mm vs carta) usando el atributo data-print-mode
 * en <html>. El CSS en index.css se encarga del resto.
 *
 * ── El tamaño de página, que antes no funcionaba ──────────────────────────
 * `index.css` intentaba fijarlo con
 * `html[data-print-mode='thermal'] @page { size: 80mm auto }`. Eso es CSS
 * inválido: `@page` es un contexto de página y no admite selector, así que el
 * navegador lo descartaba y el ticket térmico salía en tamaño carta.
 *
 * La única forma de cambiar `@page` según el modo es inyectar la regla a nivel
 * raíz justo antes de imprimir y quitarla después. Es lo que se hace aquí.
 *
 * ── DP-15 · 58 mm y sin hojas en blanco ───────────────────────────────────
 * El rollo (58 u 80 mm) lo dice el propio ticket por su clase (`thermal-58` /
 * `thermal-80`, de `ancho_papel_ticket`), o `ancho` si quien llama lo sabe. Y
 * el documento se AÍSLA (`~/impresion/aislar`): lo demás sale del flujo, no sólo
 * se esconde, para que el ticket salga desde arriba de la primera hoja.
 */
import { aislarParaImprimir, documentoAImprimir } from '~/impresion/aislar';
import { anchoDeLasClases, anchoDelPapel, paginaDeImpresion } from '~/impresion/papel';

const SELECTOR = {
  thermal: '.ticket-printable.thermal-58, .ticket-printable.thermal-80',
  letter: '.ticket-printable.letter-doc, .cash-cut-pdf',
};

export function printDocument({ mode = 'letter', title = 'Documento', ancho } = {}) {
  const html = document.documentElement;
  const prevMode = html.getAttribute('data-print-mode');
  const prevTitle = document.title;
  const modo = mode === 'thermal' ? 'thermal' : 'letter';

  const objetivo = documentoAImprimir(document, SELECTOR[modo]);
  const rollo =
    ancho !== undefined
      ? anchoDelPapel(ancho)
      : objetivo
        ? anchoDeLasClases(objetivo.className)
        : anchoDelPapel(undefined);

  html.setAttribute('data-print-mode', modo);
  document.title = title;

  const hoja = document.createElement('style');
  hoja.setAttribute('data-pagina-de-impresion', modo);
  hoja.textContent = paginaDeImpresion(modo, rollo);
  document.head.appendChild(hoja);

  const deshacerAislado = objetivo ? aislarParaImprimir(document, objetivo) : () => {};

  const cleanup = () => {
    if (prevMode) html.setAttribute('data-print-mode', prevMode);
    else html.removeAttribute('data-print-mode');
    document.title = prevTitle;
    hoja.remove();
    deshacerAislado();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  // Pequeño delay para asegurar que los estilos aplicaron
  setTimeout(() => {
    window.print();
    // Fallback por si afterprint no dispara
    setTimeout(cleanup, 1500);
  }, 80);
}
