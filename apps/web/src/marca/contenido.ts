import { MARCA_DE_PLATAFORMA } from './nombre-visible';

/**
 * EL CRÉDITO DE LA PLATAFORMA · «Sistema por Morphiq», sólo en la pantalla de acceso.
 *
 * POS Don Poncho es el sistema DEL restaurante: su logo y su nombre van en todas partes, y
 * Morphiq firma una sola vez, discreto, bajo el teclado del acceso (encargo DP-3). Nada de
 * Morphiq en el ticket del comensal, en el corte ni en el portal QR; `contenido.test.ts` lo
 * comprueba contra los archivos.
 *
 * Vive aparte del componente (`CreditoDeMorphiq.tsx`) para probarse: las pruebas de `apps/web`
 * no transforman JSX.
 */
export const CREDITO_DE_LA_PLATAFORMA = `Sistema por ${MARCA_DE_PLATAFORMA}`;

/**
 * Cómo se pinta: pequeño y apagado, sobre la barra oscura del acceso. Todo en tokens (ni un
 * color ni un tamaño literal, `verify:primitivas`).
 */
export const ESTILO_DEL_CREDITO =
  'mt-(--espacio-6) text-center text-xs tracking-wide text-lateral-texto/60';
