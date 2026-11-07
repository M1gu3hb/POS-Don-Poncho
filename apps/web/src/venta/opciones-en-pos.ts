/**
 * DP-14.6-3 · LAS OPCIONES EN /POS, como en el mesero.
 *
 * El diálogo de opciones (`SeleccionModificadoresDialog`) devuelve los grupos con lo elegido
 * (`{ grupo_id, opciones: [{ id, nombre }] }`); al servidor viajan sólo los ids
 * (`venta.agregar_linea` · `opciones`), y es él quien decide si falta algo obligatorio.
 */

export interface ModificadorElegido {
  readonly grupo_id: string;
  readonly opciones: readonly { readonly id: string }[];
}

export interface EleccionParaElServidor {
  readonly grupoId: string;
  readonly opcionIds: readonly string[];
}

/** Lo que el diálogo eligió, en la forma del comando. Un grupo sin nada elegido no viaja. */
export function opcionesParaElComando(
  eleccion: { readonly modificadores?: readonly ModificadorElegido[] | undefined } | undefined,
): readonly EleccionParaElServidor[] {
  return (eleccion?.modificadores ?? [])
    .filter((m) => m.opciones.length > 0)
    .map((m) => ({ grupoId: m.grupo_id, opcionIds: m.opciones.map((o) => o.id) }));
}

/** ¿El platillo tiene algún grupo con opciones activas que ofrecer? */
export function tieneGruposParaOfrecer(
  producto: { readonly modificadores?: readonly Grupo[] | undefined } | null | undefined,
): boolean {
  return (producto?.modificadores ?? []).some(
    (g) =>
      g.activo !== false &&
      g.nombre.trim() !== '' &&
      g.opciones.some((o) => o.activo !== false && o.nombre.trim() !== ''),
  );
}

interface Grupo {
  readonly nombre: string;
  readonly activo?: boolean | undefined;
  readonly opciones: readonly { readonly nombre: string; readonly activo?: boolean | undefined }[];
}
