'use client';

import { Aviso, Esqueleto, Superficie } from '@morphiqpos/ui/sistema';
import { useQuery } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import Link from 'next/link';

import { invocarComando } from '~/cliente/api';

import { RUTA_DEL_AVISO, textoDelAviso, type AvisoDelServidor } from './aviso-de-insumos-bajos.ts';

/**
 * DP-22 · EL AVISO DE INSUMO BAJO en el Tablero (DP-D159): «N insumos por debajo de su mínimo», con los
 * primeros nombres y un toque que lleva a Inventario ya filtrado. La cuenta sale del servidor
 * (`inventario.insumos_bajos`, sobre todos los insumos), no de una lista que pueda venir cortada. Sin
 * insumos bajos no aparece; si no se pudo leer, lo dice (nunca un aviso mudo).
 */
export function AvisoDeInsumosBajos() {
  const lectura = useQuery({
    queryKey: ['inventario_insumos_bajos'],
    queryFn: ({ signal }) =>
      invocarComando<AvisoDelServidor>('/api/inventario/insumos-bajos', {}, { signal }),
    placeholderData: (anterior) => anterior,
    staleTime: 5_000,
    refetchInterval: 30_000,
  });
  if (lectura.isError && lectura.data === undefined)
    return (
      <Aviso
        tono="atencion"
        titulo="No se pudo revisar qué insumos están bajos. Recarga el tablero."
      />
    );
  if (lectura.isPending) return <Esqueleto className="h-[max(2.75rem,var(--altura-control))]" />;
  const texto = textoDelAviso(lectura.data);
  if (texto === null) return null;
  return (
    <Superficie
      como={Link}
      interactiva
      href={RUTA_DEL_AVISO}
      aria-label={`${texto.titulo}: ${texto.nombres}. ${texto.ayuda}`}
      data-prueba="aviso-de-insumos-bajos"
      relleno={3}
      className="flex min-h-[max(2.75rem,var(--altura-control))] items-center gap-(--espacio-3) border-peligro/40 bg-peligro/10"
    >
      <TriangleAlert aria-hidden="true" className="size-5 shrink-0 text-peligro" />
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold">{texto.titulo}</span>
        <span className="truncate text-sm">{texto.nombres}</span>
        <span className="text-xs text-texto-sutil">{texto.ayuda}</span>
      </span>
    </Superficie>
  );
}
