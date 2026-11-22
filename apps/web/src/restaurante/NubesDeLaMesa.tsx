import { nubeCompleta } from './avance-por-estacion.ts';

/**
 * DP-24 · 4.4 · LA «NUBECITA» POR ESTACIÓN en la mesa del mapa: «Cantina ✓», «Cocina 2 de 4».
 *
 * No cambia el color de la mesa ni tapa su número: en el plano cuelga a la DERECHA de la mesa y en
 * la tarjeta del teléfono va en una fila bajo lo demás. No recibe toques. Cada estación que ya
 * sacó algo trae la suya, así que si terminó primero la Cantina se ve antes de que termine la Cocina.
 *
 * DP-25 · 3.4 · Más visible, para leerse a un metro: letra de 16 px en negritas con el conteo («Bebidas
 * 2 de 3»); la estación que TERMINÓ («Cocina ✓») va verde sólido, más grande, con el par de colores
 * `exito`/`exito-texto` del sistema (contraste AA en claro y oscuro).
 */
export interface NubesDeLaMesaProps {
  readonly nubes: readonly string[];
  readonly forma: 'plano' | 'tarjeta';
}

export function NubesDeLaMesa({ nubes, forma }: NubesDeLaMesaProps) {
  if (nubes.length === 0) return null;
  const base = 'pointer-events-none whitespace-nowrap rounded-full leading-none shadow-1';
  const clase = (nube: string): string =>
    nubeCompleta(nube)
      ? `${base} bg-exito px-(--espacio-3) py-1.5 text-lg font-black text-exito-texto`
      : `${base} bg-superficie px-2.5 py-1 text-base font-bold text-texto ring-2 ring-exito`;
  if (forma === 'tarjeta') {
    return (
      <span data-nubes-de-la-mesa className="mt-1 flex flex-wrap justify-center gap-1">
        {nubes.map((nube) => (
          <span key={nube} data-nube={nube} className={clase(nube)}>
            {nube}
          </span>
        ))}
      </span>
    );
  }
  return (
    <span
      data-nubes-de-la-mesa
      className="pointer-events-none absolute top-1/2 left-full z-[1] ml-0.5 flex -translate-y-1/2 flex-col gap-0.5"
    >
      {nubes.map((nube) => (
        <span key={nube} data-nube={nube} className={clase(nube)}>
          {nube}
        </span>
      ))}
    </span>
  );
}
