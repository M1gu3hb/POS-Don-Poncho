import { cantidadParaMostrar, esPorPeso, type LineaConPeso } from '~/restaurante/peso';

/**
 * UNA LÍNEA DE VENTA EN EL DETALLE DEL CORTE, UN SOLO FORMATO (DP-15 · F2, auditoría 1 M5).
 *
 * El visor decía «Barbacoa de horno — ½ kg» y el documento del cierre «1 kg × Barbacoa de horno»
 * para la misma venta de medio kilo: el servidor armaba el texto con la cantidad de la línea y su
 * unidad, no con el peso vendido. Aquí está el único texto, con el formateador único del peso
 * (`cantidadParaMostrar`, DP-D73): «Barbacoa de horno — ½ kg» o «Arrachera ×2».
 */
export interface LineaDelDetalle extends LineaConPeso {
  readonly nombre: string;
  readonly unidad?: string | null | undefined;
}

export function textoDeLaLinea(linea: LineaDelDetalle): string {
  if (esPorPeso(linea)) {
    const peso = cantidadParaMostrar(linea);
    return `${linea.nombre} — ${peso}`;
  }
  const n = Number(linea.cantidad);
  return `${linea.nombre} ×${Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000)}`;
}
