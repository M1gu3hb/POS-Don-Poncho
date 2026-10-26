import type { ReactElement } from 'react';

import { CREDITO_DE_LA_PLATAFORMA, ESTILO_DEL_CREDITO } from './contenido';

/** El crédito discreto de la plataforma, bajo el teclado del acceso. Ver `./contenido.ts`. */
export function CreditoDeMorphiq(): ReactElement {
  return <p className={ESTILO_DEL_CREDITO}>{CREDITO_DE_LA_PLATAFORMA}</p>;
}
