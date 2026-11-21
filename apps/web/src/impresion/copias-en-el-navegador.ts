/**
 * LAS COPIAS CUANDO EL TICKET SALE POR EL DIÁLOGO DEL NAVEGADOR (DP-24 · Parte 6.1). Sólo navegador.
 *
 * Por la app, cada copia es una imagen del trabajo. Por el navegador sólo salía UNA hoja, sin
 * importar las copias del negocio. Aquí se lee cuántas van (al momento, con la misma función de la
 * app) y se ponen detrás del original, cada una en su página y con su pie.
 */
import type { AnchoDelPapel } from './papel.ts';
import { copiasAlImprimir } from './copias-al-imprimir.ts';
import { copiasDe, type DocumentoTermico } from './copias.ts';
import { ponerPie } from './termico/decorar.ts';
import { pieDeLaCopia } from './termico/estilo.ts';

/**
 * Deja `lienzo` seguido de sus copias. Devuelve la función que las quita (las del original las
 * quita `quitarMarcas`, como siempre).
 */
export async function ponerCopiasParaElNavegador(
  lienzo: HTMLElement,
  tipo: DocumentoTermico,
  papel: AnchoDelPapel,
): Promise<() => void> {
  const { copias } = await copiasAlImprimir();
  const total = copiasDe(copias, tipo);
  const clones: HTMLElement[] = [];
  let anterior: HTMLElement = lienzo;
  for (let i = 1; i < total; i += 1) {
    const copia = lienzo.cloneNode(true) as HTMLElement;
    copia.style.breakBefore = 'page';
    copia.style.setProperty('page-break-before', 'always');
    anterior.after(copia);
    clones.push(copia);
    anterior = copia;
  }
  [lienzo, ...clones].forEach((hoja, indice) => {
    const pie = pieDeLaCopia(indice + 1, total);
    if (pie !== null) ponerPie(hoja, pie, papel);
  });
  return () => {
    for (const copia of clones) copia.remove();
  };
}
