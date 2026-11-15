import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { cookieDelProveedor, NOMBRE_COOKIE_PROVEEDOR, permisoDeLaCookie } from './proveedor.ts';

/**
 * DP-20 · refuerzo §2 · ENTRAR AL LABORATORIO: la cookie del permiso y lo que la ruta no puede
 * dejar de hacer. La ruta se lee como texto (se valida mutándola): cuenta el intento ANTES de
 * comparar, deja rastro del fallo y de la entrada, devuelve el intento sólo si acertó y nunca
 * contesta 401.
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
/** El código de la ruta, sin sus comentarios (que sí nombran lo que el código no debe hacer). */
const ruta = (nombre: string): string =>
  readFileSync(join(RAIZ, 'app', 'api', 'proveedor', nombre, 'route.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('la cookie del permiso', () => {
  it('la página no la puede leer y sólo viaja dentro de la propia app', () => {
    const cookie = cookieDelProveedor({
      permiso: 'abc.123.firma',
      maxEdadSegundos: 1800,
      seguro: true,
    });
    expect(cookie).toContain(`${NOMBRE_COOKIE_PROVEEDOR}=abc.123.firma`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('Max-Age=1800');
    expect(cookie).toContain('Path=/');
  });

  it('sin https (la demo de la red local) no lleva Secure, y sigue siendo HttpOnly', () => {
    const cookie = cookieDelProveedor({ permiso: 'x', maxEdadSegundos: 60, seguro: false });
    expect(cookie).not.toContain('Secure');
    expect(cookie).toContain('HttpOnly');
  });

  it('se lee de la cabecera, entre las demás cookies', () => {
    const cabecera = `morphiqpos_sesion=uno; ${NOMBRE_COOKIE_PROVEEDOR}=negocio.99.firma; otra=dos`;
    expect(permisoDeLaCookie(cabecera)).toBe('negocio.99.firma');
    expect(permisoDeLaCookie('morphiqpos_sesion=uno')).toBeUndefined();
    expect(permisoDeLaCookie(null)).toBeUndefined();
    expect(permisoDeLaCookie(`${NOMBRE_COOKIE_PROVEEDOR}=%E0%A4%A`)).toBeUndefined();
  });
});

describe('/api/proveedor/entrar', () => {
  const entrar = ruta('entrar');

  it('cuenta el intento antes de comparar la contraseña', () => {
    const cuenta = entrar.indexOf("permitir('proveedor'");
    const compara = entrar.indexOf('comprobarClaveDelProveedor(');
    expect(cuenta).toBeGreaterThan(-1);
    expect(compara).toBeGreaterThan(cuenta);
  });

  it('deja rastro del fallo y de la entrada', () => {
    expect(entrar).toMatch(/dejarRastroDelProveedor\(quien, false\)/);
    expect(entrar).toMatch(/dejarRastroDelProveedor\(quien, true\)/);
  });

  it('devuelve el intento sólo cuando la contraseña fue la buena', () => {
    const fallo = entrar.indexOf("if (comprobada !== 'correcta')");
    const devuelve = entrar.indexOf("devolver('proveedor'");
    expect(fallo).toBeGreaterThan(-1);
    expect(devuelve).toBeGreaterThan(fallo);
    expect(entrar.match(/devolver\('proveedor'/g)).toHaveLength(1);
  });

  it('el hash sale del entorno del despliegue y la contraseña no se guarda ni se registra', () => {
    expect(entrar).toMatch(/process\.env\[VARIABLE_DEL_HASH_DEL_PROVEEDOR\]/);
    expect(entrar).not.toMatch(/console\.|registrar\(/);
    expect(entrar).not.toMatch(/validada\.data\.clave[^,)]/);
  });

  it('nunca contesta 401 (cerraría la sesión de quien está en caja)', () => {
    expect(entrar).not.toMatch(/\b401\b/);
    expect(entrar).toMatch(/estado: 400 \| 403 \| 429/);
  });

  it('el permiso va en una cookie con las banderas del despliegue', () => {
    expect(entrar).toMatch(/cookieDelProveedor\(\{/);
    expect(entrar).toMatch(/seguro: cookiesSeguras\(entorno\)/);
    expect(entrar).toMatch(/maxEdadSegundos: VIGENCIA_DEL_PERMISO_SEGUNDOS/);
  });
});

describe('/api/proveedor/estado y /salir', () => {
  it('el estado sale de la cookie firmada, atada al negocio y a la persona de la sesión', () => {
    expect(ruta('estado')).toMatch(
      /vigenciaDelPermiso\(\s*permisoDeLaCookie\(peticion\.headers\.get\('cookie'\)\),\s*sesion\.organizacionId,\s*sesion\.identidadId,/,
    );
    expect(ruta('entrar')).toMatch(
      /firmarPermisoDelProveedor\(\s*sesion\.organizacionId,\s*sesion\.identidadId,/,
    );
  });

  it('salir caduca la cookie', () => {
    expect(ruta('salir')).toMatch(/maxEdadSegundos: 0/);
  });
});
