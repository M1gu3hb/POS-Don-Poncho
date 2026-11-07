'use client';

import { useQuery } from '@tanstack/react-query';

import { Aviso, Esqueleto, Vacio } from '@morphiqpos/ui/sistema';

import { invocarComando } from '~/cliente/api';

/**
 * «Autorizó La Gerente · Cliente frecuente» bajo el renglón del descuento del cobro de la Caja (DP-14 ·
 * ronda 2, medio 4). El cajero cobra sabiendo de dónde salió el descuento. Si no se puede leer, lo
 * dice: el descuento y el total ya están arriba, esto es sólo de quién y por qué. Y si el descuento no
 * dejó rastro de quién lo autorizó (uno anterior a DP-14), también lo dice en vez de callarlo.
 */

interface DescuentoAutorizadoLeido {
  readonly montoCentavos: string;
  readonly autorizo: string | null;
  readonly motivo: string | null;
}

export function DescuentoAutorizado({ ordenId }: { readonly ordenId: string }) {
  const { data, isError, isPending } = useQuery({
    queryKey: ['descuento_autorizado', ordenId],
    queryFn: () =>
      invocarComando<DescuentoAutorizadoLeido>('/api/venta/descuento-autorizado', { ordenId }),
    staleTime: 10_000,
  });
  if (isError) {
    return <Aviso tono="atencion" titulo="No pude leer quién autorizó el descuento." />;
  }
  if (isPending) return <Esqueleto className="h-4 w-40" />;
  if (data.autorizo === null) {
    return (
      <Vacio
        tamano="compacto"
        titulo="No quedó registrado quién lo autorizó."
        className="items-start px-0 py-(--espacio-1) text-left"
      />
    );
  }
  return (
    <p className="text-xs text-texto-sutil">
      Autorizó {data.autorizo}
      {data.motivo === null ? '' : ` · ${data.motivo}`}
    </p>
  );
}
