/**
 * DP-22 · EL MAPA TOTAL · los comandos y las lecturas del puente.
 *
 * Los comandos salen de la matriz de permisos (la misma que prueba la CI): su ruta, si escriben y
 * qué puestos los pueden llamar. De cada uno se busca qué pantalla lo llama (la ruta escrita tal
 * cual en el código de las pantallas). De cada `api.entidades.X`, qué pantallas la usan, con qué
 * operaciones y qué puestos la pueden leer según el mapa del puente.
 */
import { comoCita, fuentesDeLaApp, leer, limpio } from './fuentes.mjs';

const escapar = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const esDePantalla = (archivo) =>
  /^apps\/web\/(?:heredado|src)\//u.test(archivo) ||
  (/^apps\/web\/app\//u.test(archivo) && !archivo.startsWith('apps/web/app/api/'));

/** Dónde se llama una ruta de la API: escrita entera y cerrada por comilla, `?` o `/${`. */
function llamadasA(ruta, pantallas) {
  const patron = new RegExp(`${escapar(ruta)}(?=['"\`?]|/\\$\\{)`, 'u');
  const salida = [];
  for (const archivo of pantallas) {
    const texto = limpio(archivo);
    if (!patron.test(texto)) continue;
    texto.split('\n').forEach((renglon, indice) => {
      if (patron.test(renglon)) salida.push({ archivo, linea: indice + 1 });
    });
  }
  return salida;
}

export function comandos(pantallasPorArchivo) {
  const matriz = JSON.parse(leer('pruebas/e2e/matriz-de-permisos.json'));
  const pantallas = fuentesDeLaApp().filter(esDePantalla);
  const delRestaurante = matriz.incluidas.filter(({ paquetes }) =>
    paquetes.includes('restaurante'),
  );
  return delRestaurante
    .map(({ ruta, comando, escribe, roles }) => {
      const llamadas = llamadasA(ruta, pantallas);
      const rutas = new Set();
      for (const { archivo } of llamadas) {
        for (const pantalla of pantallasPorArchivo.get(archivo) ?? ['(armazón o compartido)']) {
          rutas.add(pantalla);
        }
      }
      return {
        comando,
        ruta,
        escribe,
        puestos: roles,
        llamadas: llamadas.map(comoCita),
        pantallas: [...rutas].sort(),
      };
    })
    .sort((a, b) => a.comando.localeCompare(b.comando));
}

/** Las constantes de roles del mapa del puente (`DIRECCION`, `CAJA`…), resueltas. */
function gruposDeRoles(texto) {
  const grupos = new Map();
  const patron = /^const ([A-Z_]+) = \[([^\]]*)\] as const/gmu;
  for (const [, nombre, cuerpo] of texto.matchAll(patron)) {
    const roles = [];
    for (const trozo of cuerpo
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t !== '')) {
      const literal = /^'([^']+)'$/u.exec(trozo)?.[1];
      if (literal !== undefined) roles.push(literal);
      else if (trozo.startsWith('...')) roles.push(...(grupos.get(trozo.slice(3)) ?? []));
    }
    grupos.set(nombre, roles);
  }
  return grupos;
}

function lecturasDelMapa() {
  const texto = limpio('packages/app/src/puente/mapa.ts');
  const grupos = gruposDeRoles(texto);
  const salida = new Map();
  const entidad = /^ {2}([A-Z][A-Za-z]+): \{$/gmu;
  const cortes = [...texto.matchAll(entidad)];
  cortes.forEach((hallazgo, indice) => {
    const cuerpo = texto.slice(hallazgo.index, cortes[indice + 1]?.index ?? texto.length);
    const lista = /rolesLectura:\s*\[([^\]]*)\]/u.exec(cuerpo)?.[1];
    const roles = [];
    for (const trozo of (lista ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t !== '')) {
      const literal = /^'([^']+)'$/u.exec(trozo)?.[1];
      if (literal !== undefined) roles.push(literal);
      else if (trozo.startsWith('...'))
        roles.push(...(grupos.get(trozo.slice(3)) ?? [`?${trozo}`]));
    }
    salida.set(hallazgo[1], {
      puestos: lista === undefined ? null : [...new Set(roles)],
      escritura: /escritura:\s*'([a-z_]+)'/u.exec(cuerpo)?.[1] ?? null,
    });
  });
  return salida;
}

export function entidades(pantallasPorArchivo) {
  const mapa = lecturasDelMapa();
  const usos = new Map();
  const patron = /api\.entidades\.([A-Z][A-Za-z]+)\.([a-zA-Z]+)\(/gu;
  for (const archivo of fuentesDeLaApp().filter(esDePantalla)) {
    for (const [, nombre, operacion] of limpio(archivo).matchAll(patron)) {
      const uso = usos.get(nombre) ?? { operaciones: new Set(), archivos: new Set() };
      uso.operaciones.add(operacion);
      uso.archivos.add(archivo);
      usos.set(nombre, uso);
    }
  }
  return [...usos]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([nombre, uso]) => {
      const rutas = new Set();
      for (const archivo of uso.archivos) {
        for (const pantalla of pantallasPorArchivo.get(archivo) ?? ['(armazón o compartido)']) {
          rutas.add(pantalla);
        }
      }
      return {
        entidad: nombre,
        operaciones: [...uso.operaciones].sort(),
        puestosQueLaLeen: mapa.get(nombre)?.puestos ?? null,
        escritura: mapa.get(nombre)?.escritura ?? null,
        archivos: [...uso.archivos].sort(),
        pantallas: [...rutas].sort(),
      };
    });
}
