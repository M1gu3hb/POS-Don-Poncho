import { frasePlatillos, type PlatilloParaLaVoz } from './platillos-para-la-voz';

/**
 * LA FRASE QUE DICE COCINA CUANDO LLEGA UNA COMANDA (antes en `heredado/lib/voiceAlert.js`).
 *
 * Las ALERGIAS son información de seguridad: siempre se anuncian PRIMERO, hasta 80 caracteres. La
 * celebración va después. Si no hay, no se dice nada (ni «undefined» ni «null»). Los platillos
 * salen de `frasePlatillos`: renglones iguales juntos, cantidad primero y en palabras (DP-21).
 */
export interface ExtrasDeLaFrase {
  /** El rótulo hablado del canal («para llevar 3», «mesa 4»); sin él, la mesa o «mostrador». */
  readonly rotulo?: string | null | undefined;
  readonly notas_alergias?: string | null | undefined;
  readonly celebracion?: boolean | null | undefined;
  readonly tipo_celebracion?: string | null | undefined;
}

const LARGO_MAXIMO_DE_ALERGIA = 80;

export function fraseNuevoPedidoCocina(
  mesaNumero: number | string | null | undefined,
  items: readonly PlatilloParaLaVoz[] | null | undefined,
  notaGeneral: string | null | undefined,
  extras?: ExtrasDeLaFrase | null,
): string {
  const rotulo = typeof extras?.rotulo === 'string' ? extras.rotulo.trim() : '';
  const mesa = rotulo !== '' ? rotulo : mesaNumero ? `mesa ${String(mesaNumero)}` : 'mostrador';
  const platillos = frasePlatillos(Array.isArray(items) ? items : []);
  const cuerpo = platillos === '' ? 'pedido nuevo' : platillos;
  const general = (notaGeneral ?? '').trim();
  const colaNota = general === '' ? '' : ` Nota general: ${general}.`;

  const alergia = (extras?.notas_alergias ?? '').trim();
  const resumen =
    alergia.length > LARGO_MAXIMO_DE_ALERGIA
      ? `${alergia.slice(0, LARGO_MAXIMO_DE_ALERGIA)}…`
      : alergia;
  const prefijoDeAlergia = alergia === '' ? '' : `Atención, alergia: ${resumen}. `;

  let colaCelebracion = '';
  if (extras?.celebracion === true) {
    const tipo = (extras.tipo_celebracion ?? '').trim();
    colaCelebracion = tipo === '' ? ' Celebración especial.' : ` Celebración: ${tipo}.`;
  }

  return `${prefijoDeAlergia}Nuevo pedido ${mesa}: ${cuerpo}.${colaNota}${colaCelebracion}`;
}
