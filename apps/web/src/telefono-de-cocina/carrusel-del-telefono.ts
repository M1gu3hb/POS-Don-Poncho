/**
 * EL CARRUSEL DEL TELÉFONO DE COCINA (DP-16 · 2.3): la lógica sin pantalla.
 *
 * Las comandas activas van de la más vieja a la más nueva en un carrusel horizontal. Aquí viven
 * las reglas que no deben depender de cómo se pinte: el orden, qué comanda está a la vista según
 * el desplazamiento, qué hay que anunciar por voz y la frase corta de cada llegada.
 */

import { separarOpcionesYNota } from '~/cocina/opciones-y-nota';
import { cantidadParaMostrar } from '~/restaurante/peso';
import { rotuloDeLaComanda, rotuloHablado } from '~/restaurante/rotulo-de-la-comanda';

import {
  datosDelRotulo,
  type ComandaDelTelefono,
  type MesaDelTelefono,
  type OpcionDelPlatillo,
  type PantallaDelTelefono,
} from './pantalla-del-telefono';

/** Las comandas a mostrar: `comandas` del servidor nuevo; con uno viejo, la única `comanda`. */
export function comandasDeLaPantalla(
  pantalla: Pick<PantallaDelTelefono, 'comanda' | 'comandas'>,
): readonly ComandaDelTelefono[] {
  const lista = pantalla.comandas ?? (pantalla.comanda === null ? [] : [pantalla.comanda]);
  return ordenarComandas(lista);
}

/** De la más vieja a la más nueva; a igual hora, por id, para que el orden no baile entre lecturas. */
export function ordenarComandas(
  comandas: readonly ComandaDelTelefono[],
): readonly ComandaDelTelefono[] {
  return [...comandas].sort((a, b) => {
    const dif = Date.parse(a.creadaEn) - Date.parse(b.creadaEn);
    if (dif !== 0 && !Number.isNaN(dif)) return dif;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * El índice de la tarjeta que está a la vista: la más cercana al borde izquierdo del carrusel.
 * `paso` es lo que mide una tarjeta más su separación.
 */
export function indiceALaVista(desplazamiento: number, paso: number, total: number): number {
  if (total <= 0 || paso <= 0 || !Number.isFinite(desplazamiento)) return 0;
  return Math.min(total - 1, Math.max(0, Math.round(desplazamiento / paso)));
}

/**
 * La comanda que cuenta como «a la vista» tras una lectura nueva. Si la que se miraba sigue,
 * sigue; si se fue (la dejaron lista), la que ocupa su lugar —o la última si era la última—.
 */
export function comandaALaVista(
  comandas: readonly ComandaDelTelefono[],
  vistaId: string | null,
  indiceAnterior: number,
): ComandaDelTelefono | null {
  if (comandas.length === 0) return null;
  const mirada = comandas.find((c) => c.id === vistaId);
  if (mirada !== undefined) return mirada;
  return comandas[Math.min(Math.max(indiceAnterior, 0), comandas.length - 1)] ?? null;
}

/**
 * Qué comandas anunciar: las que este teléfono no ha anunciado, en su orden. La primera lectura
 * (`anunciadas === null`) no anuncia nada: al entrar no se suelta lo que ya estaba.
 */
export function porAnunciarLasNuevas(
  comandas: readonly ComandaDelTelefono[],
  anunciadas: ReadonlySet<string> | null,
): readonly ComandaDelTelefono[] {
  if (anunciadas === null) return [];
  return comandas.filter((c) => !anunciadas.has(c.id));
}

function unaOVarias(n: number, uno: string, varios: string): string {
  return `${String(n)} ${n === 1 ? uno : varios}`;
}

function conTexto(texto: string | null): boolean {
  return texto !== null && texto.trim() !== '';
}

/** Cuántos platillos lleva: las piezas suman; lo que va por peso cuenta como uno. */
export function platillosDeLaComanda(comanda: ComandaDelTelefono): number {
  return comanda.platillos.reduce((total, p) => {
    if (p.porPeso) return total + 1;
    const piezas = Math.round(Number(p.cantidad));
    return total + (Number.isFinite(piezas) && piezas > 0 ? piezas : 1);
  }, 0);
}

/**
 * La frase corta de una llegada: «Mesa 4: 7 platillos, 2 con nota» o «Para llevar 3: 4 platillos».
 * Una alergia nunca se calla, aunque la frase sea corta.
 */
export function fraseDeLaLlegada(comanda: ComandaDelTelefono): string {
  const rotulo = rotuloHablado(datosDelRotulo(comanda));
  const partes = [unaOVarias(platillosDeLaComanda(comanda), 'platillo', 'platillos')];
  const conNota = comanda.platillos.filter((p) => conTexto(notaDelPlatillo(p))).length;
  if (conNota > 0) partes.push(`${String(conNota)} con nota`);
  if (conTexto(comanda.alergias)) partes.push('con alergia');
  return `${rotulo.charAt(0).toUpperCase()}${rotulo.slice(1)}: ${partes.join(', ')}`;
}

/**
 * La nota del platillo sin el pliegue de sus opciones: el mesero y el portal escriben «Relleno:
 * Queso · bien dorada»; las opciones ya salen aparte, así que queda «bien dorada». Sin opciones
 * estructuradas (una comanda de antes), la nota sale entera. La misma regla que la pantalla grande.
 */
export function notaDelPlatillo(p: ComandaDelTelefono['platillos'][number]): string {
  const opciones = (p.opciones ?? []).map((o) => ({ grupo: o.grupo, opciones: o.nombres }));
  return separarOpcionesYNota(p.notas, opciones).nota;
}

/** «½ kg» para lo que va por peso; «2» para piezas. */
export function cantidadDelPlatillo(p: ComandaDelTelefono['platillos'][number]): string {
  return cantidadParaMostrar({
    cantidad: p.cantidad,
    tipo_venta: p.porPeso ? 'variable_medida' : null,
    unidad_variable: p.unidadVariable,
    cantidad_variable: p.cantidadVariable,
  });
}

/** Una opción para la tarjeta: «Salsa: verde, roja». */
export function textoDeLaOpcion(opcion: OpcionDelPlatillo): string {
  return `${opcion.grupo}: ${opcion.nombres.join(', ')}`;
}

export interface ChipDeLaTira {
  readonly comandaId: string;
  readonly rotulo: string;
  readonly estado: MesaDelTelefono['estado'];
  readonly estadoDicho: string;
  /** Su lugar en el carrusel; `null` si ya no tiene tarjeta (lista, esperando entrega). */
  readonly indice: number | null;
}

const ESTADO_DICHO: Readonly<Record<MesaDelTelefono['estado'], string>> = {
  nuevo: 'Nueva',
  en_preparacion: 'Preparando',
  listo: 'Lista',
};

/** La tira de arriba: un chip por mesa o pedido, con el estado en texto además de color. */
export function chipsDeLaTira(
  mesas: readonly MesaDelTelefono[],
  comandas: readonly ComandaDelTelefono[],
): readonly ChipDeLaTira[] {
  return mesas.map((m) => {
    const lugar = comandas.findIndex((c) => c.id === m.comandaId);
    return {
      comandaId: m.comandaId,
      rotulo: rotuloDeLaComanda({
        mesa_numero: m.mesaNumero,
        canal: m.canal,
        numero_pedido: m.numeroPedido,
        nombre_pedido: m.nombrePedido,
      }),
      estado: m.estado,
      estadoDicho: ESTADO_DICHO[m.estado],
      indice: lugar === -1 ? null : lugar,
    };
  });
}
