import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * DP-21 · Bloque 6 · CONTRATO: nadie pinta un folio crudo.
 *
 * El folio se lee con `folioVisible` (`@morphiqpos/domain/venta`): «DP-01001» las cuentas,
 * «DPC-0101» los cortes, y sin prefijo lo de siempre. Esta prueba recorre `heredado/` y `src/` (sin
 * pruebas) y exige que todo acceso a `.folio`, `folio:` o `['folio']` esté DENTRO de la llamada de
 * uno de los formateadores, o declarado abajo con su razón (comparar, mandar al servidor, armar el
 * dato que otro pinta con el formateador). Una pantalla que mañana pinte `{venta.folio}` rompe aquí.
 */

const WEB = fileURLToPath(new URL('../..', import.meta.url));
const CARPETAS = ['heredado', 'src'];
const ACCESO = /\.folio\b|\bfolio\s*:|\[\s*['"]folio['"]\s*\]/g;

/** Las funciones que vistan el folio (las demás lo llaman por dentro). */
const FORMATEADORES = [
  'folioVisible',
  'coincideConElFolio',
  'entenderElFolio',
  'folioDeLaHoja',
  'folioConSerie',
  'folioDeLaVenta',
  'folioDelCorte',
];

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (nombre === 'node_modules' || nombre === '.next') return [];
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.(ts|tsx|js|jsx)$/.test(nombre) && !/\.(test|spec)\./.test(nombre) ? [ruta] : [];
  });
}

function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
}

/** Los nombres de las llamadas que envuelven la posición, de la más cercana a la más lejana. */
function llamadasQueEnvuelven(codigo: string, indice: number): string[] {
  const nombres: string[] = [];
  let profundidad = 0;
  for (let i = indice - 1; i >= 0; i -= 1) {
    const c = codigo[i];
    if (c === ')') profundidad += 1;
    else if (c === '(') {
      if (profundidad > 0) profundidad -= 1;
      else nombres.push(/([A-Za-z_$][\w$]*)\s*$/.exec(codigo.slice(0, i))?.[1] ?? '');
    }
  }
  return nombres;
}

/**
 * Lo que no pinta, y por qué. `contiene` es un trozo del código de ese acceso: si el código cambia,
 * la excepción deja de aplicar y la prueba pide decidir otra vez.
 */
const NO_PINTA: readonly { archivo: string; contiene: string; razon: string }[] = [
  {
    archivo: 'heredado/pages/Caja.jsx',
    contiene: 'folio: cobro?.folio ? String(cobro.folio) : ventaSeleccionada?.folio',
    razon: 'arma la venta que el ticket pinta con folioVisible (lleva su serie justo debajo)',
  },
  {
    archivo: 'heredado/pages/Caja.jsx',
    contiene: 'cobro?.folio ? String(cobro.folio) : undefined',
    razon: 'va al servidor como referencia del cajón; la auditoría lo viste (describir-accion)',
  },
  {
    archivo: 'heredado/pages/Caja.jsx',
    contiene: 'cobro?.folio ? String(cobro.folio) : ventaSeleccionada?.folio',
    razon: 'ídem: el dato del ticket',
  },
  {
    archivo: 'heredado/pages/Caja.jsx',
    contiene: 'arqueo?.serie && arqueo?.folio',
    razon: 'sólo pregunta si el cierre trajo folio; el texto sale de folioVisible',
  },
  {
    archivo: 'heredado/pages/Caja.jsx',
    contiene: 'folio: folioDelCorte',
    razon: 'arma el corte con el folio ya vestido por folioVisible',
  },
  {
    archivo: 'heredado/pages/POS.jsx',
    contiene: 'const folio = ticket?.folio',
    razon: 'sólo pregunta si hay folio; el texto sale de folioVisible (la línea de abajo)',
  },
  {
    archivo: 'heredado/pages/Ventas.jsx',
    contiene: '{v.folio ? (',
    razon: 'sólo decide si hay folio que pintar (DP-12.6); se pinta con folioVisible',
  },
  {
    archivo: 'heredado/pages/Ventas.jsx',
    contiene: '{selectedVenta?.folio',
    razon: 'sólo decide el título; el folio se pinta con folioVisible en la línea siguiente',
  },
  {
    archivo: 'src/venta/DevolucionDeVenta.tsx',
    contiene: 'folio: folio.trim()',
    razon: 'lo que el cajero tecleó va al servidor, que lo entiende con entenderElFolio',
  },
  {
    archivo: 'src/configuracion/FoliosDelNegocio.tsx',
    contiene: 'f.folio',
    razon: 'sólo pregunta si ya se dio algún folio (no lo pinta)',
  },
  {
    archivo: 'src/configuracion/folios-formulario.ts',
    contiene: 'con folio:',
    razon: 'texto de la explicación, no el campo',
  },
  {
    archivo: 'src/corte/hoja.ts',
    contiene: 'sesion.folio',
    razon:
      'la hoja del corte trae sus folios ya vestidos por el servidor (`caja/corte/folios-vestidos.ts`)',
  },
  {
    archivo: 'src/corte/hoja.ts',
    contiene: 'v.folio',
    razon: 'folio de la fila de la hoja: ya vestido por el servidor',
  },
  {
    archivo: 'src/corte/hoja.ts',
    contiene: 'folio:',
    razon: 'tipos de lo que llega vestido del servidor',
  },
  {
    archivo: 'src/corte/devoluciones.ts',
    contiene: 'd.folio',
    razon: 'folio de la fila de la hoja: ya vestido por el servidor',
  },
  {
    archivo: 'src/corte/cancelaciones.ts',
    contiene: 'c.folio',
    razon: 'folio de la fila de la hoja: ya vestido por el servidor',
  },
  {
    archivo: 'src/corte/filtrar-cancelaciones.ts',
    contiene: 'c.folio',
    razon: 'el buscador compara contra el texto que el servidor ya vistió',
  },
  {
    archivo: 'src/corte/CancelacionesRegistradas.tsx',
    contiene: 'c.folio',
    razon: 'folio ya vestido por el servidor',
  },
  {
    archivo: 'src/corte/HojaDelCorte.tsx',
    contiene: 'documento.folio',
    razon: 'el documento sale de `folioDe`, que usa el folio vestido del servidor',
  },
  {
    archivo: 'src/corte/CorteEnPdf.tsx',
    contiene: 'documento.folio',
    razon: 'ídem: el folio del documento del corte',
  },
  {
    archivo: 'src/corte-heredado/descuentos-del-corte.ts',
    contiene: 'folio',
    razon: 'folio de los descuentos: ya vestido por el servidor',
  },
  {
    archivo: 'src/corte-heredado/folio-y-mesa.ts',
    contiene: 'folio',
    razon: 'el «como hoy» de los documentos viejos: compone serie y número sin prefijo',
  },
  {
    archivo: 'src/registros/describir-accion.ts',
    contiene: "p['folio']",
    razon: 'el payload de la auditoría se viste con folioVisible en la misma frase',
  },
  {
    archivo: 'src/impresion/pantallas/datos-de-ejemplo.ts',
    contiene: 'folio',
    razon: 'datos inventados (folio «EJEMPLO»): no es un folio',
  },
  {
    archivo: 'src/restaurante/corte-del-registro.ts',
    contiene: 'folio',
    razon: 'es el formateador del registro (delega en folioVisible)',
  },
  {
    archivo: 'src/restaurante/hoja-de-la-precuenta.ts',
    contiene: 'folio',
    razon: 'es el formateador de la hoja (delega en folioVisible)',
  },
  {
    archivo: 'src/registros/folio-exacto.ts',
    contiene: 'folio',
    razon: 'compara con coincideConElFolio',
  },
  {
    archivo: 'src/exportacion/columnas-con-folio.ts',
    contiene: 'folio',
    razon: 'es el formateador de las exportaciones',
  },
  {
    archivo: 'heredado/lib/exportColumns.js',
    contiene: "key: 'folio'",
    razon: 'define la columna; Registros la pasa por columnasConFolio',
  },
  // DP-D153 · Los cortes en la carpeta: el folio YA vestido se vuelve nombre de archivo; no se pinta.
  {
    archivo: 'heredado/components/cortes/CorteAutoDownloader.jsx',
    contiene: 'folio: folioParaElArchivo(folioVisible(',
    razon: 'el folio vestido por folioVisible, hecho nombre del PDF para la carpeta de cortes',
  },
  {
    archivo: 'heredado/components/cortes/CorteViewerDialog.jsx',
    contiene: 'folio: folioParaElArchivo(folioVisible(',
    razon: 'ídem: el nombre del PDF que se guarda desde Registros',
  },
  {
    archivo: 'src/corte/carpeta/entregar-el-pdf.ts',
    contiene: 'readonly datos: { readonly folio: string',
    razon: 'el tipo del pedido de entrega: el folio que ya es nombre de archivo',
  },
  {
    archivo: 'src/corte/carpeta/guardar-en-la-carpeta.ts',
    contiene: 'archivos.guardar({ folio: corte.folio',
    razon:
      'va a la app de Windows, que arma con él el nombre del PDF (ya pasó por folioParaElArchivo)',
  },
  {
    archivo: 'src/corte/carpeta/nombre-del-pdf.ts',
    contiene: 'export function folioParaElArchivo(folio:',
    razon: 'es quien convierte el folio vestido en nombre de archivo',
  },
];

const pantallas = CARPETAS.flatMap((c) => archivos(join(WEB, c))).map((ruta) => ({
  ruta: relative(WEB, ruta).replaceAll('\\', '/'),
  codigo: sinComentarios(readFileSync(ruta, 'utf8')),
}));

interface Hallazgo {
  readonly ruta: string;
  readonly linea: string;
}

function crudos(): Hallazgo[] {
  const salida: Hallazgo[] = [];
  for (const { ruta, codigo } of pantallas) {
    for (const m of codigo.matchAll(ACCESO)) {
      const enLaLlamada = llamadasQueEnvuelven(codigo, m.index).some((n) =>
        FORMATEADORES.includes(n),
      );
      if (enLaLlamada) continue;
      const ini = codigo.lastIndexOf('\n', m.index) + 1;
      const fin = codigo.indexOf('\n', m.index);
      const linea = codigo.slice(ini, fin === -1 ? undefined : fin).trim();
      // Declarar el tipo de un campo no pinta nada.
      if (linea.startsWith('readonly folio')) continue;
      const exento = NO_PINTA.some((e) => e.archivo === ruta && linea.includes(e.contiene));
      if (!exento) salida.push({ ruta, linea });
    }
  }
  return salida;
}

describe('ningún papel ni pantalla pinta el folio crudo', () => {
  it('todo acceso a `.folio` pasa por el formateador o está declarado con su razón', () => {
    expect(crudos()).toEqual([]);
  });

  it('el contrato no está ciego: ve los folios que sí pasan por `folioVisible`', () => {
    const conFormateador = pantallas.filter((p) => p.codigo.includes('folioVisible('));
    expect(conFormateador.length).toBeGreaterThanOrEqual(20);
    for (const ruta of [
      'heredado/components/tickets/PreCuentaTicket.jsx',
      'heredado/pages/Caja.jsx',
      'heredado/pages/Registros.jsx',
      'heredado/pages/Ventas.jsx',
    ]) {
      expect(conFormateador.map((p) => p.ruta)).toContain(ruta);
    }
  });

  it('detecta un `{venta.folio}` pintado a pelo', () => {
    const codigo = 'return <p>{venta.folio}</p>;';
    const m = [...codigo.matchAll(ACCESO)][0];
    expect(m).toBeDefined();
    expect(llamadasQueEnvuelven(codigo, m?.index ?? 0).some((n) => FORMATEADORES.includes(n))).toBe(
      false,
    );
    const ok = 'return <p>{folioVisible(venta.serie, venta.folio, config)}</p>;';
    const n = [...ok.matchAll(ACCESO)][0];
    expect(llamadasQueEnvuelven(ok, n?.index ?? 0).some((x) => FORMATEADORES.includes(x))).toBe(
      true,
    );
  });

  it('cada excepción sigue existiendo (si el código cambió, hay que decidir otra vez)', () => {
    for (const e of NO_PINTA) {
      const p = pantallas.find((x) => x.ruta === e.archivo);
      expect(p, e.archivo).toBeDefined();
      expect(p?.codigo.includes(e.contiene), `${e.archivo}: ${e.contiene}`).toBe(true);
    }
  });
});
