import { Button } from '@morphiqpos/ui/primitivas/button';
import { Aviso, Esqueleto } from '@morphiqpos/ui/sistema';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';

/**
 * EL AVISO DE LA CAJA DEL TABLERO (DP-11.4).
 *
 * Tres estados y ninguno se confunde:
 *   · LEYENDO — todavía no se sabe. NO se afirma «no hay caja abierta»: el tablero decía
 *     «cerrada» antes del primer fetch.
 *   · SIN CAJA — un muro de negocio, no un error: un aviso de atención con su salida a Caja.
 *   · CON CAJA — no hay nada que avisar, y no se pinta nada.
 */

export function AvisoDeCaja({
  cargando,
  hayCaja,
}: {
  readonly cargando: boolean;
  readonly hayCaja: boolean;
}): ReactElement | null {
  if (cargando) {
    return (
      <div role="status" className="flex items-center gap-(--espacio-3) text-sm text-texto-sutil">
        <Esqueleto redondo className="size-4" />
        <p>Verificando caja abierta…</p>
      </div>
    );
  }
  if (hayCaja) return null;
  return (
    <Aviso
      tono="atencion"
      icono={<AlertTriangle />}
      titulo="No hay caja abierta."
      accion={
        <Button asChild size="sm" variant="outline">
          <Link href="/caja">Ir a Caja</Link>
        </Button>
      }
    >
      Abre caja para comenzar operación. Los indicadores operativos están en cero hasta que se abra
      una caja.
    </Aviso>
  );
}
