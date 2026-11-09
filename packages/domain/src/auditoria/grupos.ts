/**
 * DP-15.1 · LOS GRUPOS DE ACCIÓN DE LA AUDITORÍA.
 *
 * Registros → «Auditoría» filtra EN EL SERVIDOR por grupo: el dueño busca «los cambios de PIN», no
 * el nombre de un comando. Cada grupo es una lista cerrada de nombres de comando REALES del
 * catálogo (un contrato en `packages/app` comprueba que todos existen: si se renombra un comando,
 * el grupo no se queda mirando a la nada). Una acción cae en un solo grupo. Puro.
 */

export interface GrupoDeAuditoria {
  readonly titulo: string;
  readonly acciones: readonly string[];
}

export const GRUPOS_DE_AUDITORIA = {
  pin_y_usuarios: {
    titulo: 'PIN y usuarios',
    acciones: ['identidad.establecer_pin', 'identidad.guardar_empleado'],
  },
  agotado: {
    titulo: 'Agotado',
    acciones: ['catalogo.marcar_agotado'],
  },
  renombres: {
    titulo: 'Renombres de caja',
    acciones: ['caja.nombrar_terminal'],
  },
  descuentos: {
    titulo: 'Descuentos',
    acciones: [
      'configuracion.permitir_descuentos',
      'venta.aplicar_descuento',
      'restaurante.descontar_cuenta',
    ],
  },
  cancelaciones: {
    titulo: 'Cancelaciones',
    acciones: ['restaurante.cancelar_orden', 'restaurante.anular_linea', 'venta.devolver_venta'],
  },
  efectivo: {
    titulo: 'Movimientos de efectivo',
    acciones: ['caja.movimiento', 'caja.entrada_cambio'],
  },
  configuracion: {
    titulo: 'Cambios de configuración',
    acciones: [
      'configuracion.guardar',
      'configuracion.fijar_apariencia',
      'configuracion.fijar_modulo',
      'configuracion.restablecer_modulo',
      'configuracion.fijar_termino',
      'configuracion.restablecer_termino',
      'caja.fijar_cajas_simultaneas',
      'propinas.guardar_esquema',
    ],
  },
} as const satisfies Readonly<Record<string, GrupoDeAuditoria>>;

export type IdDeGrupoDeAuditoria = keyof typeof GRUPOS_DE_AUDITORIA;

/** Los ids en el orden en que se enseñan; sirve de lista cerrada para validar la entrada. */
export const IDS_DE_GRUPOS_DE_AUDITORIA = Object.keys(GRUPOS_DE_AUDITORIA) as [
  IdDeGrupoDeAuditoria,
  ...IdDeGrupoDeAuditoria[],
];

export function esGrupoDeAuditoria(valor: string): valor is IdDeGrupoDeAuditoria {
  return Object.hasOwn(GRUPOS_DE_AUDITORIA, valor);
}

export function accionesDelGrupo(grupo: IdDeGrupoDeAuditoria): readonly string[] {
  return GRUPOS_DE_AUDITORIA[grupo].acciones;
}

/** El grupo al que pertenece una acción, o nulo si ninguno la reclama. */
export function grupoDeLaAccion(accion: string): IdDeGrupoDeAuditoria | null {
  return IDS_DE_GRUPOS_DE_AUDITORIA.find((id) => accionesDelGrupo(id).includes(accion)) ?? null;
}
