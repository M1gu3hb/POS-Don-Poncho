/**
 * IMPRIMIR DIRECTO POR LA APP (DP-20 · Parte 3 y refuerzo §1 y §4). Sólo navegador.
 *
 * Del documento de la pantalla a la impresora del aparato: se dibuja cada copia al ancho de
 * la impresora, se arma UN trabajo (el cajón una sola vez; por cada copia su imagen, el avance y
 * el corte) y se le entrega a la app. El avance vuelve por el evento `progreso`.
 */
import type { MorphiqApp, Resultado, Trabajo } from './puente/contrato.ts';
import { PAPEL } from './termico/colores-del-papel.ts';
import { dibujarPieza, mapaComoPng, type Pieza } from './termico/dibujar-elemento.ts';
import type { MapaDeBits } from './termico/mapa.ts';
import type { PerfilDeImpresion } from './termico/perfil.ts';
import { aBase64, armarTrabajo } from './termico/trabajo.ts';
import { falloDelPuente, type ControlesDelTrabajo, type FinDelTrabajo } from './trabajos.ts';

export interface DocumentoAImprimir {
  /** Con qué nombre se guarda como «el último ticket» del aparato. */
  readonly titulo: string;
  /** Una pieza por copia: el mismo documento, cada una con su pie. */
  readonly copias: readonly Pieza[];
  /** Abrir el cajón con este trabajo: una sola vez, no una por copia. */
  readonly abrirCajon?: boolean;
  /** Lo que debe salir al «Reimprimir el último ticket» sin internet (ya dice REIMPRESIÓN). */
  readonly paraReimprimir?: Pieza;
}

export interface TrabajoArmado {
  readonly mapas: readonly MapaDeBits[];
  readonly bytes: Uint8Array;
  readonly avisos: readonly string[];
}

/** Dibuja las copias y arma los bytes, sin mandar nada (lo usa también la vista previa). */
export async function armarDocumento(
  perfil: PerfilDeImpresion,
  copias: readonly Pieza[],
  abrirCajon: boolean,
): Promise<TrabajoArmado> {
  const mapas: MapaDeBits[] = [];
  const avisos: string[] = [];
  for (const copia of copias) {
    const dibujado = await dibujarPieza(copia, { puntos: perfil.puntos, umbral: perfil.umbral });
    mapas.push(dibujado.mapa);
    avisos.push(...dibujado.avisos);
  }
  return { mapas, bytes: armarTrabajo(perfil, mapas, { abrirCajon }), avisos };
}

/** El documento para el driver de Windows: la MISMA imagen de 1 bit, una por hoja. */
function paginaParaElDriver(mapas: readonly MapaDeBits[]): string {
  const hojas = mapas
    .map(
      (mapa) =>
        `<img alt="" src="${mapaComoPng(mapa)}" style="display:block;width:100%;break-after:page">`,
    )
    .join('');
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    `<style>@page{margin:0}html,body{margin:0;padding:0;background:${PAPEL}}img{image-rendering:pixelated}</style>` +
    `</head><body>${hojas}</body></html>`
  );
}

function avanceDe(datos: unknown, id: string): number | null {
  if (typeof datos !== 'object' || datos === null) return null;
  const { id: deQuien, enviados, total } = datos as Record<string, unknown>;
  if (deQuien !== id || typeof enviados !== 'number' || typeof total !== 'number' || total <= 0)
    return null;
  return Math.min(1, enviados / total);
}

export function finDe(resultado: Resultado): FinDelTrabajo {
  if (!resultado.ok)
    return { ok: false, fallo: falloDelPuente(resultado.codigo, resultado.mensaje) };
  // Un id que la app ya había entregado no imprime otra vez: para la persona, ya salió.
  return { ok: true, estado: resultado.estado === 'impreso' ? 'impreso' : 'enviado' };
}

export async function imprimirEnLaApp(
  app: MorphiqApp,
  perfil: PerfilDeImpresion,
  documento: DocumentoAImprimir,
  controles: ControlesDelTrabajo,
): Promise<FinDelTrabajo> {
  const abrirCajon = documento.abrirCajon === true;
  const armado = await armarDocumento(perfil, documento.copias, abrirCajon);
  const comun = { bloqueBytes: perfil.bloqueBytes, pausaMs: perfil.pausaMs } as const;

  let trabajo: Trabajo;
  if (perfil.lenguaje === 'driver') {
    trabajo = {
      id: controles.id,
      destino: perfil.destino,
      documento: { tipo: 'html', html: paginaParaElDriver(armado.mapas), anchoMm: perfil.papelMm },
    };
  } else {
    const paraReimprimir =
      documento.paraReimprimir === undefined
        ? undefined
        : await armarDocumento(perfil, [documento.paraReimprimir], false);
    trabajo = {
      id: controles.id,
      destino: perfil.destino,
      documento: { tipo: 'crudo', base64: aBase64(armado.bytes), ...comun },
      ...(paraReimprimir === undefined
        ? {}
        : {
            recordar: {
              titulo: documento.titulo,
              documento: { tipo: 'crudo', base64: aBase64(paraReimprimir.bytes), ...comun },
            },
          }),
    };
  }

  controles.avanzar(null);
  const dejarDeEscuchar = app.escuchar('progreso', (datos) => {
    const avance = avanceDe(datos, controles.id);
    if (avance !== null) controles.avanzar(avance);
  });
  try {
    return finDe(await app.imprimir(trabajo));
  } finally {
    dejarDeEscuchar();
  }
}
