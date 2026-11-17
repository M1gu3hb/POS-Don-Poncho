import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-D153 · LAS PANTALLAS QUE USAN LA CARPETA, leídas como código (un test de componentes no pinta
 * aquí; las de `heredado/` ni siquiera tienen tipos). Se valida mutando el código real:
 *
 *   · los botones nuevos y la ayuda sólo salen si la app anuncia `archivos`;
 *   · en un navegador o con la app 1.0.1 la descarga es la MISMA llamada de antes;
 *   · el cierre no espera al guardado, y el visor no guarda un corte que no se leyó entero;
 *   · lo nuevo mide 44 px.
 */
const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

const CIERRE = leer('src/corte/CorteEnPdf.tsx');
const AUTO = leer('heredado/components/cortes/CorteAutoDownloader.jsx');
const VISOR = leer('heredado/components/cortes/CorteViewerDialog.jsx');
const REGISTROS = leer('heredado/pages/Registros.jsx');

/** Los `<Button …>` que dicen este texto (de la apertura al cierre). */
function botonesCon(codigo: string, texto: string): string[] {
  return [...codigo.matchAll(/<Button\b[\s\S]*?<\/Button>/g)]
    .map((m) => m[0])
    .filter((boton) => boton.includes(texto));
}

describe('el cierre de la caja (CorteEnPdf)', () => {
  it('con la app va a la carpeta SIN esperar; sin ella, baja como siempre', () => {
    expect(CIERRE).toMatch(/entregarSinEsperar\(/);
    expect(CIERRE).not.toMatch(/await entregarSinEsperar/);
    expect(CIERRE).toMatch(
      /if \(archivos === null\) void bajar\(documento\);\s*else guardarEnLaCarpeta\(/,
    );
  });

  it('«Guardar en la carpeta», «Abrir carpeta» y la ayuda sólo salen con la app', () => {
    const inicio = CIERRE.indexOf('archivos !== null && estado.paso');
    expect(inicio).toBeGreaterThan(-1);
    for (const texto of ['Guardar en la carpeta', 'Abrir carpeta', 'AYUDA_DE_LA_CARPETA']) {
      expect(CIERRE.indexOf(texto, inicio), texto).toBeGreaterThan(inicio);
    }
    // Y el botón de siempre sigue fuera de esa condición.
    expect(CIERRE.indexOf('Descargar el PDF del corte')).toBeLessThan(inicio);
  });

  it('un fallo se ve con su aviso y NO cae a una descarga', () => {
    expect(CIERRE).toMatch(/No se guardó el PDF en la carpeta/);
    expect(CIERRE).toMatch(/Registros → Cortes/);
    expect(CIERRE).toMatch(/descargar: \(\) => Promise\.resolve\(\)/);
  });

  it('los botones nuevos miden 44 px', () => {
    for (const texto of ['Guardar en la carpeta', 'Abrir carpeta']) {
      const [boton] = botonesCon(CIERRE, texto);
      expect(boton, texto).toMatch(/\bmin-h-11\b/);
    }
  });
});

describe('el cierre del código heredado (CorteAutoDownloader)', () => {
  it('la descarga de siempre sigue siendo la misma llamada, con el mismo nombre', () => {
    expect(AUTO).toMatch(
      /descargar: \(\) => downloadNodeAsPDF\(ref\.current, `Corte_\$\{folio\}_\$\{fecha\}_\$\{negocio\}\.pdf`\)/,
    );
  });

  it('sólo guarda en carpeta si la app lo anuncia (`archivos` viene del hook)', () => {
    expect(AUTO).toMatch(/const \{ archivos \} = useCarpetaDeCortes\(\);/);
    expect(AUTO).toMatch(/entregarElPdfDelCorte\(\{\s*archivos,/);
  });

  it('si no se pudo guardar, avisa y deja el botón para reintentar', () => {
    expect(AUTO).toMatch(
      /entrega\.via === 'carpeta' && entrega\.ok === false\) \{\s*setError\(true\);/,
    );
  });
});

describe('el visor del corte (Registros)', () => {
  it('los botones nuevos y la ayuda sólo salen con la app', () => {
    expect(VISOR).toMatch(/\{archivos && \(\s*<>/);
    expect(VISOR).toMatch(/\{archivos && <p [^>]*>\{AYUDA_DE_LA_CARPETA\}<\/p>\}/);
  });

  it('sólo guarda con el corte leído entero (un PDF en ceros no es el corte)', () => {
    expect(VISOR).toMatch(/if \(!ticketRef\.current \|\| !archivos \|\| !cargadoBien\)/);
    expect(VISOR).toMatch(/setCargadoBien\(true\);\s*setLoading\(false\);/);
    expect(VISOR).toMatch(/disabled=\{loading \|\| !cargadoBien \|\| guardando\}/);
  });

  it('«guardar al cargar» guarda UNA vez y cierra sólo si salió bien', () => {
    expect(VISOR).toMatch(/yaGuardoSolo\.current = true;/);
    expect(VISOR).toMatch(/if \(guardarAlCargar\) onClose\(\);/);
  });

  it('el «Descargar» de siempre no cambió', () => {
    expect(VISOR).toMatch(/await downloadNodeAsPDF\(ticketRef\.current, filename\);/);
  });

  it('los botones nuevos miden 44 px', () => {
    for (const texto of ['Guardar en la carpeta', 'Abrir carpeta']) {
      const [boton] = botonesCon(VISOR, texto);
      expect(boton, texto).toMatch(/\bmin-h-11\b/);
    }
  });
});

describe('Registros → Cortes', () => {
  it('«Guardar en la carpeta» por corte y «Abrir carpeta» sólo con la app', () => {
    expect(REGISTROS).toMatch(/onSave=\{carpetaDeCortes \? setGuardarCorte : null\}/);
    expect(REGISTROS).toMatch(/\{onSave && \(/);
    expect(REGISTROS).toMatch(/\{carpetaDeCortes && \(\s*<Button/);
    expect(REGISTROS).toMatch(/\{carpetaDeCortes && <p [^>]*>\{AYUDA_DE_LA_CARPETA\}<\/p>\}/);
  });

  it('el visor de «guardar» va aparte y en modo «guardar al cargar»', () => {
    expect(REGISTROS).toMatch(/corte=\{guardarCorte\}[\s\S]*?guardarAlCargar/);
  });

  it('los botones nuevos miden 44 px', () => {
    for (const texto of ['Guardar en la carpeta', 'Abrir carpeta']) {
      const botones = botonesCon(REGISTROS, texto);
      expect(botones.length, texto).toBeGreaterThan(0);
      for (const boton of botones) expect(boton, texto).toMatch(/\bmin-h-11\b/);
    }
  });
});
