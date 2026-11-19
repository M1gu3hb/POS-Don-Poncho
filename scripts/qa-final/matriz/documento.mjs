/**
 * DP-22 · EL MAPA TOTAL · el documento: de los datos del mapa a `docs/qa-final/MATRIZ.md`.
 */
import { writeFileSync } from 'node:fs';

import * as prettier from 'prettier';

import { estadoDelFlujo, NO_APLICA, resumenDeFlujos } from './flujos.mjs';

const SIGLAS = {
  dueno: 'Du',
  administrador: 'Ad',
  gerente: 'Ge',
  cajero: 'Cj',
  mesero: 'Me',
  cocina: 'Co',
  almacen: 'Al',
};
const ORDEN = Object.keys(SIGLAS);

const celda = (texto) => String(texto).replaceAll('|', '\\|').replaceAll('\n', ' ');
const tabla = (cabeceras, filas) =>
  [
    `| ${cabeceras.join(' | ')} |`,
    `| ${cabeceras.map(() => '---').join(' | ')} |`,
    ...filas.map((fila) => `| ${fila.map(celda).join(' | ')} |`),
  ].join('\n');

const puestosDe = (lista) =>
  lista.length === ORDEN.length
    ? 'todos'
    : ORDEN.filter((puesto) => lista.includes(puesto))
        .map((puesto) => SIGLAS[puesto])
        .join(' ') || '—';

/** Las primeras citas y cuántas más hay: la lista entera vive en `matriz.json`. */
const citas = (lista, cuantas = 2) => {
  if (lista.length === 0) return '**nadie**';
  const visibles = lista.slice(0, cuantas).map((cita) => `\`${cita}\``);
  const resto = lista.length - visibles.length;
  return resto > 0 ? `${visibles.join(', ')} (+${String(resto)})` : visibles.join(', ');
};

const ESTADOS = [
  'vacía',
  'con datos',
  'muchos datos',
  'error',
  'cargando',
  'barra abierta',
  'barra plegada',
];

function seccionDePantallas(mapa) {
  const filas = mapa.pantallas.map((pantalla) => [
    `\`${pantalla.ruta}\``,
    `\`${pantalla.principal.replace('apps/web/', '')}\``,
    pantalla.conSesion ? puestosDe(pantalla.puestos) : 'sin sesión',
    pantalla.ventanas.length,
    pantalla.archivos.length,
    pantalla.cobertura === null
      ? '—'
      : `${String(pantalla.cobertura.aparatos)} aparatos · ${String(pantalla.cobertura.estados)} estados · ${String(pantalla.cobertura.hallazgos)} hallazgos`,
  ]);
  const ventanas = mapa.pantallas
    .filter((pantalla) => pantalla.ventanas.length > 0)
    .map((pantalla) => {
      const renglones = pantalla.ventanas.map(
        (ventana) =>
          `  - ${ventana.tipo} · \`${ventana.componente}\`${ventana.titulo === null ? '' : ` · «${ventana.titulo}»`}`,
      );
      return `- \`${pantalla.ruta}\` (${String(pantalla.ventanas.length)})\n${renglones.join('\n')}`;
    });
  return [
    '## 1 · Pantallas',
    '',
    `Puestos: ${ORDEN.map((puesto) => `${SIGLAS[puesto]} = ${puesto}`).join(', ')}. «Ventanas» son los diálogos, confirmaciones y paneles que la pantalla puede abrir (por la cadena de importaciones de su página). Estados que se recorren en cada una: ${ESTADOS.join(', ')}.`,
    '',
    tabla(['Ruta', 'La pinta', 'Quién la abre', 'Ventanas', 'Archivos', 'Recorrido'], filas),
    '',
    '### 1.1 · Las ventanas de cada pantalla',
    '',
    ...ventanas,
    '',
    `Del armazón (las comparten todas): ${mapa.delArmazon.map((ventana) => `\`${ventana.componente}\``).join(', ') || 'ninguna'}.`,
  ].join('\n');
}

const estadoDe = (ajuste) => ajuste.efecto?.estado ?? '**sin definir**';
const pruebasDe = (ajuste) =>
  (ajuste.efecto?.pruebas ?? []).length === 0
    ? '**falta**'
    : ajuste.efecto.pruebas.map((prueba) => `\`${prueba}\``).join(', ');

function seccionDeAjustes(mapa) {
  const { delNegocio, delAparato, tarjetasSinClave } = mapa.ajustes;
  const filaDe = (ajuste) => [
    `\`${ajuste.clave}\``,
    ajuste.tarjeta === null ? '— (sin tarjeta)' : `${ajuste.seccion} · ${ajuste.tarjeta}`,
    ajuste.con ?? '—',
    citas(ajuste.lectores),
    ajuste.efecto?.efecto ?? '—',
    pruebasDe(ajuste),
    estadoDe(ajuste),
  ];
  const cabeceras = [
    'Clave',
    'Dónde se cambia',
    'Con qué se guarda',
    'Quién la lee',
    'Qué debe cambiar',
    'La prueba',
    'Estado',
  ];
  return [
    '## 2 · Ajustes',
    '',
    '### 2.1 · Del negocio',
    '',
    tabla(cabeceras, delNegocio.map(filaDe)),
    '',
    '### 2.2 · Tarjetas que no guardan una clave de la configuración',
    '',
    tabla(
      [
        'Tarjeta',
        'Sección',
        'Con qué se guarda',
        'Quién la ve',
        'Qué debe cambiar',
        'La prueba',
        'Estado',
      ],
      tarjetasSinClave.map((tarjeta) => [
        tarjeta.titulo,
        tarjeta.seccion,
        tarjeta.con,
        tarjeta.visiblePara,
        tarjeta.efecto?.efecto ?? '—',
        pruebasDe(tarjeta),
        estadoDe(tarjeta),
      ]),
    ),
    '',
    '### 2.3 · De este aparato (se guardan en el navegador del aparato)',
    '',
    tabla(cabeceras, delAparato.map(filaDe)),
  ].join('\n');
}

function seccionDeFlujos(mapa) {
  const filas = mapa.flujos.map((flujo) => [
    flujo.area,
    flujo.flujo,
    flujo.pruebas.length === 0
      ? flujo.estado === NO_APLICA
        ? '—'
        : '**falta**'
      : flujo.pruebas.map((ruta) => `\`${ruta}\``).join(', '),
    estadoDelFlujo(flujo),
  ]);
  return [
    '## 3 · Flujos del restaurante',
    '',
    tabla(['Área', 'Flujo', 'Pruebas', 'Estado'], filas),
  ].join('\n');
}

function seccionDeComandos(mapa) {
  const conPantalla = mapa.comandos.filter((comando) => comando.llamadas.length > 0);
  const sinPantalla = mapa.comandos.filter((comando) => comando.llamadas.length === 0);
  const filaDe = (comando) => [
    `\`${comando.comando}\``,
    `\`${comando.ruta}\``,
    comando.escribe ? 'sí' : 'no',
    puestosDe(comando.puestos),
    comando.pantallas.map((ruta) => `\`${ruta}\``).join(', ') || '—',
    citas(comando.llamadas, 1),
  ];
  return [
    '## 4 · Comandos',
    '',
    tabla(
      ['Comando', 'Ruta', 'Escribe', 'Puestos', 'Pantallas que lo usan', 'Dónde se llama'],
      conPantalla.map(filaDe),
    ),
    '',
    `### 4.1 · Comandos sin pantalla (${String(sinPantalla.length)})`,
    '',
    tabla(
      ['Comando', 'Ruta', 'Escribe', 'Puestos'],
      sinPantalla.map((comando) => filaDe(comando).slice(0, 4)),
    ),
    '',
    '## 5 · Lecturas del puente (`api.entidades.X`)',
    '',
    tabla(
      ['Entidad', 'Operaciones', 'Puestos que la leen', 'Pantallas'],
      mapa.entidades.map((entidad) => [
        `\`${entidad.entidad}\``,
        entidad.operaciones.join(', '),
        entidad.puestosQueLaLeen === null
          ? 'regla propia (fuera de `mapa.ts`)'
          : puestosDe(entidad.puestosQueLaLeen),
        entidad.pantallas.map((ruta) => `\`${ruta}\``).join(', '),
      ]),
    ),
  ].join('\n');
}

function resumen(mapa, faltantes) {
  const { delNegocio, delAparato } = mapa.ajustes;
  const todos = [...delNegocio, ...delAparato];
  const sinLector = delNegocio.filter((ajuste) => ajuste.lectores.length === 0);
  const flujos = resumenDeFlujos(mapa.flujos);
  const ventanas = mapa.pantallas.reduce((suma, pantalla) => suma + pantalla.ventanas.length, 0);
  return [
    '## Resumen',
    '',
    `- **Pantallas:** ${String(mapa.pantallas.length)} rutas (${String(mapa.pantallas.filter((p) => p.conSesion).length)} con sesión) y ${String(ventanas)} ventanas.`,
    `- **Ajustes:** ${String(delNegocio.length)} del negocio y ${String(delAparato.length)} de este aparato; ${String(todos.filter((ajuste) => ajuste.efecto?.estado === 'comprobado').length)} con su efecto comprobado; ${String(sinLector.length)} que nadie lee (${sinLector.map((ajuste) => `\`${ajuste.clave}\``).join(', ') || 'ninguno'}).`,
    `- **Flujos:** ${String(mapa.flujos.length)}; ${String(flujos.sinPrueba)} todavía sin prueba; ${String(flujos.noAplica)} «no aplica» declarado con su razón.`,
    `- **Comandos:** ${String(mapa.comandos.length)} del restaurante; ${String(mapa.comandos.filter((comando) => comando.llamadas.length === 0).length)} sin pantalla. **Lecturas del puente:** ${String(mapa.entidades.length)} entidades.`,
    `- **Huecos del mapa** (\`--verificar\`): ${String(faltantes.length)}.`,
  ].join('\n');
}

export async function escribirDocumento(mapa, faltantes, destino) {
  const texto = [
    '# MATRIZ · DP-22 · El mapa total',
    '',
    `> Generado por \`node scripts/qa-final/generar-matriz.mjs\` sobre \`${mapa.commit}\`. **No se edita a mano**: lo que cambia se cambia en el código o en \`qa/qa-final/datos/\` (\`efectos.json\`, \`flujos.json\`) y se vuelve a generar. Las listas completas (todas las citas \`archivo:línea\`) están en \`qa/qa-final/datos/matriz.json\`.`,
    '',
    resumen(mapa, faltantes),
    '',
    seccionDePantallas(mapa),
    '',
    seccionDeAjustes(mapa),
    '',
    seccionDeFlujos(mapa),
    '',
    seccionDeComandos(mapa),
    '',
  ].join('\n');
  const opciones = (await prettier.resolveConfig(destino)) ?? {};
  writeFileSync(destino, await prettier.format(texto, { ...opciones, filepath: destino }));
}
