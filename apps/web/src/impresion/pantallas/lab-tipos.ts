import type { Errores, FormularioDelPerfil } from './formulario.ts';

export type CambioDelFormulario = (formulario: FormularioDelPerfil) => FormularioDelPerfil;

/** Lo que recibe cada sección del laboratorio que edita el perfil. */
export interface PropsDelFormulario {
  readonly formulario: FormularioDelPerfil;
  readonly errores: Errores;
  readonly actualizar: (cambio: CambioDelFormulario) => void;
}

/** Un cambio que sólo pone unos campos. */
export const poniendo =
  (parche: Partial<FormularioDelPerfil>): CambioDelFormulario =>
  (formulario) => ({ ...formulario, ...parche });

/** El primer error del formulario, para decirlo junto a los botones que no se pueden usar. */
export function primerProblema(errores: Errores): string | null {
  return Object.values(errores).find((mensaje) => mensaje !== '') ?? null;
}
