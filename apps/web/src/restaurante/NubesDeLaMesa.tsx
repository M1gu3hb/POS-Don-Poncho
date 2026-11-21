/**
 * DP-24 · 4.4 · LA «NUBECITA» POR ESTACIÓN en la mesa del mapa: «Cantina ✓», «Cocina 2/4».
 *
 * No cambia el color de la mesa ni tapa su número: en el plano cuelga a la DERECHA de la mesa y en
 * la tarjeta del teléfono va en una fila bajo lo demás. No recibe toques. Cada estación que ya
 * sacó algo trae la suya, así que si terminó primero la Cantina se ve antes de que termine la Cocina.
 */
export interface NubesDeLaMesaProps {
  readonly nubes: readonly string[];
  readonly forma: 'plano' | 'tarjeta';
}

export function NubesDeLaMesa({ nubes, forma }: NubesDeLaMesaProps) {
  if (nubes.length === 0) return null;
  const chip =
    'pointer-events-none whitespace-nowrap rounded-full bg-superficie px-1.5 py-px text-xs leading-none font-bold ring-1 ring-exito text-texto shadow-1';
  if (forma === 'tarjeta') {
    return (
      <span data-nubes-de-la-mesa className="mt-1 flex flex-wrap justify-center gap-1">
        {nubes.map((nube) => (
          <span key={nube} data-nube={nube} className={chip}>
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
        <span key={nube} data-nube={nube} className={chip}>
          {nube}
        </span>
      ))}
    </span>
  );
}
