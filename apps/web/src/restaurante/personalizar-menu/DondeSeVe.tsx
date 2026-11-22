'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

import {
  accionesDe,
  textoDeDondeSeVe,
  type AccionDeVisibilidad,
  type Visibilidad,
} from './donde-se-ve';

/**
 * DP-25 · Parte 8 · DP-D227 · «DÓNDE SE VE» un platillo, en «El orden del menú»: dice en qué lugares
 * SÍ aparece (POS, portal QR) y, al abrirlo, deja ocultarlo del portal, del POS (mesero y Caja) o de
 * todo, o volver a mostrarlo donde esté oculto. El texto va aparte del color: un platillo oculto se
 * ve distinto, pero también lo dice.
 */

/** El blanco táctil de cada botón: 44 px POR COMPONENTE (nunca un selector global de `button`). */
const BOTON = 'min-h-(--altura-tactil) min-w-(--altura-tactil)';

export function DondeSeVe({
  nombre,
  visibilidad,
  ocupado,
  alElegir,
}: {
  readonly nombre: string;
  readonly visibilidad: Visibilidad;
  readonly ocupado: boolean;
  readonly alElegir: (accion: AccionDeVisibilidad) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const oculto = !visibilidad.portal && !visibilidad.pos;
  return (
    <>
      <span className="min-w-0 flex-1">
        <span className={`block truncate ${oculto ? 'text-texto-sutil' : 'font-medium'}`}>
          {nombre}
        </span>
        <span className="block text-sm text-texto-sutil" data-donde-se-ve>
          {textoDeDondeSeVe(visibilidad)}
        </span>
      </span>
      <Button
        type="button"
        variant={oculto ? 'secondary' : 'outline'}
        className={`${BOTON} shrink-0 gap-(--espacio-1)`}
        aria-expanded={abierto}
        aria-label={`${nombre}: dónde se ve`}
        onClick={() => {
          setAbierto(!abierto);
        }}
      >
        {oculto ? (
          <EyeOff aria-hidden className="size-4" />
        ) : (
          <Eye aria-hidden className="size-4" />
        )}
        <span className="text-sm">Dónde se ve</span>
        {abierto ? (
          <ChevronDown aria-hidden className="size-4" />
        ) : (
          <ChevronRight aria-hidden className="size-4" />
        )}
      </Button>
      {abierto ? (
        <div
          role="group"
          aria-label={`Dónde se ve ${nombre}`}
          className="flex basis-full flex-wrap gap-(--espacio-2) pb-(--espacio-2)"
        >
          {accionesDe(visibilidad).map(({ accion, texto }) => (
            <Button
              key={accion}
              type="button"
              variant={accion.startsWith('mostrar') ? 'secondary' : 'outline'}
              className={BOTON}
              disabled={ocupado}
              onClick={() => {
                setAbierto(false);
                alElegir(accion);
              }}
            >
              {texto}
            </Button>
          ))}
        </div>
      ) : null}
    </>
  );
}
