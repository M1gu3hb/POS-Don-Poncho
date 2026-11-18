'use client';

import { Aviso } from '@morphiqpos/ui/sistema';
import { VolumeX } from 'lucide-react';

import { useTextoDelAparato } from '~/cliente/texto-del-aparato';
import {
  anunciaEsteAparato,
  CLAVE_DEL_ANUNCIO,
  leerEleccionDelAparato,
  type QuienMira,
} from '~/voz/anuncio-del-aparato';

/**
 * POR QUÉ ESTA PANTALLA NO SUENA (DP-22 · barrido de servicio).
 *
 * Desde DP-D151 sólo quien entra con el puesto de cocina (y el teléfono de cocina) anuncia las
 * comandas sin haberlo elegido. La dueña, la gerente o la caja abren Cocina, ven llegar las
 * comandas y no oyen nada, y la cabecera sigue diciendo «Voz: ON» (ese interruptor es otro: la voz
 * que lee, no quién la usa). Un aviso chico lo explica y dice dónde se enciende. Si el aparato sí
 * anuncia, no sale nada.
 */
export function AvisoDeSilencio({ puesto }: { readonly puesto: QuienMira }) {
  const texto = useTextoDelAparato(CLAVE_DEL_ANUNCIO);
  const elegido = leerEleccionDelAparato({ getItem: () => texto });
  if (anunciaEsteAparato({ puesto, elegido })) return null;
  return (
    <Aviso
      tono="info"
      icono={<VolumeX aria-hidden className="size-4" />}
      titulo="Esta pantalla no anuncia las comandas en voz"
    >
      {/* En un solo renglón: el contrato de los textos lee el destino línea por línea. */}
      {'Aunque diga «Voz: ON». Se enciende en Configuración → Este aparato.'}
    </Aviso>
  );
}
