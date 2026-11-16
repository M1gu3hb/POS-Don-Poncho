import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-21 · Bloque 2 · QUIEN ENTRA CON SU PIN NO LO TECLEA DOS VECES.
 *
 * El candado de la sesión (`CandadoDeLaSesion`) pide el PIN a mando y caja en toda pantalla que no
 * traiga la marca de esta ejecución. Esa marca la deja QUIEN ACABA DE COMPROBAR EL PIN EN EL
 * SERVIDOR. Si una pantalla de acceso llama a `/api/auth/entrar` y no la deja, la persona entra y
 * el candado le vuelve a pedir el PIN en la pantalla siguiente.
 *
 * Pasó: el acceso de producción (`heredado/pages/POSLogin.jsx`, el de `/login-pos` y
 * `/n/<negocio>/login-pos`) entra por `login()` de `POSAuthContext`, y sólo marcaban
 * `AccesoPorPin` y la capa del propio candado. Este contrato lee el código: TODA pantalla que
 * comprueba un PIN deja la marca, ella misma o por el `login()` del contexto.
 */

const WEB = join(__dirname, '..', '..');
const leer = (ruta: string) => readFileSync(join(WEB, ruta), 'utf8');

function archivosDe(carpeta: string): string[] {
  const salida: string[] = [];
  for (const nombre of readdirSync(carpeta)) {
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) {
      if (nombre !== 'node_modules') salida.push(...archivosDe(ruta));
    } else if (/\.(jsx?|tsx?)$/.test(nombre) && !/\.(test|spec)\./.test(nombre)) {
      salida.push(ruta);
    }
  }
  return salida;
}

/** El transporte (`api.auth.entrar`) y los textos que sólo la nombran: no son pantallas de acceso. */
const NO_SON_PANTALLAS = new Set([
  'heredado/api/cliente.ts',
  'src/cliente/entrada.ts',
  'src/servidor/seguridad-http.ts',
  'src/espera/CandadoDeLaSesion.tsx',
]);

/** ¿El archivo COMPRUEBA un PIN (llama a la entrada), no sólo la menciona en un comentario? */
function compruebaUnPin(codigo: string): boolean {
  return (
    /invocarComando\(\s*'\/api\/auth\/entrar'/.test(codigo) || /api\.auth\.entrar\(/.test(codigo)
  );
}

describe('quien comprueba un PIN deja la marca de esta ejecución', () => {
  const pantallas = [...archivosDe(join(WEB, 'heredado')), ...archivosDe(join(WEB, 'src'))]
    .map((ruta) => relative(WEB, ruta).replaceAll('\\', '/'))
    .filter((ruta) => !NO_SON_PANTALLAS.has(ruta))
    .filter((ruta) => compruebaUnPin(leer(ruta)));

  it('se encuentran las tres pantallas que hoy comprueban un PIN', () => {
    expect(pantallas.sort()).toEqual([
      'heredado/pages/POSLogin.jsx',
      'src/espera/PedirPinAlDespertar.tsx',
      'src/restaurante/AccesoPorPin.tsx',
    ]);
  });

  it('`login()` del contexto deja la marca con el empleo que entró', () => {
    const contexto = leer('heredado/lib/POSAuthContext.jsx');
    const login = /const login = \(user\) => \{[\s\S]*?\n {2}\};/.exec(contexto)?.[0] ?? '';
    expect(login).not.toBe('');
    expect(login).toContain('marcarPin(almacenDeLaEjecucion(), user.id)');
  });

  it.each(pantallas)('%s deja la marca: ella misma o por `login()`', (ruta) => {
    const codigo = leer(ruta);
    const marcaElla = /marcarPin\(almacenDeLaEjecucion\(\), /.test(codigo);
    // El acceso heredado entra por el contexto: `login(entrado)` DESPUÉS de comprobar el PIN.
    const entraPorElContexto =
      /await api\.auth\.entrar\([\s\S]*?\blogin\(entrado\);/.test(codigo) &&
      codigo.includes("from '@/lib/POSAuthContext'");
    expect(marcaElla || entraPorElContexto).toBe(true);
  });
});
