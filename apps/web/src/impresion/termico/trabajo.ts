/**
 * EL TRABAJO QUE VIAJA A LA IMPRESORA (DP-20). Puro.
 *
 * Un trabajo es UN solo documento de bytes: empieza limpio (`ESC @`), abre el cajón UNA vez si
 * toca (no una por copia), y por cada copia manda su imagen, avanza y corta. Así la cola de la
 * app lo trata como una sola cosa: o sale todo, o se reintenta todo con el mismo id.
 */
import {
  avanzar,
  cortar,
  imagenEnFranjas,
  imagenPorColumnas,
  iniciar,
  pulsoDelCajon,
  pulsoEnTiempoReal,
  unir,
} from './escpos.ts';
import type { MapaDeBits } from './mapa.ts';
import type { CajonDelPerfil, PerfilDeImpresion } from './perfil.ts';

/** Los bytes que abren el cajón de este perfil. */
export function bytesDelCajon(cajon: CajonDelPerfil): Uint8Array {
  return cajon.modo === 'tiempo-real'
    ? pulsoEnTiempoReal(cajon.pin)
    : pulsoDelCajon(cajon.pin, cajon.encendidoMs, cajon.apagadoMs);
}

/** La imagen como la pide el lenguaje del perfil. */
export function bytesDeLaImagen(perfil: PerfilDeImpresion, mapa: MapaDeBits): Uint8Array {
  if (mapa.ancho > perfil.puntos) {
    throw new RangeError(
      `La imagen mide ${String(mapa.ancho)} puntos y la impresora imprime ${String(perfil.puntos)}.`,
    );
  }
  const partes =
    perfil.lenguaje === 'escpos-columnas'
      ? imagenPorColumnas(mapa)
      : imagenEnFranjas(mapa, perfil.franjaFilas);
  return unir(...partes);
}

export interface OpcionesDelTrabajo {
  /** Abrir el cajón con este trabajo (una sola vez, antes de imprimir). */
  readonly abrirCajon?: boolean;
}

/** Una imagen por copia (cada copia trae su propio pie: «ORIGINAL — CLIENTE», «COPIA — NEGOCIO»). */
export function armarTrabajo(
  perfil: PerfilDeImpresion,
  copias: readonly MapaDeBits[],
  opciones: OpcionesDelTrabajo = {},
): Uint8Array {
  if (copias.length === 0) throw new RangeError('Un trabajo lleva al menos una copia.');
  const partes: Uint8Array[] = [iniciar()];
  if (opciones.abrirCajon === true && perfil.cajon !== null)
    partes.push(bytesDelCajon(perfil.cajon));
  for (const mapa of copias) {
    partes.push(
      bytesDeLaImagen(perfil, mapa),
      avanzar(perfil.lineasAntesDelCorte),
      cortar(perfil.corte),
    );
  }
  return unir(...partes);
}

/** Sólo el cajón (el botón «Abrir cajón»). */
export function armarAperturaDelCajon(cajon: CajonDelPerfil): Uint8Array {
  return unir(iniciar(), bytesDelCajon(cajon));
}

const TROZO = 0x8000;

/** Bytes → base64, que es como cruzan el puente. */
export function aBase64(datos: Uint8Array): string {
  let binario = '';
  for (let i = 0; i < datos.length; i += TROZO) {
    binario += String.fromCharCode(...datos.subarray(i, i + TROZO));
  }
  return btoa(binario);
}

export function deBase64(texto: string): Uint8Array {
  const binario = atob(texto);
  const datos = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) datos[i] = binario.charCodeAt(i);
  return datos;
}

/** Los bytes en hexadecimal, 16 por renglón, para el laboratorio («los bytes del último trabajo»). */
export function aHexadecimal(datos: Uint8Array, maximo = 4096): string {
  const renglones: string[] = [];
  const hasta = Math.min(datos.length, maximo);
  for (let i = 0; i < hasta; i += 16) {
    const trozo = Array.from(datos.subarray(i, Math.min(i + 16, hasta)), (b) =>
      b.toString(16).padStart(2, '0'),
    );
    renglones.push(`${i.toString(16).padStart(6, '0')}  ${trozo.join(' ')}`);
  }
  if (datos.length > hasta) renglones.push(`… ${String(datos.length - hasta)} bytes más`);
  return renglones.join('\n');
}

/** Un id por trabajo: un reintento lleva el MISMO id y la app no imprime dos veces lo entregado. */
export function nuevoIdDeTrabajo(prefijo: string): string {
  return `${prefijo}-${crypto.randomUUID()}`;
}
