import type { PerfilDeImpresion } from './perfil.ts';
import { aBase64, bytesDelCajon } from './trabajo.ts';

/**
 * El perfil como lo guarda la app: lo de la página, más los bytes del cajón que ella usa. Sin el
 * interruptor del cajón (DP-21 · Bloque 7) la app NO recibe pulso: nada del lado de la app puede
 * abrir un cajón que el aparato no tiene.
 */
export function perfilParaLaApp(perfil: PerfilDeImpresion | null): unknown {
  if (perfil === null) return null;
  return {
    ...perfil,
    cajon:
      !perfil.tieneCajon || perfil.cajon === null
        ? null
        : { ...perfil.cajon, base64: aBase64(bytesDelCajon(perfil.cajon)) },
  };
}
