'use client';

import { memo, type ReactElement } from 'react';

import { TeselaDeLaRejilla } from './TeselaDeLaRejilla';
import { TeselaDelPlano, type TeselaDelPlanoProps } from './TeselaDelPlano';
import type { FormaDelSalon } from './tipos-del-salon';

/**
 * UNA MESA DEL SALÓN, en el plano o en la rejilla (`forma`).
 *
 * Está memoizada y sus propiedades son todas estables entre dibujos: la mesa es el mismo objeto
 * mientras no cambie, `alTocar` y `alAtender` no cambian, y lo que antes era un elemento nuevo en
 * cada dibujo (los globos) llega como la lista de solicitudes de ESA mesa. Así, abrir una mesa
 * redibuja la que se abrió y la que se cerró, no las veinte del plano; y el sondeo de 5 s de las
 * mesas sólo toca las que cambiaron.
 */
export type TeselaDeMesaProps = TeselaDelPlanoProps & { readonly forma: FormaDelSalon };

function TeselaDeMesaSinMemo({ forma, ...resto }: TeselaDeMesaProps): ReactElement {
  return forma === 'plano' ? <TeselaDelPlano {...resto} /> : <TeselaDeLaRejilla {...resto} />;
}

export const TeselaDeMesa = memo(TeselaDeMesaSinMemo);
