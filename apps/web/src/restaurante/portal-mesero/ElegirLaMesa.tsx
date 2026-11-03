'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Vacio } from '@morphiqpos/ui/sistema';

import { mesasParaElegir, type MesaParaElegir } from './mesas-para-elegir';

/**
 * SIN CÁMARA, LA MESA DE UNA LISTA (DP-13.2). El respaldo del escáner era un campo numérico de
 * «Código de barras», y el token del QR de una mesa es alfanumérico: no había forma de llegar.
 * Aquí el mesero toca la mesa y entra a su pedido del portal, lo mismo que si hubiera escaneado.
 */
export function ElegirLaMesa({
  mesas,
  alElegir,
}: {
  readonly mesas: readonly MesaParaElegir[];
  readonly alElegir: (mesaId: string) => void;
}) {
  const lista = mesasParaElegir(mesas);
  if (lista.length === 0) {
    return <Vacio tamano="compacto" titulo="No hay mesas en el mapa." />;
  }
  return (
    <div className="flex flex-col gap-(--espacio-2)">
      <p className="text-sm font-semibold text-primario-texto">Elige la mesa</p>
      <div className="grid grid-cols-3 gap-(--espacio-2)">
        {lista.map((m) => (
          <Button
            key={m.id}
            variant="outline"
            className="h-[calc(var(--altura-control)*1.25)] text-base font-bold"
            onClick={() => {
              alElegir(m.id);
            }}
          >
            Mesa {m.numero}
          </Button>
        ))}
      </div>
    </div>
  );
}
