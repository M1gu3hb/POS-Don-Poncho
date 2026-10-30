/**
 * LAS CUENTAS PENDIENTES DE LA CAJA, sin pantalla.
 *
 * Lo que la lista de «Pendientes» decidía dentro de su JSX, ahora con prueba: cómo se llama la
 * mesa, cuándo un ticket está en cero y qué insignia lleva una cuenta que vino del QR del
 * comensal. Las reglas y su ORDEN son las de siempre: cambiar el orden cambiaría qué insignia
 * sale para una misma cuenta.
 *
 * La venta es lo que el puente sirve (campos en `snake_case`, importes en PESOS): se queda así
 * porque es lo que la caja heredada ya tiene en las manos, y los importes se pasan a centavos al
 * pintarlos.
 */

export interface VentaPendiente {
  readonly id: string;
  readonly mesa_numero?: string | number | null;
  readonly folio?: string | null;
  /** En pesos, como lo sirve el puente. */
  readonly total?: number | string | null;
  readonly personas?: number | null;
  readonly cliente_nombre?: string | null;
  readonly codigo_caja?: string | null;
  readonly propina_origen?: string | null;
  readonly propina_tipo?: string | null;
  /** El porcentaje (10, 12.5), no los puntos base. */
  readonly propina_porcentaje?: number | string | null;
}

/** «Mesa 5», o «Mesa —» si la cuenta no trae número. */
export function etiquetaDeLaMesa(venta: VentaPendiente): string {
  const numero = String(venta.mesa_numero ?? '');
  return `Mesa ${numero === '' || numero === '0' ? '—' : numero}`;
}

/** El ticket que no se puede cobrar: sin total, o en cero. Sólo se puede borrar. */
export function tieneTotalCero(venta: VentaPendiente): boolean {
  const total = Number(venta.total);
  return !total || total <= 0;
}

/** Qué le pasó a la propina de una cuenta del QR, sin el texto ni el importe pintado. */
export type InsigniaDeQr =
  | { readonly tipo: 'esperando' }
  | { readonly tipo: 'decidir_en_caja' }
  | { readonly tipo: 'sin_propina' }
  | {
      readonly tipo: 'porcentaje';
      readonly porcentaje: number | string;
      readonly propinaPesos: number;
    }
  | { readonly tipo: 'monto'; readonly propinaPesos: number }
  | { readonly tipo: 'solicitada' };

const ORIGENES_DEL_QR: readonly string[] = ['portal_qr', 'pendiente_portal_qr'];

/**
 * La insignia de una cuenta que pidió el comensal desde el QR, o `null` si no vino de ahí.
 * `propinaPesos` es la propina derivada de la cuenta (`propinaDerivada` de la caja heredada).
 */
export function insigniaDeQr(venta: VentaPendiente, propinaPesos: number): InsigniaDeQr | null {
  const origen = venta.propina_origen ?? '';
  if (!ORIGENES_DEL_QR.includes(origen)) return null;
  const tipo = venta.propina_tipo;
  if (origen === 'pendiente_portal_qr' || tipo === 'pendiente_cliente')
    return { tipo: 'esperando' };
  if (tipo === 'decidir_en_caja') return { tipo: 'decidir_en_caja' };
  if (tipo === 'sin_propina') return { tipo: 'sin_propina' };
  const porcentaje = venta.propina_porcentaje ?? 0;
  if (tipo === 'porcentaje' && Number(porcentaje) > 0) {
    return { tipo: 'porcentaje', porcentaje, propinaPesos };
  }
  if (propinaPesos > 0) return { tipo: 'monto', propinaPesos };
  return { tipo: 'solicitada' };
}

/**
 * El aviso de la propina que nadie ha decidido, dentro del diálogo de cobro: dice quién la dejó
 * en el aire. `null` si la propina ya está decidida.
 */
export function avisoDePropinaPendiente(tipo: string | null | undefined): string | null {
  if (tipo === 'decidir_en_caja')
    return 'Cliente eligió decidir en caja — toca para definir propina';
  if (tipo === 'pendiente_cliente') return 'Cliente no eligió propina en QR — toca para definirla';
  if (tipo === 'pendiente') return 'Propina pendiente — toca para definirla';
  return null;
}
