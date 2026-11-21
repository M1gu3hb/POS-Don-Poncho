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
 *
 * ── DP-20 · La app imprime directo ────────────────────────────────────────
 * Si la página corre dentro de la app (`window.MorphiqApp`) y el aparato tiene
 * su impresora configurada, el documento térmico NO pasa por el diálogo: el
 * mismo nodo de la pantalla se dibuja y sale directo (`~/impresion/imprimir-documento`).
 * Sin la app, todo sigue como aquí abajo. En los dos caminos el ticket de una
 * venta se registra antes de salir, y desde la segunda salida dice «REIMPRESIÓN».
 */
import { aislarParaImprimir, documentoAImprimir } from '~/impresion/aislar';
import { ponerCopiasParaElNavegador } from '~/impresion/copias-en-el-navegador';
import {
  LIENZO_TERMICO,
  datosDelDocumento,
  imprimirDirecto,
  registrarSalidaDelTicket,
  salioElPapel,
} from '~/impresion/imprimir-documento';
import { anchoDeLasClases, anchoDelPapel, paginaDeImpresion } from '~/impresion/papel';
import { marcarReimpresion, quitarMarcas } from '~/impresion/termico/decorar';
import { nuevoIdDeTrabajo } from '~/impresion/termico/trabajo';

const SELECTOR = {
  thermal: '.ticket-printable.thermal-58, .ticket-printable.thermal-80',
  letter: '.ticket-printable.letter-doc, .cash-cut-pdf',
};

/** Lo que dice el papel cuando no se pudo registrar su salida: nunca pasa por original. */
const SIN_REGISTRAR = 'Sin conexión: esta salida no quedó registrada';

/** La marca del ticket que sale por el navegador (`null` = es la original). */
async function marcaDelTicket(objetivo) {
  const { tipo, ordenId } = datosDelDocumento(objetivo);
  if (tipo !== 'ticket' || ordenId === null) return { marca: null, ordenId: null };
  try {
    return { marca: await registrarSalidaDelTicket(ordenId, nuevoIdDeTrabajo('ticket')), ordenId };
  } catch (err) {
    console.error('[print] no se pudo registrar la salida del ticket:', err);
    return { marca: SIN_REGISTRAR, ordenId: null };
  }
}

async function imprimirConElNavegador({ modo, title, ancho, objetivo }) {
  const html = document.documentElement;
  const prevMode = html.getAttribute('data-print-mode');
  const prevTitle = document.title;
  const rollo =
    ancho !== undefined
      ? anchoDelPapel(ancho)
      : objetivo
        ? anchoDeLasClases(objetivo.className)
        : anchoDelPapel(undefined);

  const lienzo = modo === 'thermal' && objetivo ? objetivo.querySelector(LIENZO_TERMICO) : null;
  const salida = lienzo ? await marcaDelTicket(objetivo) : { marca: null, ordenId: null };
  if (lienzo && salida.marca !== null) marcarReimpresion(lienzo, salida.marca, rollo);
  // DP-24 · Las copias del negocio, leídas AHORA, también por el diálogo del navegador (la original;
  // una reimpresión es un solo papel).
  const quitarCopias =
    lienzo && salida.marca === null
      ? await ponerCopiasParaElNavegador(lienzo, datosDelDocumento(objetivo).tipo, rollo)
      : () => {};

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
    quitarCopias();
    if (lienzo) quitarMarcas(lienzo);
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  // Pequeño delay para asegurar que los estilos aplicaron
  setTimeout(() => {
    window.print();
    if (salida.ordenId !== null) salioElPapel(salida.ordenId);
    // Fallback por si afterprint no dispara
    setTimeout(cleanup, 1500);
  }, 80);
}

export function printDocument({ mode = 'letter', title = 'Documento', ancho } = {}) {
  const modo = mode === 'thermal' ? 'thermal' : 'letter';
  const objetivo = documentoAImprimir(document, SELECTOR[modo]);
  const conElNavegador = () => {
    void imprimirConElNavegador({ modo, title, ancho, objetivo });
  };

  // DP-20 · Con la app y la impresora del aparato, el ticket sale directo.
  if (
    modo === 'thermal' &&
    objetivo &&
    imprimirDirecto({ objetivo, titulo: title, alNavegador: conElNavegador })
  ) {
    return;
  }
  conElNavegador();
}
