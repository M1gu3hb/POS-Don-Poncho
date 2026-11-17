#!/usr/bin/env node
/**
 * verify:heredado · LOS NOMBRES SIN DECLARAR DE `apps/web/heredado` (DP-22).
 *
 * Las pantallas heredadas (`heredado/*.jsx`) no pasan por lint ni por tipos, y son las que más
 * se tocan. Un nombre sin declarar ahí —un `useRef` que nadie importó, una variable que se
 * renombró a medias— no lo ve ninguna puerta: truena al ABRIR la pantalla, en el restaurante.
 * Pasó en DP-21 (un `useRef` sin importar tumbaba una sección entera de Configuración) y desde
 * entonces el barrido se corría a mano antes de cada commit. Ésta es la puerta.
 *
 * Qué mira: el compilador de TypeScript lee todo `heredado/` como JavaScript (`allowJs`,
 * `checkJs`) y de todos sus diagnósticos sólo cuentan dos: TS2304 («Cannot find name») y TS2552
 * («Cannot find name… did you mean…»). No es una revisión de tipos: lo demás del heredado no se
 * mide aquí.
 *
 * Una puerta que no se ha visto fallar no sirve: antes de mirar el heredado se le da un archivo
 * de prueba con un nombre sin declarar y otro limpio, y tiene que marcar el primero y sólo ése.
 */
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));
const WEB = join(RAIZ, 'apps', 'web');
const HEREDADO = join(WEB, 'heredado');
/** «Cannot find name 'X'» y su variante con sugerencia. */
const SIN_DECLARAR = new Set([2304, 2552]);

const OPCIONES = {
  allowJs: true,
  checkJs: true,
  noEmit: true,
  jsx: ts.JsxEmit.Preserve,
  skipLibCheck: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  typeRoots: [join(WEB, 'node_modules', '@types')],
  types: ['node', 'react', 'react-dom'],
  baseUrl: WEB,
  paths: {
    '@/lib/packageConfig': ['./src/cliente/package-config.ts'],
    '@/*': ['./heredado/*'],
    '~/*': ['./src/*'],
  },
};

function archivosDe(carpeta) {
  const salida = [];
  for (const nombre of readdirSync(carpeta).sort()) {
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) {
      if (nombre !== 'node_modules') salida.push(...archivosDe(ruta));
    } else if (/\.jsx?$/u.test(nombre)) {
      salida.push(ruta);
    }
  }
  return salida;
}

/**
 * Los tramos de comentario de documentación de un archivo. Con `checkJs` el compilador también
 * lee los tipos escritos en un `@returns { … }`, y uno mal escrito da «Cannot find name» sobre
 * un texto que nunca corre: eso no truena en el restaurante y no es de esta puerta.
 */
function tramosDeDocumentacion(fuente) {
  const tramos = [];
  const andar = (nodo) => {
    for (const documento of nodo.jsDoc ?? []) tramos.push([documento.pos, documento.end]);
    ts.forEachChild(nodo, andar);
  };
  andar(fuente);
  return tramos;
}

/** Los nombres sin declarar de esos archivos: `{ archivo, linea, columna, mensaje }`. */
function sinDeclarar(archivos, anfitrion = ts.createCompilerHost(OPCIONES)) {
  const programa = ts.createProgram(archivos, OPCIONES, anfitrion);
  const propios = new Set(archivos.map((ruta) => ruta.replaceAll('\\', '/')));
  const salida = [];
  for (const fuente of programa.getSourceFiles()) {
    if (!propios.has(fuente.fileName.replaceAll('\\', '/'))) continue;
    const documentacion = tramosDeDocumentacion(fuente);
    for (const diagnostico of programa.getSemanticDiagnostics(fuente)) {
      if (!SIN_DECLARAR.has(diagnostico.code) || diagnostico.start === undefined) continue;
      const donde = diagnostico.start;
      if (documentacion.some(([desde, hasta]) => donde >= desde && donde < hasta)) continue;
      const { line, character } = fuente.getLineAndCharacterOfPosition(diagnostico.start);
      salida.push({
        archivo: relative(RAIZ, fuente.fileName).replaceAll('\\', '/'),
        linea: line + 1,
        columna: character + 1,
        mensaje: ts.flattenDiagnosticMessageText(diagnostico.messageText, ' '),
      });
    }
  }
  return salida;
}

/**
 * La puerta, contra sí misma: un archivo con un nombre sin declarar (el `useRef` que nadie
 * importó) y otro limpio, los dos en memoria. Tiene que marcar el primero y sólo ése.
 */
function autoprueba() {
  const roto = join(HEREDADO, '__puerta__', 'roto.jsx');
  const limpio = join(HEREDADO, '__puerta__', 'limpio.jsx');
  const textos = new Map([
    [
      roto,
      'export function Roto() {\n  const ancla = useRef(null);\n  return <div ref={ancla} />;\n}\n',
    ],
    [
      limpio,
      [
        "import { useRef } from 'react';",
        '/**',
        ' * Un tipo mal escrito en la documentación no cuenta: no corre.',
        ' * @returns { compatible: boolean }',
        ' */',
        'export function Limpio() {',
        '  const ancla = useRef(null);',
        '  return <div ref={ancla} onClick={() => window.alert(document.title)} />;',
        '}',
        '',
      ].join('\n'),
    ],
  ]);
  const anfitrion = ts.createCompilerHost(OPCIONES);
  const leerDeVerdad = anfitrion.readFile.bind(anfitrion);
  const existeDeVerdad = anfitrion.fileExists.bind(anfitrion);
  anfitrion.readFile = (ruta) => textos.get(join(ruta)) ?? leerDeVerdad(ruta);
  anfitrion.fileExists = (ruta) => textos.has(join(ruta)) || existeDeVerdad(ruta);
  const hallados = sinDeclarar([roto, limpio], anfitrion);
  const delRoto = hallados.filter(({ archivo }) => archivo.endsWith('roto.jsx'));
  const delLimpio = hallados.filter(({ archivo }) => archivo.endsWith('limpio.jsx'));
  if (delRoto.length !== 1 || !delRoto[0].mensaje.includes('useRef') || delLimpio.length !== 0) {
    console.error('✗ verify:heredado no se pudo fiar de sí misma:');
    console.error(`  esperaba 1 nombre sin declarar (useRef) en el archivo roto y 0 en el limpio;`);
    console.error(`  encontró ${JSON.stringify(hallados)}`);
    process.exit(2);
  }
}

autoprueba();
const archivos = archivosDe(HEREDADO);
const hallados = sinDeclarar(archivos);
if (hallados.length > 0) {
  console.error(`✗ ${String(hallados.length)} nombre(s) sin declarar en apps/web/heredado:`);
  for (const { archivo, linea, columna, mensaje } of hallados) {
    console.error(`  ${archivo}:${String(linea)}:${String(columna)}  ${mensaje}`);
  }
  console.error(
    'Cada uno truena al abrir su pantalla. Importa o declara el nombre (o corrige el que se quiso escribir).',
  );
  process.exit(1);
}
console.log(
  `✓ ${String(archivos.length)} archivos de apps/web/heredado sin nombres sin declarar (la puerta se probó contra sí misma).`,
);
