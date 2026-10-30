import type { MesaDelPlano } from '../cliente/mesas-del-mapa';
import type { SolicitudPendiente } from '../restaurante/globos-de-solicitud';

export type { SolicitudPendiente };

/**
 * LA MESA, tal como la sirve el puente y la leen el plano, la rejilla y la cuenta. Sólo lo que
 * esta pantalla pinta; el resto de sus campos pasa de largo (el manejador de `Mesero.jsx` recibe la
 * mesa entera y la devuelve igual a los comandos).
 */
export interface MesaDelSalon extends MesaDelPlano {
  readonly numero: number;
  readonly estado?: string | null | undefined;
  readonly nombre?: string | null | undefined;
  readonly forma?: string | null | undefined;
  readonly tamano?: string | null | undefined;
  readonly orden?: number | null | undefined;
  readonly capacidad?: number | null | undefined;
  readonly personas_actuales?: number | null | undefined;
  readonly celebracion_especial?: boolean | null | undefined;
  readonly tipo_celebracion?: string | null | undefined;
  readonly notas_alergias?: string | null | undefined;
  readonly venta_activa_id?: string | null | undefined;
}

/** Dónde se pinta el salón: el plano de la PC y la tableta, o la rejilla del teléfono. */
export type FormaDelSalon = 'plano' | 'rejilla';

/** Quién atiende una mesa: su nombre y el color con que el negocio lo marcó. */
export interface ResponsableDeLaMesa {
  readonly nombre: string;
  readonly color: string | null;
}
