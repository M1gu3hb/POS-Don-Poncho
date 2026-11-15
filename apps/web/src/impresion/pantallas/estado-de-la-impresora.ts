/**
 * EL ESTADO DE LA IMPRESORA, DICHO PARA UNA PERSONA (DP-20 · laboratorio). Puro.
 *
 * La app contesta con banderas (`sinPapel`, `tapaAbierta`…); aquí se vuelven renglones con su
 * palabra —el color nunca va solo— y un resumen de una frase.
 */
import type { EstadoDeImpresora } from '../puente/contrato.ts';

export interface RenglonDeEstado {
  readonly etiqueta: string;
  readonly valor: string;
  /** `true` bien, `false` mal, `null` es sólo un dato. */
  readonly bien: boolean | null;
}

export interface EstadoParaLeer {
  readonly soportado: boolean;
  /** Soportado y sin nada mal: la impresora está lista. */
  readonly sinProblemas: boolean;
  readonly resumen: string;
  readonly renglones: readonly RenglonDeEstado[];
}

export const SIN_ESTADO =
  'Esta conexión no puede decir cómo está la impresora (papel, tapa o cajón).';

export function leerElEstado(estado: EstadoDeImpresora): EstadoParaLeer {
  if (!estado.soportado) {
    const mensaje = estado.mensaje?.trim() ?? '';
    return {
      soportado: false,
      sinProblemas: false,
      resumen: mensaje === '' ? SIN_ESTADO : mensaje,
      renglones: [],
    };
  }
  const renglones: RenglonDeEstado[] = [];
  if (estado.enLinea !== undefined) {
    renglones.push({
      etiqueta: 'En línea',
      valor: estado.enLinea ? 'Sí' : 'No',
      bien: estado.enLinea,
    });
  }
  if (estado.sinPapel !== undefined) {
    renglones.push({
      etiqueta: 'Papel',
      valor: estado.sinPapel ? 'Sin papel' : 'Con papel',
      bien: !estado.sinPapel,
    });
  }
  if (estado.tapaAbierta !== undefined) {
    renglones.push({
      etiqueta: 'Tapa',
      valor: estado.tapaAbierta ? 'Abierta' : 'Cerrada',
      bien: !estado.tapaAbierta,
    });
  }
  if (estado.cajonAbierto !== undefined) {
    renglones.push({
      etiqueta: 'Cajón',
      valor: estado.cajonAbierto ? 'Abierto' : 'Cerrado',
      bien: null,
    });
  }
  const resumen =
    estado.sinPapel === true
      ? 'La impresora está sin papel'
      : estado.tapaAbierta === true
        ? 'La impresora tiene la tapa abierta'
        : estado.enLinea === false
          ? 'La impresora está fuera de línea'
          : 'Impresora lista ✓';
  return {
    soportado: true,
    sinProblemas: renglones.every((r) => r.bien !== false),
    resumen,
    renglones,
  };
}
