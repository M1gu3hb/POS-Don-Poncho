/**
 * DP-22 · EL MAPA TOTAL · qué puesto abre cada ruta.
 *
 * No se copia la regla: se le pregunta a la misma función que usa el armazón de la app
 * (`rutaPermitidaParaElPuesto` con `hasPermission`, en `heredado/lib`). Esos módulos importan sin
 * extensión y con los alias de `apps/web`, que Node no resuelve solo: un gancho de resolución los
 * completa, sólo para este proceso.
 */
import { registerHooks } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { RAIZ } from './fuentes.mjs';
import { resolver } from './pantallas.mjs';

/** Los siete puestos del restaurante y el rol con el que cada uno llega a las pantallas heredadas. */
export const PUESTOS = [
  { puesto: 'dueno', nombre: 'Dueño', rolDePantalla: 'administrador' },
  { puesto: 'administrador', nombre: 'Administrador', rolDePantalla: 'administrador' },
  { puesto: 'gerente', nombre: 'Gerente', rolDePantalla: 'administrador' },
  { puesto: 'cajero', nombre: 'Cajero', rolDePantalla: 'caja' },
  { puesto: 'mesero', nombre: 'Mesero', rolDePantalla: 'mesero' },
  { puesto: 'cocina', nombre: 'Cocina', rolDePantalla: 'cocina' },
  { puesto: 'almacen', nombre: 'Almacén', rolDePantalla: 'almacen' },
];

let enganchado = false;
function enganchar() {
  if (enganchado) return;
  enganchado = true;
  const raizUrl = pathToFileURL(`${RAIZ}/`).href;
  registerHooks({
    resolve(especificador, contexto, siguiente) {
      const padre = contexto.parentURL ?? '';
      if (padre.startsWith(raizUrl) && /^(?:\.|@\/|~\/)/u.test(especificador)) {
        const desde = decodeURIComponent(padre.slice(raizUrl.length));
        const destino = resolver(desde, especificador);
        if (destino !== null) {
          return { url: pathToFileURL(join(RAIZ, destino)).href, shortCircuit: true };
        }
      }
      return siguiente(especificador, contexto);
    },
  });
}

/** `{ [ruta]: { [puesto]: boolean } }` para las rutas con sesión del restaurante. */
export async function rutasPorPuesto(rutas) {
  enganchar();
  const permisos = await import(
    pathToFileURL(join(RAIZ, 'apps/web/heredado/lib/permissions.js')).href
  );
  const paquetes = await import(
    pathToFileURL(join(RAIZ, 'apps/web/heredado/lib/packageConfig.js')).href
  );
  const salida = {};
  for (const ruta of rutas) {
    salida[ruta] = Object.fromEntries(
      PUESTOS.map(({ puesto, rolDePantalla }) => [
        puesto,
        paquetes.isRouteAllowed(ruta, 'restaurante') === true &&
          paquetes.rutaPermitidaParaElPuesto(
            ruta,
            rolDePantalla,
            'restaurante',
            permisos.hasPermission,
          ) === true,
      ]),
    );
  }
  return salida;
}
