import type { OpcionDeCocina } from './tipos';

/**
 * DP-16 · 2.2 · LAS OPCIONES DE UN PLATILLO, APARTE DE SU NOTA.
 *
 * El mesero y el portal pliegan la elección en la nota como «Relleno: Queso · Extras: Crema — nota
 * propia». La comanda guarda además la elección estructurada (`orden_lineas.opciones`), y la cocina
 * la enseña aparte, resaltada; la nota queda con lo que la persona escribió. Si el platillo no
 * trae la instantánea (comandas de antes), la nota se enseña entera: nada se esconde.
 */

const SEPARADOR = /( · | — )/;

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function nombreDeOpcion(valor: unknown): string | null {
  const nombre = typeof valor === 'string' ? valor : esObjeto(valor) ? valor['nombre'] : null;
  return typeof nombre === 'string' && nombre.trim() !== '' ? nombre.trim() : null;
}

/**
 * De lo que sirve el puente (arreglo, o su texto JSON) a grupos con nombres. Lo que no tiene forma
 * se descarta; nunca lanza: una instantánea rara no puede tumbar el tablero de la cocina.
 */
export function opcionesDelServidor(valor: unknown): readonly OpcionDeCocina[] {
  let lista: unknown = valor;
  if (typeof valor === 'string') {
    try {
      lista = JSON.parse(valor) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(lista)) return [];
  const salida: OpcionDeCocina[] = [];
  for (const grupo of lista as unknown[]) {
    if (
      !esObjeto(grupo) ||
      typeof grupo['grupo'] !== 'string' ||
      !Array.isArray(grupo['opciones'])
    ) {
      continue;
    }
    const nombres = (grupo['opciones'] as unknown[])
      .map(nombreDeOpcion)
      .filter((n): n is string => n !== null);
    if (nombres.length > 0) salida.push({ grupo: grupo['grupo'], opciones: nombres });
  }
  return salida;
}

function esElPliegueDe(segmento: string, opciones: readonly OpcionDeCocina[]): boolean {
  return opciones.some((o) => segmento === `${o.grupo}: ${o.opciones.join(', ')}`);
}

/** Las opciones y, aparte, la nota sin el pliegue de ellas. */
export function separarOpcionesYNota(
  notas: string | null | undefined,
  opciones: readonly OpcionDeCocina[] | null | undefined,
): { readonly opciones: readonly OpcionDeCocina[]; readonly nota: string } {
  const estructuradas = opciones ?? [];
  const texto = (notas ?? '').trim();
  if (estructuradas.length === 0 || texto === '') return { opciones: estructuradas, nota: texto };

  // Posiciones pares: segmentos; impares: los separadores que los unen.
  const piezas = texto.split(SEPARADOR);
  const conservadas: string[] = [];
  for (let i = 0; i < piezas.length; i += 2) {
    const segmento = (piezas[i] ?? '').trim();
    if (esElPliegueDe(segmento, estructuradas)) continue;
    if (conservadas.length > 0) conservadas.push(piezas[i - 1] ?? ' · ');
    conservadas.push(piezas[i] ?? '');
  }
  return { opciones: estructuradas, nota: conservadas.join('').trim() };
}
