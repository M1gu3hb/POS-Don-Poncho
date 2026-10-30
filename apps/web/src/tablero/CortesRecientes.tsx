import { Button } from '@morphiqpos/ui/primitivas/button';
import { Superficie } from '@morphiqpos/ui/sistema';
import { ArrowRight, FileText } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';

import CorteHistorialList from '@/components/cortes/CorteHistorialList';

/**
 * LOS CORTES DE CAJA RECIENTES DEL TABLERO (DP-11.4).
 *
 * Sólo el marco es nuevo: la lista de cortes (`CorteHistorialList`, la misma de Caja →
 * Historial) sigue siendo la heredada, con sus consultas, su espera, su vacío y su visor del
 * PDF. El tablero muestra los 7 más recientes; el historial completo vive en Registros.
 */

const CORTES_A_MOSTRAR = 7;

export function CortesRecientes(): ReactElement {
  return (
    <Superficie como="section" aria-labelledby="titulo-cortes-recientes">
      <div className="mb-(--espacio-3) flex items-center justify-between gap-(--espacio-2)">
        <h2 id="titulo-cortes-recientes" className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="size-4 text-primario" aria-hidden="true" />
          Cortes de caja recientes
        </h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/registros?tab=cortes">
            Ver historial <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {/* `limit` ya trae sólo 7 filas, así que el tope visual (`maxVisible`) sobraba: la lista
            heredada lo infiere como `null` y TypeScript no deja pasarle un número. La clave de la
            consulta es la misma (`historial(7)`). */}
        <CorteHistorialList limit={CORTES_A_MOSTRAR} compact showFilter={false} />
        <p className="text-center text-xs text-texto-sutil">
          Mostrando los últimos 7 cortes. Consulta el historial completo en Registros.
        </p>
      </div>
    </Superficie>
  );
}
