import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

import { verify } from '@node-rs/argon2';
import { conTransaccion, repoComandos } from '@morphiqpos/data';

import { payloadDeAuditoria } from '../saneado.ts';

/**
 * LA CONTRASEÑA DEL PROVEEDOR (DP-20 · refuerzo §2).
 *
 * «Hardware y pruebas de impresión» es de Morphiq, no del personal: ahí se decide con qué
 * impresora y cómo imprime cada aparato. Lo protege UNA contraseña, la del proveedor.
 *
 * El repositorio es público, así que la contraseña no existe en ningún archivo: el servidor sólo
 * conoce su HASH (Argon2id), que vive en la variable de entorno `PROVEEDOR_CLAVE_HASH` del
 * despliegue. Se compara aquí, nunca en el navegador. Sin la variable, nadie entra (cerrado por
 * omisión) y la pantalla lo dice.
 *
 * Si acierta, el aparato recibe un PERMISO firmado de 30 minutos en una cookie `httpOnly`: una
 * firma HMAC con el secreto de sesión y un prefijo propio (`proveedor:`), atada al negocio Y A
 * QUIEN TENÍA LA SESIÓN cuando se tecleó la contraseña: si otra persona entra con su PIN en ese
 * aparato antes de los 30 minutos, el permiso no le sirve. Una cookie de sesión no sirve de
 * permiso ni al revés.
 *
 * Cada entrada y cada fallo quedan en la auditoría. No es un comando por la misma razón que el
 * PIN del supervisor: un comando que rechaza revierte su transacción, y aquí el rastro del fallo
 * tiene que quedar.
 */

export const VARIABLE_DEL_HASH_DEL_PROVEEDOR = 'PROVEEDOR_CLAVE_HASH';

/** Treinta minutos: lo que tarda en dejarse listo un aparato. */
export const VIGENCIA_DEL_PERMISO_SEGUNDOS = 30 * 60;

export const ACCION_ENTRAR = 'proveedor.entrar';
export const ACCION_FALLAR = 'proveedor.fallar';
/** El intento que el tope por IP rechazó (429): sin contraseña que comparar, pero con rastro (X4). */
export const ACCION_BLOQUEAR = 'proveedor.bloquear';

/** Sólo Argon2id: es lo que se guarda (como los PIN). */
const PREFIJO_DEL_HASH = '$argon2id$';

export type ClaveComprobada = 'correcta' | 'incorrecta' | 'sin_configurar';

/** Compara la contraseña tecleada contra el hash del despliegue. */
export async function comprobarClaveDelProveedor(
  clave: string,
  hashDelDespliegue: string | undefined,
): Promise<ClaveComprobada> {
  const guardado = hashDelDespliegue?.trim() ?? '';
  if (!guardado.startsWith(PREFIJO_DEL_HASH)) return 'sin_configurar';
  try {
    return (await verify(guardado, clave)) ? 'correcta' : 'incorrecta';
  } catch {
    // Un hash con la forma de Argon2id que la librería no puede leer está mal copiado en el
    // despliegue: nadie entra, y se dice «sin configurar» en lugar de «contraseña incorrecta».
    return 'sin_configurar';
  }
}

function firma(cuerpo: string, secreto: string): string {
  return createHmac('sha256', secreto).update(`proveedor:${cuerpo}`, 'utf8').digest('base64url');
}

function igualEnTiempoConstante(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** El permiso: `<negocio>.<quién tenía la sesión>.<vence en segundos>.<firma>`. Sólo ids. */
export function firmarPermisoDelProveedor(
  organizacionId: string,
  identidadId: string,
  secreto: string,
  ahora: Date = new Date(),
): { readonly permiso: string; readonly vence: Date } {
  const exp = Math.floor(ahora.getTime() / 1000) + VIGENCIA_DEL_PERMISO_SEGUNDOS;
  const cuerpo = `${organizacionId}.${identidadId}.${String(exp)}`;
  return { permiso: `${cuerpo}.${firma(cuerpo, secreto)}`, vence: new Date(exp * 1000) };
}

/**
 * Hasta cuándo vale el permiso para ESE negocio y ESA persona, o `null` si no vale (otro negocio,
 * otra persona, vencido, alterado).
 */
export function vigenciaDelPermiso(
  permiso: string | undefined,
  organizacionId: string,
  identidadId: string,
  secreto: string,
  ahora: Date = new Date(),
): Date | null {
  if (permiso === undefined) return null;
  const punto = permiso.lastIndexOf('.');
  if (punto <= 0) return null;
  const cuerpo = permiso.slice(0, punto);
  if (!igualEnTiempoConstante(permiso.slice(punto + 1), firma(cuerpo, secreto))) return null;
  const partes = cuerpo.split('.');
  if (partes.length !== 3) return null;
  const [negocio, identidad, exp] = partes;
  if (negocio !== organizacionId || identidad !== identidadId) return null;
  if (exp === undefined || !/^\d{1,12}$/.test(exp)) return null;
  const vence = new Date(Number(exp) * 1000);
  return vence.getTime() > ahora.getTime() ? vence : null;
}

export interface QuienIntenta {
  readonly organizacionId: string;
  readonly identidadId: string;
  readonly terminalId: string | null;
  readonly empleoId: string;
  readonly rol: string;
  readonly correlationId: string;
}

/**
 * El motor del aparato que entra (DP-20.1): qué navegador interno trae y qué no entiende. Lo mide
 * la página («Probar compatibilidad») y sirve para conocer los motores de todos los aparatos sin
 * ir a cada uno. No lleva datos de nadie: el agente de usuario, la versión y una lista de `id`.
 */
export interface MotorDelAparato {
  readonly ua: string;
  readonly mayor: number | null;
  readonly nivel: 'moderno' | 'compatible' | 'demasiado-viejo';
  readonly fallan: readonly string[];
}

/**
 * Deja en la auditoría la entrada (o el fallo) al laboratorio, en su propia transacción. El motor
 * sólo se guarda con la entrada: quien falla la contraseña no deja escrito nada suyo.
 */
export async function dejarRastroDelProveedor(
  quien: QuienIntenta,
  entro: boolean,
  motor?: MotorDelAparato,
): Promise<void> {
  const accion = entro ? ACCION_ENTRAR : ACCION_FALLAR;
  await conTransaccion((tx) =>
    repoComandos.escribirAuditoria(tx, {
      organizacionId: quien.organizacionId,
      identidadId: quien.identidadId,
      terminalId: quien.terminalId,
      accion,
      entidad: 'laboratorio_de_impresion',
      entidadId: null,
      correlationId: quien.correlationId,
      payload: payloadDeAuditoria({
        v: 1,
        comando: accion,
        rol: quien.rol,
        empleoId: quien.empleoId,
        ...(entro && motor !== undefined ? { motor } : {}),
      }),
    }),
  );
}

/**
 * Deja en la auditoría el primer intento que el tope por IP rechazó (429), en su propia transacción
 * (X4): quién tenía la sesión y cuánto le toca esperar. No lleva la contraseña —ni siquiera se
 * comparó— ni la IP en claro.
 */
export async function dejarRastroDelBloqueo(
  quien: QuienIntenta,
  esperaSegundos: number,
): Promise<void> {
  await conTransaccion((tx) =>
    repoComandos.escribirAuditoria(tx, {
      organizacionId: quien.organizacionId,
      identidadId: quien.identidadId,
      terminalId: quien.terminalId,
      accion: ACCION_BLOQUEAR,
      entidad: 'laboratorio_de_impresion',
      entidadId: null,
      correlationId: quien.correlationId,
      payload: payloadDeAuditoria({
        v: 1,
        comando: ACCION_BLOQUEAR,
        rol: quien.rol,
        empleoId: quien.empleoId,
        esperaSegundos,
      }),
    }),
  );
}
