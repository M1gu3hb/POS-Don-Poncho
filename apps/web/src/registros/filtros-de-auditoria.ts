import { esGrupoDeAuditoria } from '@morphiqpos/domain/auditoria';

/**
 * DP-15.1 · Lo que «Auditoría» le pide al servidor. El filtro (grupo y día) y la página viajan en
 * la petición: la pantalla no filtra nada por su cuenta. Un filtro vacío o a medio escribir no
 * viaja (el servidor valida estricto y contestaría 400).
 */

export interface FiltrosDeAuditoria {
  /** Un id de grupo, o '' para todos. */
  readonly grupo: string;
  /** `YYYY-MM-DD` (un día del negocio), o '' para cualquier día. */
  readonly fecha: string;
  readonly pagina: number;
}

export interface EntradaDeAuditoria {
  readonly grupo?: string;
  readonly fecha?: string;
  readonly pagina: number;
}

const DIA_COMPLETO = /^\d{4}-\d{2}-\d{2}$/;

export function entradaDeLaAuditoria(filtros: FiltrosDeAuditoria): EntradaDeAuditoria {
  return {
    ...(esGrupoDeAuditoria(filtros.grupo) ? { grupo: filtros.grupo } : {}),
    ...(DIA_COMPLETO.test(filtros.fecha) ? { fecha: filtros.fecha } : {}),
    pagina: filtros.pagina,
  };
}

export const paginaAnterior = (pagina: number): number => Math.max(0, pagina - 1);

export const paginaSiguiente = (pagina: number, hayMas: boolean): number =>
  hayMas ? pagina + 1 : pagina;
