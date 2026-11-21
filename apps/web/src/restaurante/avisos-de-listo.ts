import { cantidadParaMostrar } from './peso.ts';

/**
 * DP-24 · 4.3 · EL AVISO DE «LISTO»: qué dice, cuáles se ven y cuáles suenan. Puro.
 *
 * El servidor (`restaurante.avisos_de_listo`) ya decidió que son de ESTE mesero; aquí sólo se
 * arma el texto grande, se separan los que el mesero ya quitó y se detecta lo nuevo para sonar.
 *
 * Un aviso es una estación de una mesa (la comanda). Si sale otro platillo de esa comanda
 * mientras el aviso sigue en pantalla, el aviso crece; si el mesero ya lo había quitado, vuelve
 * con SOLO lo nuevo. Un platillo se quita por su id: lo que se atendió no regresa, lo que sale
 * después sí.
 */

export interface PlatilloDelAviso {
  readonly id: string;
  readonly nombre: string;
  readonly cantidad: string;
  readonly tipoVenta: string | null;
  readonly unidadVariable: string | null;
}

export interface AvisoDeListo {
  readonly comandaId: string;
  readonly ordenId: string;
  readonly mesaId: string;
  readonly mesaNumero: number;
  readonly estacionNombre: string | null;
  readonly estacionColor: string | null;
  readonly listoEn: string | null;
  readonly platillos: readonly PlatilloDelAviso[];
}

const ESTACION_SIN_NOMBRE = 'Cocina';

export function nombreDeLaEstacion(aviso: Pick<AvisoDeListo, 'estacionNombre'>): string {
  const nombre = (aviso.estacionNombre ?? '').trim();
  return nombre === '' ? ESTACION_SIN_NOMBRE : nombre;
}

/** «2 Coca cola, 1 Jugo»: lo que salió junto, sumado por nombre y en el orden en que salió. */
export function platillosEnPalabras(platillos: readonly PlatilloDelAviso[]): string {
  const porNombre = new Map<string, { cantidad: number; peso: string | null }>();
  for (const p of platillos) {
    const previo = porNombre.get(p.nombre);
    const porPeso = p.tipoVenta === 'variable_medida';
    const cantidad = Number(p.cantidad);
    const etiqueta = porPeso
      ? cantidadParaMostrar({
          cantidad,
          tipo_venta: p.tipoVenta,
          unidad_variable: p.unidadVariable,
        })
      : null;
    porNombre.set(p.nombre, {
      cantidad: (previo?.cantidad ?? 0) + (Number.isFinite(cantidad) ? cantidad : 0),
      peso: etiqueta ?? previo?.peso ?? null,
    });
  }
  return [...porNombre.entries()]
    .map(([nombre, { cantidad, peso }]) => {
      const cuantos = peso ?? (Number.isInteger(cantidad) ? String(cantidad) : cantidad.toFixed(2));
      return `${cuantos} ${nombre}`;
    })
    .join(', ');
}

/** El texto grande: «Mesa 5 · Listo en Cantina: 2 Coca cola, 1 Jugo · Recoger en Cantina». */
export function fraseDelAviso(aviso: AvisoDeListo): string {
  const estacion = nombreDeLaEstacion(aviso);
  return `Mesa ${String(aviso.mesaNumero)} · Listo en ${estacion}: ${platillosEnPalabras(aviso.platillos)} · Recoger en ${estacion}`;
}

/** Lo que dice la voz: sin símbolos, con pausas. */
export function fraseHablada(aviso: AvisoDeListo, nombreMesero = ''): string {
  const estacion = nombreDeLaEstacion(aviso);
  const cuerpo = `Mesa ${String(aviso.mesaNumero)}, listo en ${estacion}: ${platillosEnPalabras(aviso.platillos)}. Recoger en ${estacion}.`;
  return nombreMesero === '' ? cuerpo : `${nombreMesero}, ${cuerpo}`;
}

/** Los avisos con SOLO los platillos que el mesero todavía no quitó; los que se quedan sin nada se van. */
export function avisosPendientes(
  avisos: readonly AvisoDeListo[],
  quitados: ReadonlySet<string>,
): readonly AvisoDeListo[] {
  return avisos
    .map((aviso) => ({ ...aviso, platillos: aviso.platillos.filter((p) => !quitados.has(p.id)) }))
    .filter((aviso) => aviso.platillos.length > 0);
}

/** Los ids de platillo de todos los avisos. */
export function idsDePlatillos(avisos: readonly AvisoDeListo[]): readonly string[] {
  return avisos.flatMap((a) => a.platillos.map((p) => p.id));
}

/**
 * Qué platillos de los avisos pendientes son NUEVOS para este aparato. `conocidos === null` es la
 * primera lectura: todo lo pendiente cuenta (es comida que espera) pero se avisa UNA vez.
 */
export function platillosNuevos(
  pendientes: readonly AvisoDeListo[],
  conocidos: ReadonlySet<string> | null,
): readonly string[] {
  const ids = idsDePlatillos(pendientes);
  return conocidos === null ? ids : ids.filter((id) => !conocidos.has(id));
}

/**
 * Los platillos quitados que todavía importan: los que siguen en los avisos del servidor. Lo
 * entregado o cancelado ya no está allí y se olvida, así la memoria del aparato no crece sin fin.
 */
export function quitadosVigentes(
  quitados: ReadonlySet<string>,
  avisos: readonly AvisoDeListo[],
): ReadonlySet<string> {
  const vivos = new Set(idsDePlatillos(avisos));
  return new Set([...quitados].filter((id) => vivos.has(id)));
}

/** Cuántos avisos se muestran apilados completos; el resto se cuenta, no se pierde. */
export const AVISOS_A_LA_VISTA = 3;

export function repartirAvisos(avisos: readonly AvisoDeListo[]): {
  readonly visibles: readonly AvisoDeListo[];
  readonly ocultos: readonly AvisoDeListo[];
} {
  return { visibles: avisos.slice(0, AVISOS_A_LA_VISTA), ocultos: avisos.slice(AVISOS_A_LA_VISTA) };
}
