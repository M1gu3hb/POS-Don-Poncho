import 'server-only';

import { ErrorDominio } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';

import { elegirLasOpciones, gruposDeLosPlatillos } from '../restaurante/opciones-de-la-linea.ts';
import { sumaDeLasOpciones } from '../restaurante/precio-de-las-opciones.ts';

/**
 * DP-16 · EL PRECIO APROXIMADO DE UNA LÍNEA DEL CARRITO COMPARTIDO, con sus opciones.
 *
 * El comensal elige las opciones en su teléfono y viajan plegadas en la nota («Salsa: Roja»), como
 * las lee el servidor al enviar. Aquí se leen igual para que el subtotal que ve no se quede corto.
 * Una nota que todavía no completa un grupo obligatorio no rompe el carrito: suma lo que sí eligió.
 */

interface LineaConNota {
  readonly productoId: string;
  readonly nombre: string;
  readonly notas: string | null;
}

export async function deltasDeLasNotas(
  tx: Transaccion,
  organizacionId: string,
  lineas: readonly LineaConNota[],
): Promise<(linea: { readonly producto_id: string; readonly notas: string | null }) => bigint> {
  const grupos = await gruposDeLosPlatillos(
    tx,
    organizacionId,
    lineas.map((l) => l.productoId),
  );
  return (linea) => {
    const suyos = grupos.get(linea.producto_id) ?? [];
    if (suyos.length === 0 || linea.notas === null || linea.notas === '') return 0n;
    const sinObligatorios = suyos.map((g) => ({ ...g, obligatorio: false, minimo: null }));
    try {
      return sumaDeLasOpciones(elegirLasOpciones('', sinObligatorios, undefined, linea.notas));
    } catch (error) {
      // Una nota que no se lee como opciones válidas no suma nada; cualquier otro fallo, sí sube.
      if (error instanceof ErrorDominio) return 0n;
      throw error;
    }
  };
}

/**
 * El precio por unidad que el carrito multiplica por la cantidad. En una pieza, la opción por
 * unidad; en lo que va por peso, la opción por renglón repartida entre la cantidad (aproximado).
 */
export function precioConLaNota(
  precioCentavos: bigint,
  tipoVenta: string,
  cantidad: string,
  delta: bigint,
): bigint {
  if (delta === 0n) return precioCentavos;
  if (tipoVenta === 'variable_medida' || tipoVenta === 'porcion_contenedor') {
    const n = Number(cantidad);
    if (!Number.isFinite(n) || n <= 0) return precioCentavos;
    return precioCentavos + BigInt(Math.round(Number(delta) / n));
  }
  const conOpcion = precioCentavos + delta;
  return conOpcion < 0n ? 0n : conOpcion;
}
