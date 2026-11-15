/**
 * LA ENTRADA AL LABORATORIO (DP-20 · refuerzo §2). Puro.
 *
 * El servidor dice si este aparato tiene vigente el permiso del proveedor; aquí se vuelve la hora
 * en que vence y el texto de la sesión.
 */

export interface EstadoDelProveedor {
  readonly dentro: boolean;
  readonly vence: string | null;
  readonly configurado: boolean;
}

/** La llave de la consulta que dice si este aparato tiene vigente el permiso del proveedor. */
export const CLAVE_DEL_PROVEEDOR = ['proveedor', 'estado'] as const;

export const AVISO_DEL_LABORATORIO = 'Sólo tu proveedor MORPHIQ puede entrar aquí';

export const SIN_CONTRASENA_CONFIGURADA =
  'Este despliegue todavía no tiene contraseña del proveedor. Pídesela a tu proveedor.';

/** «16:30», en la hora de México; vacío si la fecha no se entiende. */
export function horaDeVencimiento(vence: string | null): string {
  if (vence === null) return '';
  const fecha = new Date(vence);
  if (Number.isNaN(fecha.getTime())) return '';
  return new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Mexico_City',
  }).format(fecha);
}

export function textoDeLaSesion(estado: EstadoDelProveedor): string {
  const hora = horaDeVencimiento(estado.vence);
  return hora === '' ? 'Permiso vigente' : `Permiso vigente · vence a las ${hora}`;
}
