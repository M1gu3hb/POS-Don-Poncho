import type { ArchivosDeCortes } from '../../impresion/puente/contrato.ts';

import { mensajeDeUnRechazo } from './archivos-de-la-app.ts';
import { guardarCorteEnLaCarpeta, type SalidaDelGuardado } from './guardar-en-la-carpeta.ts';

/**
 * ¿DESCARGA O CARPETA? (DP-D153)
 *
 * Con la app 1.0.2 (`archivos` ≠ null) el PDF va a la carpeta. Sin ella —navegador, app 1.0.1,
 * Android— va EXACTAMENTE por donde iba: `descargar` es la misma función de siempre. Un guardado que
 * falla NO cae a una descarga a escondidas: se avisa, y la persona reintenta.
 */
export type Entrega =
  | { readonly via: 'descarga'; readonly ok?: true }
  | { readonly via: 'descarga'; readonly ok: false; readonly mensaje: string }
  | ({ readonly via: 'carpeta' } & SalidaDelGuardado);

export interface PedidoDeEntrega {
  /** `null` = no se puede guardar en carpeta → descarga de siempre. */
  readonly archivos: ArchivosDeCortes | null;
  readonly datos: { readonly folio: string; readonly fecha: string };
  /** Arma el PDF sin descargarlo (sólo se llama si hay carpeta). */
  readonly generar: () => Promise<Blob>;
  /** La descarga de siempre. */
  readonly descargar: () => Promise<unknown>;
}

export async function entregarElPdfDelCorte(pedido: PedidoDeEntrega): Promise<Entrega> {
  if (pedido.archivos === null) {
    await pedido.descargar();
    return { via: 'descarga' };
  }
  let pdf: Blob;
  try {
    pdf = await pedido.generar();
  } catch (fallo) {
    return {
      via: 'carpeta',
      ok: false,
      mensaje: mensajeDeUnRechazo(fallo, 'No se pudo armar el PDF del corte.'),
    };
  }
  const salida = await guardarCorteEnLaCarpeta(pedido.archivos, { ...pedido.datos, pdf });
  return { via: 'carpeta', ...salida };
}

/**
 * Lo mismo, pero SIN esperar: vuelve al instante y el resultado llega a `alTerminar`. Es lo que usa el
 * cierre de caja: el corte ya está sellado y un guardado lento o roto no lo retrasa ni lo bloquea.
 */
export function entregarSinEsperar(
  pedido: PedidoDeEntrega,
  alTerminar: (entrega: Entrega) => void,
): void {
  void entregarElPdfDelCorte(pedido)
    .catch((fallo: unknown): Entrega => ({
      via: 'descarga',
      ok: false,
      mensaje: mensajeDeUnRechazo(fallo, 'No se pudo descargar el PDF del corte.'),
    }))
    .then(alTerminar);
}
