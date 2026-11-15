/**
 * LOS CAMBIOS DEL FORMULARIO QUE ARRASTRAN OTROS CAMPOS (DP-20 · laboratorio). Puro.
 *
 * Cambiar el rollo, la conexión o la impresora elegida acomoda los puntos, el lenguaje y el
 * nombre; cada uno devuelve un formulario nuevo y no toca el anterior.
 */
import { PUNTOS_POR_PAPEL, type Conexion, type Destino, type Lenguaje } from '../termico/perfil.ts';
import { LARGO_MAXIMO_DEL_NOMBRE } from './rangos.ts';
import type { FormularioDelPerfil } from './formulario.ts';

/** Cambiar el rollo cambia los puntos al ancho de siempre de ese rollo. */
export function conPapel(formulario: FormularioDelPerfil, papelMm: 58 | 80): FormularioDelPerfil {
  const puntos = PUNTOS_POR_PAPEL[papelMm][0] ?? 576;
  return { ...formulario, papelMm, puntos: String(puntos) };
}

/** Cambiar la conexión suelta la impresora de otra conexión y acomoda el lenguaje. */
export function conConexion(
  formulario: FormularioDelPerfil,
  conexion: Conexion,
): FormularioDelPerfil {
  const lenguaje: Lenguaje =
    conexion === 'driver'
      ? 'driver'
      : formulario.lenguaje === 'driver'
        ? 'escpos-imagen'
        : formulario.lenguaje;
  const elegida = formulario.elegida?.conexion === conexion ? formulario.elegida : null;
  return { ...formulario, conexion, elegida, lenguaje };
}

const NOMBRE_DE_OMISION = /^Impresora de \d+ mm$/;

/** Elegir una impresora de la lista: fija la conexión y, si el nombre era el de fábrica, lo toma de ella. */
export function conImpresoraElegida(
  formulario: FormularioDelPerfil,
  destino: Destino,
  nombreDeLaLista: string,
): FormularioDelPerfil {
  const cambiaElNombre =
    formulario.nombre.trim() === '' || NOMBRE_DE_OMISION.test(formulario.nombre.trim());
  return {
    ...conConexion(formulario, destino.conexion),
    elegida: destino,
    nombre: cambiaElNombre ? nombreDeLaLista.slice(0, LARGO_MAXIMO_DEL_NOMBRE) : formulario.nombre,
  };
}
