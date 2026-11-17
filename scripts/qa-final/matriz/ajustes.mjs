/**
 * DP-22 · EL MAPA TOTAL · los ajustes: cada clave de la configuración y cada ajuste de «Este aparato».
 *
 * La lista sale del código: las listas del puente (`CLAVES_EDITABLES`, `PUBLICOS`, lo que sólo se
 * escribe por comando y los valores por omisión), las tarjetas de `secciones.ts` y las llaves que
 * las pantallas guardan en el navegador. De cada una: en qué tarjeta vive, con qué se guarda, quién
 * la escribe, quién la lee (archivo:línea) y qué pruebas la nombran. Lo que DEBE cambiar en el
 * negocio y la prueba que lo demuestra los declara `qa/qa-final/datos/efectos.json`; una clave del
 * código sin su renglón ahí queda marcada «sin definir», para que ninguna se escape.
 */
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  RAIZ,
  apariciones,
  comoCita,
  fuentesDeLaApp,
  fuentesDePrueba,
  leer,
  limpio,
} from './fuentes.mjs';

const PUENTE = 'packages/app/src/puente/configuracion.ts';
const SECCIONES = 'apps/web/src/configuracion/secciones.ts';

/** Donde una clave se DECLARA o se GUARDA: no cuentan como lectores. */
const DE_DECLARACION = [
  PUENTE,
  SECCIONES,
  'apps/web/heredado/lib/ConfigContext.jsx',
  'apps/web/src/configuracion/inventario/',
];
const DE_ESCRITURA = [
  'apps/web/src/configuracion/',
  'apps/web/heredado/components/configuracion/',
  'apps/web/heredado/components/portalqr/ConfiguracionQRTab.jsx',
  'apps/web/heredado/pages/Configuracion.jsx',
  'packages/app/src/configuracion/',
];

const empiezaCon = (lista) => (archivo) => lista.some((prefijo) => archivo.startsWith(prefijo));

function constantes() {
  const salida = new Map();
  const patron = /export const (CLAVE_[A-Z_]+)\s*=\s*'([^']+)'/gu;
  for (const archivo of fuentesDeLaApp().filter((ruta) => ruta.startsWith('packages/app/src/'))) {
    for (const [, nombre, valor] of leer(archivo).matchAll(patron)) salida.set(nombre, valor);
  }
  return salida;
}

/** Los elementos de `NOMBRE = new Set([ … ])` o `NOMBRE = [ … ]`, con sus constantes resueltas. */
function listaDe(texto, nombre, valores) {
  const inicio = texto.search(new RegExp(`(?:const|export const)\\s+${nombre}\\s*=`, 'u'));
  if (inicio < 0) throw new Error(`El mapa no encontró la lista ${nombre} en ${PUENTE}`);
  const abre = texto.indexOf('[', inicio);
  const cierra = texto.indexOf(']', abre);
  return texto
    .slice(abre + 1, cierra)
    .split(',')
    .map((trozo) => trozo.trim())
    .filter((trozo) => trozo !== '')
    .map((trozo) => {
      const literal = /^'([^']+)'$/u.exec(trozo)?.[1];
      if (literal !== undefined) return literal;
      const resuelta = valores.get(trozo);
      if (resuelta === undefined) throw new Error(`El mapa no sabe cuánto vale ${trozo}`);
      return resuelta;
    });
}

function porOmision(texto) {
  const inicio = texto.indexOf('export const CONFIG_POR_OMISION');
  const cuerpo = texto.slice(inicio, texto.indexOf('} as const', inicio));
  return new Set([...cuerpo.matchAll(/^\s{2}([a-z_]+):/gmu)].map(([, clave]) => clave));
}

/** Las llaves que las pantallas guardan en el navegador de ESTE aparato. */
function llavesDelAparato(fuentes) {
  const patron = /['"`]((?:mpos|morphiqpos)\.[\w.-]+|mh_[a-z_]+)['"`]/gu;
  const salida = new Map();
  for (const archivo of fuentes) {
    if (!/^apps\/web\/(?:heredado|src)\//u.test(archivo)) continue;
    const renglones = limpio(archivo).split('\n');
    renglones.forEach((renglon, indice) => {
      for (const [, llave] of renglon.matchAll(patron)) {
        const citas = salida.get(llave) ?? [];
        citas.push({ archivo, linea: indice + 1 });
        salida.set(llave, citas);
      }
    });
  }
  return salida;
}

const unicos = (citas) => [...new Set(citas.map(({ archivo }) => archivo))];

export async function ajustes(efectos) {
  const texto = limpio(PUENTE);
  const valores = constantes();
  const editables = new Set(listaDe(texto, 'CLAVES_EDITABLES', valores));
  const publicas = new Set(listaDe(texto, 'PUBLICOS', valores));
  const soloPorComando = new Set(listaDe(texto, 'SOLO_POR_COMANDO', valores));
  const nuncaSalen = new Set(listaDe(texto, 'NUNCA_SALEN', valores));
  const retiradas = new Set(listaDe(texto, 'RETIRADAS', valores));
  const conOmision = porOmision(texto);

  const { TARJETAS, SECCIONES: secciones } = await import(
    pathToFileURL(join(RAIZ, SECCIONES)).href
  );
  const nombreDeSeccion = new Map(secciones.map(({ id, nombre }) => [id, nombre]));
  const tarjetaDe = new Map();
  for (const tarjeta of TARJETAS) for (const clave of tarjeta.guarda) tarjetaDe.set(clave, tarjeta);

  const app = fuentesDeLaApp();
  const pruebas = fuentesDePrueba();
  const esDeclaracion = empiezaCon(DE_DECLARACION);
  const esEscritura = empiezaCon(DE_ESCRITURA);

  const claves = new Set([
    ...editables,
    ...publicas,
    ...soloPorComando,
    ...conOmision,
    ...tarjetaDe.keys(),
  ]);
  for (const clave of [...nuncaSalen, ...retiradas]) claves.delete(clave);
  // Una clave con hijas (`experiencia.mascota`…) se mira por sus hijas, no entera.
  for (const clave of [...claves]) {
    if ([...claves].some((otra) => otra.startsWith(`${clave}.`))) claves.delete(clave);
  }
  /** El servidor nombra varias claves por su constante (`CLAVE_DEL_IMPUESTO`): también cuenta. */
  const constantesDe = (clave) =>
    [...valores].filter(([, valor]) => valor === clave).map(([nombre]) => nombre);

  const delNegocio = [...claves].sort().map((clave) => {
    const buscada = clave.includes('.') ? clave.slice(clave.lastIndexOf('.') + 1) : clave;
    const citas = [buscada, ...constantesDe(clave)]
      .flatMap((palabra) => apariciones(app, palabra))
      .filter(({ archivo }) => !esDeclaracion(archivo))
      .filter(
        (cita, indice, todas) =>
          todas.findIndex((otra) => comoCita(otra) === comoCita(cita)) === indice,
      );
    const tarjeta = tarjetaDe.get(clave) ?? null;
    const enPruebas = unicos(apariciones(pruebas, buscada));
    return {
      clave,
      ambito: 'negocio',
      seccion: tarjeta === null ? null : nombreDeSeccion.get(tarjeta.seccion),
      tarjeta: tarjeta?.titulo ?? null,
      visiblePara: tarjeta?.visiblePara ?? null,
      con: tarjeta?.con ?? (soloPorComando.has(clave) ? 'sólo por comando' : null),
      editable: editables.has(clave),
      publica: publicas.has(clave),
      soloPorComando: soloPorComando.has(clave),
      conValorPorOmision: conOmision.has(clave),
      escritores: citas.filter(({ archivo }) => esEscritura(archivo)).map(comoCita),
      lectores: citas.filter(({ archivo }) => !esEscritura(archivo)).map(comoCita),
      pruebasQueLaNombran: enPruebas,
      efecto: efectos[clave] ?? null,
    };
  });

  const delAparato = [...llavesDelAparato(app)]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([clave, citas]) => ({
      clave,
      ambito: 'aparato',
      seccion: 'Este aparato',
      tarjeta: null,
      visiblePara: 'todos',
      con: 'este aparato (almacén del navegador)',
      editable: true,
      publica: false,
      soloPorComando: false,
      conValorPorOmision: false,
      escritores: [],
      lectores: citas.map(comoCita),
      pruebasQueLaNombran: unicos(apariciones(pruebas, clave, { literal: true })),
      efecto: efectos[clave] ?? null,
    }));

  const tarjetasSinClave = TARJETAS.filter((tarjeta) => tarjeta.guarda.length === 0).map(
    (tarjeta) => ({
      id: tarjeta.id,
      seccion: nombreDeSeccion.get(tarjeta.seccion),
      titulo: tarjeta.titulo,
      con: tarjeta.con,
      visiblePara: tarjeta.visiblePara,
      efecto: efectos[`tarjeta:${tarjeta.id}`] ?? null,
    }),
  );

  return { delNegocio, delAparato, tarjetasSinClave, tarjetas: TARJETAS.length };
}
