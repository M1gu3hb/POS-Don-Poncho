/**
 * «DAR PERMISO A LA IMPRESORA» DESDE EL AVISO DE ERROR (DP-24 · Parte 6.2). Puro.
 *
 * El iMin (Android) pide el permiso del USB cada que se prende. Antes había que ir a Configuración →
 * Hardware con la contraseña del proveedor; pedirle el permiso de USB al sistema no es una
 * operación del proveedor, así que el botón del aviso lo pide directo con `pedirPermiso(destino)`
 * del puente y, si lo dan, reintenta la MISMA impresión.
 */
import type { Destino, MorphiqApp } from './puente/contrato.ts';
import { mensajeDe } from './trabajos.ts';

export interface ResultadoDelPermiso {
  readonly concedido: boolean;
  /** Lo que se le dice a la persona: «Permiso concedido ✓» o por qué no. */
  readonly texto: string;
}

export const TEXTO_PERMISO_CONCEDIDO = 'Permiso concedido ✓';
export const TEXTO_PERMISO_NEGADO = 'No se dio el permiso.';
export const TEXTO_PERMISO_SIN_RESPUESTA = 'No se pudo pedir el permiso. Reintenta.';

export type PedirPermiso = () => Promise<{
  readonly concedido: boolean;
  readonly mensaje?: string;
}>;

/** Pide el permiso y lo dice con palabras; jamás lanza. */
export async function darPermiso(pedir: PedirPermiso): Promise<ResultadoDelPermiso> {
  try {
    const respuesta = await pedir();
    if (respuesta.concedido) return { concedido: true, texto: TEXTO_PERMISO_CONCEDIDO };
    const motivo = respuesta.mensaje;
    return {
      concedido: false,
      texto: motivo !== undefined && motivo !== '' ? motivo : TEXTO_PERMISO_NEGADO,
    };
  } catch (error: unknown) {
    return { concedido: false, texto: mensajeDe(error) ?? TEXTO_PERMISO_SIN_RESPUESTA };
  }
}

/** El permiso de ESA impresora (la del perfil del aparato). */
export function pedirElPermisoDe(app: MorphiqApp, destino: Destino): PedirPermiso {
  return () => app.pedirPermiso(destino);
}
