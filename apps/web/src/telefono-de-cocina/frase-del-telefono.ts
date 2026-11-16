import { rotuloHablado } from '~/restaurante/rotulo-de-la-comanda';
import { fraseNuevoPedidoCocina } from '~/voz/frase-de-la-comanda';

import { datosDelRotulo, type ComandaDelTelefono } from './pantalla-del-telefono';

/**
 * DP-21 · Bloque 8 · «REPETIR VOZ» DEL TELÉFONO DE COCINA.
 *
 * La misma frase que dice la pantalla grande: renglones iguales juntos, cantidad en palabras,
 * opciones y peso («medio kilo de Barbacoa de horno»). El teléfono guarda las opciones como
 * `nombres`; la frase las lee como `opciones`.
 */
export function fraseDeLaComandaDelTelefono(comanda: ComandaDelTelefono): string {
  return fraseNuevoPedidoCocina(
    // Sin mesa la voz dice «mostrador», como en la pantalla grande.
    comanda.mesaNumero ?? '',
    comanda.platillos.map((p) => ({
      producto_nombre: p.nombre,
      cantidad: p.cantidad,
      notas: p.notas,
      opciones: (p.opciones ?? []).map((o) => ({ grupo: o.grupo, opciones: o.nombres })),
      tipo_venta: p.porPeso ? 'variable_medida' : null,
      unidad_variable: p.unidadVariable,
      cantidad_variable: p.cantidadVariable,
    })),
    comanda.notas ?? '',
    {
      // DP-16 · «para llevar 3» o «mesa 4», del mismo rótulo que la pantalla.
      rotulo: rotuloHablado(datosDelRotulo(comanda)),
      notas_alergias: comanda.alergias,
      celebracion: comanda.celebracion,
      tipo_celebracion: comanda.tipoCelebracion,
    },
  );
}
