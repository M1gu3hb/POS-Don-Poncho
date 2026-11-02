'use client';

import { Eye, QrCode, Split } from 'lucide-react';
import { useEffect } from 'react';

import { lugarDelGlobo } from './pulsacion-larga';

/**
 * EL GLOBO DE UNA MESA MANTENIDA (DP-12.2): «Ver mesa» (lo de siempre: pedir) y «Ver QR de la
 * mesa»; y si encabeza una unión, «Separar mesas» (DP-12.3: así se separa también una unión de
 * mesas libres). Junto al dedo, sin salirse de la pantalla; un toque fuera o Escape lo cierra.
 */

const GLOBO = { ancho: 216, alto: 112 };
const GLOBO_CON_SEPARAR = { ancho: 216, alto: 160 };

export interface MesaDelMenu {
  readonly id: string;
  readonly numero: number;
  readonly x: number;
  readonly y: number;
}

export function MenuDeLaMesa({
  mesa,
  alVerMesa,
  alVerQr,
  alSeparar,
  alCerrar,
}: {
  readonly mesa: MesaDelMenu | null;
  readonly alVerMesa: (mesaId: string) => void;
  readonly alVerQr: (mesa: MesaDelMenu) => void;
  /** Sólo si la mesa encabeza una unión. */
  readonly alSeparar?: ((mesaId: string) => void) | undefined;
  readonly alCerrar: () => void;
}) {
  useEffect(() => {
    if (mesa === null) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => {
      window.removeEventListener('keydown', alTeclear);
    };
  }, [mesa, alCerrar]);
  if (mesa === null) return null;
  // Sólo se abre con un toque, ya en el navegador: aquí `window` existe.
  const pantalla = { ancho: window.innerWidth, alto: window.innerHeight };
  const globo = alSeparar === undefined ? GLOBO : GLOBO_CON_SEPARAR;
  const { left, top } = lugarDelGlobo(mesa.x, mesa.y, pantalla, globo);

  const opcion =
    'flex min-h-11 w-full items-center gap-(--espacio-2) rounded-lg px-(--espacio-3) text-left text-sm font-semibold hover:bg-fondo/15 focus-visible:outline-2';
  return (
    <div className="fixed inset-0 z-50" onPointerDown={alCerrar} data-menu-de-la-mesa={mesa.id}>
      <div
        role="menu"
        aria-label={`Mesa ${String(mesa.numero)}`}
        className="absolute flex flex-col gap-1 rounded-xl bg-texto p-(--espacio-2) text-fondo shadow-lg"
        style={{ left, top, width: globo.ancho }}
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
      >
        <button
          type="button"
          role="menuitem"
          className={opcion}
          onClick={() => {
            alCerrar();
            alVerMesa(mesa.id);
          }}
        >
          <Eye className="size-4" aria-hidden /> Ver mesa
        </button>
        <button
          type="button"
          role="menuitem"
          className={opcion}
          onClick={() => {
            alCerrar();
            alVerQr(mesa);
          }}
        >
          <QrCode className="size-4" aria-hidden /> Ver QR de la mesa
        </button>
        {alSeparar === undefined ? null : (
          <button
            type="button"
            role="menuitem"
            className={opcion}
            onClick={() => {
              alCerrar();
              alSeparar(mesa.id);
            }}
          >
            <Split className="size-4" aria-hidden /> Separar mesas
          </button>
        )}
      </div>
    </div>
  );
}
