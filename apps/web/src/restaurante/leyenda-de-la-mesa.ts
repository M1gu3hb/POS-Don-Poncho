/**
 * DP-25 · Parte 3 · 3.3 · LO QUE LA PANTALLA DE LA MESA SE EXPLICA SOLA.
 *
 * Qué significa cada color de la mesa del mapa y las instrucciones del «?»: cuándo marcar
 * entregado y qué hacer si quedan pendientes al pedir la cuenta. Los textos de los botones son los
 * que el mesero ve en pantalla («Marcar entregado», «Pedir la cuenta de todos modos», «Regresar»).
 */

const SIGNIFICADO_DEL_COLOR: Readonly<Record<string, string>> = {
  libre: 'Nadie la ocupa.',
  esperando_orden: 'Ya se abrió; falta mandar el pedido a cocina.',
  pedido_enviado: 'El pedido ya fue a cocina y nadie lo ha empezado.',
  en_preparacion: 'La cocina está preparando algo de esta mesa.',
  en_espera_entrega: 'Hay platillos listos: recógelos en la ventana.',
  ocupada: 'Tiene una cuenta abierta.',
  cuenta_solicitada: 'Ya pidieron la cuenta; la Caja la cobra.',
  limpieza: 'Ya se cobró; falta limpiarla.',
};

export function significadoDelColorDeLaMesa(estado: string): string {
  return SIGNIFICADO_DEL_COLOR[estado] ?? '';
}

export interface InstruccionDeLaMesa {
  readonly titulo: string;
  readonly texto: string;
}

export const INSTRUCCIONES_DE_LA_MESA: readonly InstruccionDeLaMesa[] = [
  {
    titulo: 'Cuándo marcar entregado',
    texto:
      'Cuando ya recogiste lo que salió de una estación y lo pusiste en la mesa, toca «Marcar entregado» de esa estación. Sólo entrega lo que ya está listo: lo que sigue en preparación no se toca.',
  },
  {
    titulo: 'Si hay pendientes al pedir la cuenta',
    texto:
      'Si pides la cuenta y todavía hay platillos sin preparar o sin entregar, el sistema te lo dice antes de pedirla. Toca «Regresar» para revisarlos, o «Pedir la cuenta de todos modos» si el cliente ya no los quiere esperar.',
  },
  {
    titulo: 'El avance de cada estación',
    texto:
      'Cada estación dice cuántos platillos han salido («Bebidas 2 de 3»). Cuando terminó, se pone verde y dice «Cocina ✓»: ya puedes recogerlo todo de esa estación.',
  },
];
