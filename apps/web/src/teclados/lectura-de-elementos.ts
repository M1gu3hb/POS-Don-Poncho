import { isValidElement, type ReactElement, type ReactNode } from 'react';

/**
 * CÓMO SE LEE UN COMPONENTE SIN NAVEGADOR, para las pruebas de los teclados.
 *
 * Las pruebas de `apps/web/src` corren en Node y bajo la condición `react-server`, donde
 * `react-dom/server` lanza al importarse y no hay DOM ni Testing Library. Un teclado es una
 * función sin estado: se LLAMA, devuelve el árbol de elementos de React, y ese árbol se lee —su
 * nombre accesible, sus atributos— y se pulsa llamando al `onClick` que de verdad lleva. Es el
 * mismo componente que corre en la tableta, sin la pantalla.
 */

/** Un elemento y sus atributos, tal como React los recibirá. */
export interface Elemento {
  readonly tipo: unknown;
  readonly props: Readonly<Record<string, unknown>>;
}

function hijosDe(nodo: ReactNode): ReactNode[] {
  if (Array.isArray(nodo)) return (nodo as ReactNode[]).flatMap(hijosDe);
  return nodo === null || nodo === undefined || typeof nodo === 'boolean' ? [] : [nodo];
}

function propsDe(elemento: ReactElement): Readonly<Record<string, unknown>> {
  return elemento.props as Readonly<Record<string, unknown>>;
}

/** Todos los elementos del árbol, en el orden en que se pintarían. */
export function aplanar(nodo: ReactNode): Elemento[] {
  const salida: Elemento[] = [];
  for (const hijo of hijosDe(nodo)) {
    if (!isValidElement(hijo)) continue;
    const props = propsDe(hijo);
    salida.push({ tipo: hijo.type, props });
    salida.push(...aplanar(props['children'] as ReactNode));
  }
  return salida;
}

/** El texto que se lee dentro de un elemento (sin los iconos, que no llevan texto). */
export function textoDe(nodo: ReactNode): string {
  return hijosDe(nodo)
    .map((hijo) => {
      if (typeof hijo === 'string' || typeof hijo === 'number') return String(hijo);
      if (!isValidElement(hijo)) return '';
      return textoDe(propsDe(hijo)['children'] as ReactNode);
    })
    .join('');
}

/** El nombre accesible de un control: su `aria-label` o, si no tiene, lo que dice. */
export function nombreDe(elemento: Elemento): string {
  const etiqueta = elemento.props['aria-label'];
  return typeof etiqueta === 'string' ? etiqueta : textoDe(elemento.props['children'] as ReactNode);
}

/**
 * Pulsa un control: llama al `onClick` que lleva, si lleva uno. Como el navegador, un botón
 * `disabled` no recibe el toque; uno con sólo `aria-disabled` sí (por eso lo ignora su código).
 */
export function pulsar(elemento: Elemento): void {
  if (elemento.props['disabled'] === true) return;
  const alPulsar = elemento.props['onClick'];
  if (typeof alPulsar === 'function') (alPulsar as () => void)();
}
