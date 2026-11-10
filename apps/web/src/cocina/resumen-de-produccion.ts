import { etiquetaDePeso } from '../restaurante/peso.ts';
import { sePrepara } from '../restaurante/platillos-de-cocina.ts';

import type { ComandaDeCocina, ItemDeCocina } from './tipos';

/**
 * DP-16 · 2.2 · EL RESUMEN DE PRODUCCIÓN.
 *
 * La tira de arriba del tablero: cuánto hay que sacar de cada platillo, sumando todas las mesas
 * («Barbacoa de horno ½ kg ×6 · Consomé ×9»). Sólo cuenta lo PENDIENTE de la estación: lo nuevo y
 * lo que está en preparación. Lo listo ya salió; el platillo quitado por el mesero no se prepara.
 * Lo que se vende por peso se suma por presentación (¼, ½, 1 kg…) y trae además sus kilos.
 */

export interface RenglonDelResumen {
  readonly clave: string;
  readonly nombre: string;
  /** «½ kg» en lo que va por peso; null en lo demás. */
  readonly presentacion: string | null;
  /** Piezas (o líneas, en lo que va por peso). */
  readonly cantidad: number;
  /** Kilos en total de esta presentación; null si no va por peso. */
  readonly kilos: number | null;
}

const PENDIENTES: ReadonlySet<string> = new Set(['nuevo', 'en_preparacion']);
const NOMBRE_SIN_DATO = 'Platillo';

function aNumero(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function pesoDe(item: ItemDeCocina): { presentacion: string; kilos: number } | null {
  if (item.tipo_venta !== 'variable_medida') return null;
  const kilos = aNumero(item.cantidad_variable ?? item.cantidad);
  const unidad = item.unidad_variable ?? 'kg';
  const presentacion = etiquetaDePeso(kilos, unidad === '' ? 'kg' : unidad);
  return presentacion === '' ? null : { presentacion, kilos };
}

export function resumenDeProduccion(
  comandas: readonly ComandaDeCocina[],
): readonly RenglonDelResumen[] {
  const acumulado = new Map<string, RenglonDelResumen>();
  for (const comanda of comandas) {
    if (!PENDIENTES.has(comanda.estado)) continue;
    for (const item of comanda.items ?? []) {
      if (!sePrepara(item)) continue;
      const nombre = (item.producto_nombre ?? '').trim() || NOMBRE_SIN_DATO;
      const peso = pesoDe(item);
      const clave = `${item.producto_id ?? nombre}|${peso?.presentacion ?? ''}`;
      const previo = acumulado.get(clave);
      const cantidad = peso === null ? aNumero(item.cantidad) : 1;
      acumulado.set(clave, {
        clave,
        nombre,
        presentacion: peso?.presentacion ?? null,
        cantidad: (previo?.cantidad ?? 0) + cantidad,
        kilos: peso === null ? null : (previo?.kilos ?? 0) + peso.kilos,
      });
    }
  }
  return [...acumulado.values()]
    .filter((r) => r.cantidad > 0)
    .sort(
      (a, b) =>
        b.cantidad - a.cantidad ||
        a.nombre.localeCompare(b.nombre, 'es') ||
        (b.kilos ?? 0) - (a.kilos ?? 0),
    );
}

/** «Consomé ×9» o «Barbacoa de horno ½ kg ×6». */
export function textoDelResumen(renglon: RenglonDelResumen): string {
  const cantidad = String(Math.round(renglon.cantidad * 100) / 100);
  const presentacion = renglon.presentacion === null ? '' : ` ${renglon.presentacion}`;
  return `${renglon.nombre}${presentacion} ×${cantidad}`;
}
