import { hash } from '@node-rs/argon2';
import { describe, expect, it } from 'vitest';

import { LIMITES } from '../http/limite.ts';
import {
  comprobarClaveDelProveedor,
  firmarPermisoDelProveedor,
  VIGENCIA_DEL_PERMISO_SEGUNDOS,
  vigenciaDelPermiso,
} from './proveedor.ts';

/**
 * DP-20 · refuerzo §2 · LA CONTRASEÑA DEL PROVEEDOR: sólo su hash, y un permiso de 30 minutos.
 *
 * La contraseña de estas pruebas se inventa aquí y no es la de nadie: la real no está en el repo.
 */

const SECRETO = 'secreto_de_prueba_de_la_firma_del_proveedor_2026';
const NEGOCIO = '11111111-1111-4111-8111-111111111111';
const OTRO_NEGOCIO = '22222222-2222-4222-8222-222222222222';
const AHORA = new Date('2026-11-14T18:00:00.000Z');

describe('la contraseña se compara contra el hash del despliegue', () => {
  it('la buena entra y cualquier otra no', async () => {
    const guardado = await hash('una-clave-de-prueba-0147');
    expect(await comprobarClaveDelProveedor('una-clave-de-prueba-0147', guardado)).toBe('correcta');
    expect(await comprobarClaveDelProveedor('una-clave-de-prueba-0148', guardado)).toBe(
      'incorrecta',
    );
    expect(await comprobarClaveDelProveedor('', guardado)).toBe('incorrecta');
    // Con espacios alrededor en la variable (se copió con un salto de línea) sigue sirviendo.
    expect(await comprobarClaveDelProveedor('una-clave-de-prueba-0147', `  ${guardado}\n`)).toBe(
      'correcta',
    );
  });

  it('sin hash en el despliegue nadie entra: cerrado por omisión', async () => {
    expect(await comprobarClaveDelProveedor('lo-que-sea', undefined)).toBe('sin_configurar');
    expect(await comprobarClaveDelProveedor('lo-que-sea', '')).toBe('sin_configurar');
  });

  it('lo que no es un hash Argon2id no se usa (ni la contraseña en claro, ni otro algoritmo)', async () => {
    expect(await comprobarClaveDelProveedor('en-claro', 'en-claro')).toBe('sin_configurar');
    expect(await comprobarClaveDelProveedor('x', '$2b$10$abcdefghijklmnopqrstuv')).toBe(
      'sin_configurar',
    );
    expect(await comprobarClaveDelProveedor('x', '$argon2id$esto-no-es-un-hash')).toBe(
      'sin_configurar',
    );
  });
});

describe('el permiso firmado', () => {
  it('vale 30 minutos para ESE negocio', () => {
    const { permiso, vence } = firmarPermisoDelProveedor(NEGOCIO, SECRETO, AHORA);
    expect(vence.getTime() - AHORA.getTime()).toBe(VIGENCIA_DEL_PERMISO_SEGUNDOS * 1000);
    expect(VIGENCIA_DEL_PERMISO_SEGUNDOS).toBe(30 * 60);
    expect(vigenciaDelPermiso(permiso, NEGOCIO, SECRETO, AHORA)).toEqual(vence);
    const casiAlFinal = new Date(vence.getTime() - 1000);
    expect(vigenciaDelPermiso(permiso, NEGOCIO, SECRETO, casiAlFinal)).toEqual(vence);
  });

  it('vencido, de otro negocio, con otra firma o alterado: no vale', () => {
    const { permiso, vence } = firmarPermisoDelProveedor(NEGOCIO, SECRETO, AHORA);
    expect(vigenciaDelPermiso(permiso, NEGOCIO, SECRETO, vence)).toBeNull();
    expect(vigenciaDelPermiso(permiso, OTRO_NEGOCIO, SECRETO, AHORA)).toBeNull();
    expect(vigenciaDelPermiso(permiso, NEGOCIO, `${SECRETO}x`, AHORA)).toBeNull();
    // Alargarle la vida a mano rompe la firma.
    const [negocio, exp, firma] = permiso.split('.');
    const alargado = `${negocio ?? ''}.${String(Number(exp) + 3600)}.${firma ?? ''}`;
    expect(vigenciaDelPermiso(alargado, NEGOCIO, SECRETO, AHORA)).toBeNull();
    expect(vigenciaDelPermiso(undefined, NEGOCIO, SECRETO, AHORA)).toBeNull();
    expect(vigenciaDelPermiso('', NEGOCIO, SECRETO, AHORA)).toBeNull();
    expect(vigenciaDelPermiso('sin-puntos', NEGOCIO, SECRETO, AHORA)).toBeNull();
  });

  it('el permiso no trae la contraseña ni datos de nadie: negocio, vencimiento y firma', () => {
    const { permiso } = firmarPermisoDelProveedor(NEGOCIO, SECRETO, AHORA);
    expect(permiso.split('.')).toHaveLength(3);
    expect(permiso.startsWith(`${NEGOCIO}.`)).toBe(true);
  });
});

describe('el límite de intentos', () => {
  it('cinco fallos y quince minutos de espera', () => {
    expect(LIMITES.proveedor).toEqual({ intentos: 5, ventanaSegundos: 15 * 60 });
  });
});
