/**
 * LAS COPIAS SE LEEN EN EL MOMENTO DE IMPRIMIR (DP-24 · Parte 6.1). Una sola función para todos los caminos.
 *
 * Antes las copias vivían en una variable del módulo que llenaba una consulta de la barra de
 * impresión (con un minuto de caducidad y sin releer al enfocar): un aparato que no recargaba
 * imprimía con lo que había leído al abrir. Ahora cada impresión pregunta al servidor.
 *
 *   · Si el servidor no contesta (sin red, plazo vencido), se usa la ÚLTIMA lectura buena de este
 *     aparato —en memoria y en `localStorage`, para sobrevivir a una recarga sin red— y se avisa.
 *   · Si nunca hubo una lectura buena, sale 1 copia y se avisa: el ticket ya cobrado debe poder salir.
 */
import { consultarPuente } from '~/cliente/api';

import { COPIAS_POR_OMISION, copiasLeidas, type CopiasDeImpresion } from './copias.ts';

export const ESPERA_DE_LA_LECTURA_MS = 4_000;
const CLAVE_DE_LA_ULTIMA = 'dp.copias-de-impresion.ultima';

export type LectorDeCopias = (senal: AbortSignal) => Promise<CopiasDeImpresion>;

export interface MemoriaDeCopias {
  ultima(): CopiasDeImpresion | null;
  guardar(copias: CopiasDeImpresion): void;
}

export interface CopiasParaImprimir {
  readonly copias: CopiasDeImpresion;
  /** Lo que se le dice a la persona cuando no se pudieron leer; `null` si se leyeron bien. */
  readonly aviso: string | null;
}

/** Una memoria sólo en variables (para las pruebas y para quien no tiene `localStorage`). */
export function crearMemoriaDeCopias(): MemoriaDeCopias {
  let ultima: CopiasDeImpresion | null = null;
  return {
    ultima: () => ultima,
    guardar(copias) {
      ultima = copias;
    },
  };
}

function almacen(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Con los datos del sitio bloqueados, `localStorage` lanza al tocarlo: se queda sólo en memoria.
    return null;
  }
}

/** La memoria de ESTE aparato: variable del módulo + `localStorage`. */
function crearMemoriaDelAparato(): MemoriaDeCopias {
  const enMemoria = crearMemoriaDeCopias();
  return {
    ultima() {
      const recordada = enMemoria.ultima();
      if (recordada !== null) return recordada;
      try {
        const texto = almacen()?.getItem(CLAVE_DE_LA_ULTIMA) ?? null;
        if (texto === null) return null;
        return copiasLeidas({ copias_de_impresion: JSON.parse(texto) as unknown });
      } catch {
        return null;
      }
    },
    guardar(copias) {
      enMemoria.guardar(copias);
      try {
        almacen()?.setItem(CLAVE_DE_LA_ULTIMA, JSON.stringify(copias));
      } catch {
        // Sin dónde guardar: sirve la memoria de esta sesión.
      }
    },
  };
}

const memoriaDelAparato = crearMemoriaDelAparato();

const leerDelServidor: LectorDeCopias = async (senal) => {
  const [configuracion] = await consultarPuente<{ copias_de_impresion?: unknown }>(
    'ConfiguracionNegocio',
    { limite: 1, signal: senal },
  );
  return copiasLeidas(configuracion);
};

function conPlazo(lector: LectorDeCopias, plazoMs: number): Promise<CopiasDeImpresion> {
  const control = new AbortController();
  return new Promise<CopiasDeImpresion>((resolver, rechazar) => {
    const reloj = setTimeout(() => {
      control.abort();
      rechazar(new Error('El servidor no contestó a tiempo.'));
    }, plazoMs);
    lector(control.signal).then(
      (copias) => {
        clearTimeout(reloj);
        resolver(copias);
      },
      (error: unknown) => {
        clearTimeout(reloj);
        rechazar(error instanceof Error ? error : new Error('No se pudo leer.'));
      },
    );
  });
}

export async function copiasAlImprimir(
  lector: LectorDeCopias = leerDelServidor,
  memoria: MemoriaDeCopias = memoriaDelAparato,
  plazoMs: number = ESPERA_DE_LA_LECTURA_MS,
): Promise<CopiasParaImprimir> {
  try {
    const copias = await conPlazo(lector, plazoMs);
    memoria.guardar(copias);
    return { copias, aviso: null };
  } catch (error: unknown) {
    console.error('[impresion] no se pudieron leer las copias del negocio:', error);
    const ultima = memoria.ultima();
    return ultima === null
      ? {
          copias: COPIAS_POR_OMISION,
          aviso: 'No se pudieron leer las copias del negocio: salió 1 copia.',
        }
      : {
          copias: ultima,
          aviso:
            'No se pudieron leer las copias del negocio: salió con las últimas que este aparato conocía.',
        };
  }
}
