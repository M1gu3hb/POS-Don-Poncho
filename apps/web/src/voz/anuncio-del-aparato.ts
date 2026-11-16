/**
 * DP-21 · Bloque 8 · «ESTA PANTALLA ANUNCIA LAS COMANDAS», DE ESTE APARATO.
 *
 * Si dos aparatos enseñan la misma estación y los dos hablan, la cocina oye cada comanda dos veces
 * («lo repite 3 o 4 veces»). Un interruptor por aparato, como el modo espera: vive en el aparato
 * y no en el negocio, y se enciende sólo en la pantalla principal de cada estación. Por omisión
 * está ENCENDIDO: una cocina que hoy habla no se queda muda al actualizar. Si el navegador niega
 * el almacén, lo de omisión.
 */
export const CLAVE_DEL_ANUNCIO = 'morphiqpos.cocina-anuncia';

export const ANUNCIO_DE_OMISION = true;

interface Lector {
  getItem(clave: string): string | null;
}
interface Escritor {
  setItem(clave: string, valor: string): void;
}

export function leerAnuncioDelAparato(almacen: Lector | null): boolean {
  try {
    const texto = almacen?.getItem(CLAVE_DEL_ANUNCIO) ?? null;
    if (texto === null) return ANUNCIO_DE_OMISION;
    const leido: unknown = JSON.parse(texto);
    if (typeof leido !== 'object' || leido === null) return ANUNCIO_DE_OMISION;
    const { anuncia } = leido as { anuncia?: unknown };
    return typeof anuncia === 'boolean' ? anuncia : ANUNCIO_DE_OMISION;
  } catch {
    // Ventana privada, datos bloqueados o un valor roto: lo de omisión, sin callar a la cocina.
    return ANUNCIO_DE_OMISION;
  }
}

/** Guarda el interruptor; `false` si el navegador no dejó (la pantalla lo dice). */
export function guardarAnuncioDelAparato(almacen: Escritor | null, anuncia: boolean): boolean {
  if (almacen === null) return false;
  try {
    almacen.setItem(CLAVE_DEL_ANUNCIO, JSON.stringify({ anuncia }));
    return true;
  } catch {
    return false;
  }
}
