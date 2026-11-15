/**
 * `printDocument` DECIDE: LA APP O EL NAVEGADOR (DP-20 · Parte 2 y refuerzo §3 y §4). Sólo navegador.
 *
 * Las pantallas siguen llamando a `printDocument` como siempre. Aquí se decide:
 *
 *   · con la app y un perfil que imprime ese documento → el MISMO nodo que está en pantalla se
 *     dibuja al ancho de la impresora y sale directo, con su avance en la barra de impresión;
 *   · sin la app, sin perfil o si el aparato no imprime ese documento → el diálogo del navegador.
 *
 * El ticket de una venta se registra antes de salir (`venta.registrar_impresion`): la primera
 * salida es la original; las demás dicen «REIMPRESIÓN» con su fecha y hora.
 */
import { invocarComando } from '~/cliente/api';

import { copiasDe, copiasDelNegocio, esDocumentoTermico, type DocumentoTermico } from './copias.ts';
import { imprimirEnLaApp } from './imprimir-en-la-app.ts';
import { puenteDeLaApp, type MorphiqApp } from './puente/contrato.ts';
import { marcarReimpresion, ponerPie } from './termico/decorar.ts';
import type { Pieza } from './termico/dibujar-elemento.ts';
import { pieDeLaCopia, rotuloDeReimpresion } from './termico/estilo.ts';
import { leerPerfil, type PerfilDeImpresion } from './termico/perfil.ts';
import { nuevoIdDeTrabajo } from './termico/trabajo.ts';
import { MESA_DE_TRABAJOS, type ControlesDelTrabajo, type FinDelTrabajo } from './trabajos.ts';

export const LIENZO_TERMICO = '[data-lienzo-termico]';

interface RegistroDeImpresion {
  readonly numero: number;
  readonly reimpresion: boolean;
  readonly impresoEn: string;
}

/** La clave de idempotencia del registro: la parte al azar del id del trabajo (un reintento la repite). */
function claveDelTrabajo(id: string): string {
  return id.slice(-36);
}

/**
 * Las salidas que el servidor ya registró y cuyo papel todavía no sale (sin papel, tapa abierta):
 * el reintento —por la app o por el navegador— reusa ese registro en lugar de contar otra salida,
 * que haría decir «REIMPRESIÓN» al primer papel que la persona ve.
 */
const SIN_SALIR = new Map<string, string | null>();

/**
 * Registra la salida de un ticket. Devuelve la marca que lleva el papel, o `null` si es la
 * original. Lanza si el servidor no contesta.
 */
export async function registrarSalidaDelTicket(
  ordenId: string,
  idDelTrabajo: string,
): Promise<string | null> {
  const pendiente = SIN_SALIR.get(ordenId);
  if (pendiente !== undefined) return pendiente;
  const registro = await invocarComando<RegistroDeImpresion>(
    '/api/venta/registrar-impresion',
    { ordenId },
    { idempotencyKey: claveDelTrabajo(idDelTrabajo) },
  );
  const marca = registro.reimpresion ? rotuloDeReimpresion(new Date(registro.impresoEn)) : null;
  SIN_SALIR.set(ordenId, marca);
  return marca;
}

/** El papel de esa venta ya salió: la siguiente salida se registra de nuevo. */
export function salioElPapel(ordenId: string): void {
  SIN_SALIR.delete(ordenId);
}

export interface DocumentoEnPantalla {
  /** El `.ticket-printable` que está a la vista. */
  readonly objetivo: Element;
  readonly titulo: string;
  /** El diálogo del navegador, como siempre. */
  readonly alNavegador: () => void;
}

/** Lo que el documento dice de sí mismo en sus atributos. */
export function datosDelDocumento(objetivo: Element): {
  readonly tipo: DocumentoTermico;
  readonly ordenId: string | null;
} {
  const tipo = objetivo.getAttribute('data-documento');
  const ordenId = objetivo.getAttribute('data-orden-id');
  return {
    tipo: esDocumentoTermico(tipo) ? tipo : 'ticket',
    ordenId: ordenId === null || ordenId === '' ? null : ordenId,
  };
}

async function perfilDelAparato(app: MorphiqApp): Promise<PerfilDeImpresion | null> {
  try {
    return leerPerfil((await app.ajustes()).perfil);
  } catch (error: unknown) {
    // Sin poder leer el aparato no se imprime directo; el documento sale por el navegador.
    console.error('[impresion] no se pudieron leer los ajustes del aparato:', error);
    return null;
  }
}

async function tarea(
  app: MorphiqApp,
  perfil: PerfilDeImpresion,
  documento: DocumentoEnPantalla,
  lienzo: HTMLElement,
  controles: ControlesDelTrabajo,
): Promise<FinDelTrabajo> {
  const { tipo, ordenId } = datosDelDocumento(documento.objetivo);
  const marca =
    tipo === 'ticket' && ordenId !== null
      ? await registrarSalidaDelTicket(ordenId, controles.id)
      : null;
  // Una reimpresión es UN papel: las copias son de la primera salida.
  const total = marca === null ? copiasDe(copiasDelNegocio(), tipo) : 1;
  const copias: Pieza[] = Array.from({ length: total }, (_, i) => ({
    nodo: lienzo,
    preparar(copia: HTMLElement) {
      if (marca !== null) marcarReimpresion(copia, marca, perfil.papelMm);
      const pie = pieDeLaCopia(i + 1, total);
      if (pie !== null) ponerPie(copia, pie, perfil.papelMm);
    },
  }));
  const fin = await imprimirEnLaApp(
    app,
    perfil,
    {
      titulo: documento.titulo,
      copias,
      ...(tipo === 'ticket'
        ? {
            paraReimprimir: {
              nodo: lienzo,
              preparar(copia: HTMLElement) {
                marcarReimpresion(copia, 'Copia guardada en este aparato', perfil.papelMm);
              },
            },
          }
        : {}),
    },
    controles,
  );
  if (fin.ok && ordenId !== null) salioElPapel(ordenId);
  return fin;
}

const YA_QUEDO: Readonly<Record<DocumentoTermico, string>> = {
  ticket: 'La venta ya quedó cobrada: sólo falta el papel.',
  precuenta: 'La cuenta sigue abierta: sólo falta el papel.',
  corte: 'El corte ya quedó guardado: sólo falta el papel.',
  cierre: 'El cierre ya quedó guardado: sólo falta el papel.',
};

/**
 * Intenta imprimir por la app. `true` si la app se hace cargo (aunque termine mandándolo al
 * navegador porque el aparato no imprime ese documento); `false` si no hay app o el documento no
 * es térmico: quien llama sigue con el navegador.
 */
export function imprimirDirecto(documento: DocumentoEnPantalla): boolean {
  const app = puenteDeLaApp(window);
  if (app === null) return false;
  const lienzo = documento.objetivo.querySelector(LIENZO_TERMICO);
  if (!(lienzo instanceof HTMLElement)) return false;
  const { tipo, ordenId } = datosDelDocumento(documento.objetivo);
  const clave = `${tipo}:${ordenId ?? documento.titulo}`;

  void (async () => {
    const perfil = await perfilDelAparato(app);
    if (perfil?.imprime[tipo] !== true) {
      documento.alNavegador();
      return;
    }
    await MESA_DE_TRABAJOS.lanzar(
      clave,
      () => nuevoIdDeTrabajo(tipo),
      (controles) => tarea(app, perfil, documento, lienzo, controles),
      { titulo: documento.titulo, alNavegador: documento.alNavegador, yaQuedo: YA_QUEDO[tipo] },
    );
  })();
  return true;
}
